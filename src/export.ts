declare var __webpack_require__: any;
declare var __non_webpack_require__: any;

export type FileExtension = "svg" | "png" | "jpeg" | "webp" | "gif";

export interface ExportOptions {
  /** Output width in pixels. Defaults to the SVG's own width attribute. */
  width?: number;
  /** Output height in pixels. Defaults to the SVG's own height attribute. */
  height?: number;
  /**
   * Quality for lossy formats (jpeg, webp): 1–100, default 90.
   * For **GIF**: shorthand for `colors` — `quality: 50` ≈ 128 palette colours.
   * Ignored when `colors` is also set.
   */
  quality?: number;
  /** GIF: frames per second. Default: 24. */
  fps?: number;
  /** GIF: number of full animation cycles. Default: 2. */
  cycles?: number;
  /** GIF: background — hex color or `"transparent"`. Default: `"transparent"`. */
  background?: string;
  /** GIF: loop count. 0 = loop forever (default). */
  repeat?: number;
  /**
   * GIF: apply Bayer 4×4 ordered dithering before palette quantization.
   * Reduces visible colour banding on gradients and glow effects. Default: `true`.
   */
  dithering?: boolean;
  /**
   * GIF: number of palette colours (2–256). Default: 256.
   * Fewer colours = smaller file, more visible banding.
   * Overrides the `quality` shorthand.
   */
  colors?: number;
  /**
   * GIF: dithering spread intensity (0–100). Default: 50.
   * 0 = minimal dither noise, 100 = strongest — best for heavy gradients.
   * Has no effect when `dithering` is `false`.
   */
  ditherStrength?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers — no import from index.ts (avoids circular dep in bundles)
// ---------------------------------------------------------------------------

export function parseBg(bg?: string): { r: number; g: number; b: number; alpha: number } {
  if (!bg || bg === "transparent") return { r: 0, g: 0, b: 0, alpha: 0 };
  const hex = bg.replace("#", "");
  if (hex.length === 6 || hex.length === 8) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      alpha: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
    };
  }
  return { r: 0, g: 0, b: 0, alpha: 0 };
}

/** Read width/height from an SVG string without a DOM parser. */
export function svgDims(svg: string): { width: number; height: number } {
  const wm = svg.match(/\bwidth=["']?([\d.]+)/);
  const hm = svg.match(/\bheight=["']?([\d.]+)/);
  const vb = svg.match(/viewBox=["']?\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)/);
  return {
    width:  parseFloat(wm?.[1] ?? vb?.[1] ?? "512"),
    height: parseFloat(hm?.[1] ?? vb?.[2] ?? "512"),
  };
}

/** Render an SVG string to raw RGBA pixels at the given size.
 *  Browser: Canvas API.  Node.js: sharp. */
export async function svgToRgba(
  svg: string,
  width: number,
  height: number,
  bg: { r: number; g: number; b: number; alpha: number },
): Promise<Uint8ClampedArray> {
  return (await renderSvgBatch([svg], width, height, bg))[0];
}

/**
 * Render multiple SVG strings to RGBA in an optimised batch.
 *
 * Browser: reuses a single off-screen canvas across all frames (avoids
 *          repeated DOM allocation and ImageBitmap decode overhead).
 * Node.js: processes frames in parallel chunks of 8 via sharp worker threads.
 */
export async function renderSvgBatch(
  svgs: string[],
  width: number,
  height: number,
  bg: { r: number; g: number; b: number; alpha: number },
): Promise<Uint8ClampedArray[]> {
  if (!svgs.length) return [];

  if (typeof document !== "undefined") {
    // Browser — one canvas for the whole batch
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const bgStyle = bg.alpha > 0 ? `rgba(${bg.r},${bg.g},${bg.b},${bg.alpha})` : null;
    const results: Uint8ClampedArray[] = [];

    for (const svg of svgs) {
      if (bgStyle) { ctx.fillStyle = bgStyle; ctx.fillRect(0, 0, width, height); }
      else ctx.clearRect(0, 0, width, height);
      await new Promise<void>((res, rej) => {
        const img = new Image();
        const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        img.onload = () => { ctx.drawImage(img, 0, 0, width, height); URL.revokeObjectURL(url); res(); };
        img.onerror = (e) => { URL.revokeObjectURL(url); rej(new Error("SVG render failed: " + e)); };
        img.src = url;
      });
      // Copy pixel data out (slice so the canvas can be reused immediately)
      results.push(new Uint8ClampedArray(ctx.getImageData(0, 0, width, height).data));
    }
    return results;
  }

  // Node.js — parallel sharp rendering in chunks of 8
  let sharp: any;
  try {
    const m = await import("sharp");
    sharp = m.default || m;
  } catch {
    throw new Error("The 'sharp' package is required for GIF export in Node.js.");
  }

  const renderOne = async (svg: string): Promise<Uint8ClampedArray> => {
    const svgBuf = Buffer.from(svg, "utf-8");
    const { data } = await sharp(svgBuf)
      .resize(width, height, { fit: "contain", background: bg })
      .raw()
      .toBuffer({ resolveWithObject: true });
    return new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  };

  const results: Uint8ClampedArray[] = [];
  const CHUNK = 8;
  for (let i = 0; i < svgs.length; i += CHUNK) {
    const chunk = await Promise.all(svgs.slice(i, i + CHUNK).map(renderOne));
    results.push(...chunk);
  }
  return results;
}

/** Fast sampled comparison of two palette-index arrays (every 64th byte). */
function indexedEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 64) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Encode pre-rendered RGBA frame array into an animated GIF using gifenc.
 *
 * Optimisations vs naive per-frame encode:
 *  1. **Global palette** — quantize is run once on a sample of up to 16
 *     evenly distributed frames instead of once per frame. This is the
 *     single biggest speedup (quantize ≈ 80 % of encode time per frame).
 *     A shared palette also improves LZW compression because the same colour
 *     always maps to the same index across frames.
 *  2. **Frame deduplication** — consecutive frames whose palette-index arrays
 *     are identical (sampled check) are merged: the duplicate is skipped and
 *     its delay is added to the previous frame. Helps with draw/float
 *     animations that have stationary start/end frames.
 */
// Bayer 4×4 ordered-dithering matrix (values 0–15, row-major).
const BAYER4 = new Uint8Array([0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5]);

/**
 * Apply Bayer 4×4 ordered dithering to an RGBA frame.
 * @param frame       Source RGBA pixels (not mutated).
 * @param width       Image width in pixels.
 * @param strength255 Peak dither offset in [0–255] units (±half on each channel).
 */
function applyBayerDither(
  frame: Uint8ClampedArray,
  width: number,
  strength255: number,
): Uint8ClampedArray {
  const out  = new Uint8ClampedArray(frame);
  const half = strength255 / 2;
  for (let p = 0; p < out.length; p += 4) {
    const px = (p >> 2) % width;
    const py = Math.floor((p >> 2) / width);
    const bv = BAYER4[(py & 3) * 4 + (px & 3)]; // 0–15
    const d  = (bv / 15) * strength255 - half;    // −half … +half
    out[p]     = Math.max(0, Math.min(255, out[p]     + d)) as number;
    out[p + 1] = Math.max(0, Math.min(255, out[p + 1] + d)) as number;
    out[p + 2] = Math.max(0, Math.min(255, out[p + 2] + d)) as number;
    // Alpha channel untouched
  }
  return out;
}

export async function encodeGifFrames(
  frames: Uint8ClampedArray[],
  width: number,
  height: number,
  frameDelay: number,
  repeat: number,
  dithering = true,
  /** Palette colour count (2–256). */
  colors = 256,
  /**
   * Dithering spread in 0–255 units (maps from the 0–100 public option).
   * Ignored when dithering = false.
   */
  ditherStrength255 = 24,
): Promise<Buffer | Uint8Array> {
  let gifenc: any;
  try {
    gifenc = await import("gifenc");
  } catch {
    throw new Error("The 'gifenc' package is required for GIF export. Run: npm install gifenc");
  }
  // gifenc ESM: named exports live on .default when it's an object; otherwise on the module itself.
  const mod = gifenc.default && typeof gifenc.default === "object" ? gifenc.default : gifenc;
  const { GIFEncoder, quantize, applyPalette } = mod;

  // ── 1. Build global palette from a sample of up to 16 frames ──────────────
  const maxColors = Math.max(2, Math.min(256, colors));
  const SAMPLE_N  = Math.min(frames.length, 16);
  const step      = Math.max(1, Math.floor(frames.length / SAMPLE_N));
  // Concatenate sampled frame pixels into one big array for quantize
  let totalBytes = 0;
  for (let i = 0; i < frames.length; i += step) totalBytes += frames[i].length;
  const combined = new Uint8ClampedArray(totalBytes);
  let off = 0;
  for (let i = 0; i < frames.length; i += step) {
    combined.set(frames[i], off);
    off += frames[i].length;
  }
  const palette = quantize(combined, maxColors, { format: "rgba4444" });

  // ── 2. Index all frames and write, deduplicating identical consecutive ones ─
  const gif        = GIFEncoder();
  let firstWritten = true;
  let pendingDelay = 0;
  let lastIndex: Uint8Array | null = null;

  for (let i = 0; i < frames.length; i++) {
    // Apply Bayer ordered dithering before palette lookup to reduce colour banding
    const pixelData = dithering
      ? applyBayerDither(frames[i], width, ditherStrength255)
      : frames[i];
    const index = applyPalette(pixelData, palette);
    pendingDelay += frameDelay;

    // Skip duplicate frames (but always flush on the last frame)
    if (lastIndex && indexedEqual(index, lastIndex) && i < frames.length - 1) continue;

    gif.writeFrame(index, width, height, {
      palette,
      delay: pendingDelay,
      repeat: firstWritten ? repeat : undefined,
    });
    firstWritten = false;
    lastIndex    = index;
    pendingDelay = 0;
  }

  gif.finish();
  const bytes = gif.bytes();
  return typeof Buffer !== "undefined" ? Buffer.from(bytes) : bytes;
}

/** Browser: render SVG to PNG/JPEG/WEBP via canvas.toBlob. */
export async function canvasRaster(
  svg: string,
  format: string,
  opts: ExportOptions,
): Promise<Uint8Array> {
  const { width: svgW, height: svgH } = svgDims(svg);
  const outW = opts.width  ?? svgW;
  const outH = opts.height ?? svgH;

  return new Promise<Uint8Array>((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width  = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d")!;

    // JPEG has no alpha channel — fill white unless caller overrides
    const bgStr = opts.background ?? (format === "jpeg" ? "#ffffff" : "transparent");
    const bg = parseBg(bgStr);
    if (bg.alpha > 0) {
      ctx.fillStyle = `rgba(${bg.r},${bg.g},${bg.b},${bg.alpha})`;
      ctx.fillRect(0, 0, outW, outH);
    }

    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      ctx.drawImage(img, 0, 0, outW, outH);
      URL.revokeObjectURL(url);

      const mime =
        format === "jpeg" ? "image/jpeg" :
        format === "webp" ? "image/webp" :
        "image/png";
      const quality = (opts.quality ?? 90) / 100;

      canvas.toBlob(
        (b) => {
          if (!b) { reject(new Error("[exportQR] canvas.toBlob failed")); return; }
          b.arrayBuffer().then((buf) => resolve(new Uint8Array(buf))).catch(reject);
        },
        mime,
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("[exportQR] SVG render failed"));
    };
    img.src = url;
  });
}

/** Node.js only: render SVG to PNG/JPEG/WEBP via sharp. */
export async function sharpRaster(
  svg: string,
  format: string,
  opts: ExportOptions,
): Promise<Buffer> {
  let sharp: any;
  try {
    const m = await import("sharp");
    sharp = m.default || m;
  } catch {
    throw new Error("The 'sharp' package is required for PNG/JPEG/WEBP export in Node.js.");
  }
  const svgBuf = typeof Buffer !== "undefined" ? Buffer.from(svg, "utf-8") : (svg as any);
  let pipeline = sharp(svgBuf);
  if (opts.width || opts.height) {
    pipeline = pipeline.resize(opts.width, opts.height, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }
  const quality = opts.quality ?? 90;
  if (format === "png")  return pipeline.png().toBuffer();
  if (format === "jpeg") return pipeline.jpeg({ quality }).toBuffer();
  if (format === "webp") return pipeline.webp({ quality }).toBuffer();
  throw new Error(`[exportQR] Unsupported format: "${format}".`);
}
