declare var __webpack_require__: any;
declare var __non_webpack_require__: any;

import type { Options } from "./types";

export type FileExtension = "svg" | "png" | "jpeg" | "webp" | "gif";

export interface ExportOptions {
  /** Output width in pixels. Defaults to the SVG's own width attribute. */
  width?: number;
  /** Output height in pixels. Defaults to the SVG's own height attribute. */
  height?: number;
  /** Quality for lossy formats (jpeg, webp). 1–100. Default: 90. */
  quality?: number;

  // ── GIF-specific (only used when format === "gif") ─────────────────────────
  /** Frames per second. Default: 20. */
  fps?: number;
  /** Number of full animation cycles to include. Default: 1. */
  cycles?: number;
  /**
   * Background fill for GIF frames.
   * Hex color (`"#ffffff"`) or `"transparent"`. Default: `"transparent"`.
   */
  background?: string;
  /** GIF loop count. 0 = loop forever (default). */
  repeat?: number;
}

/**
 * Converts a QR code to the requested format and returns a Buffer.
 *
 * Works in **browser and Node.js** for all formats including GIF.
 *
 * - Pass a pre-rendered **SVG string** for svg / png / jpeg / webp / static gif.
 * - Pass the original **Options object** when `format === "gif"` to generate an
 *   animated GIF — the encoder re-renders the SVG at every time step so SVG
 *   animation keyframes (pulse, shimmer, draw, glow) are baked into the frames.
 *
 * @example
 * // PNG from SVG string (Node.js — requires sharp)
 * const { svg } = await QRCodeGenerate({ data: 'https://example.com' });
 * const png = await exportQR(svg, 'png', { width: 1000 });
 *
 * // Animated GIF — works in browser and Node.js
 * const gif = await exportQR(
 *   { data: 'https://example.com', animation: { type: 'pulse' } },
 *   'gif',
 *   { fps: 20, cycles: 2, background: '#ffffff' },
 * );
 */
export async function exportQR(
  input: string | Options,
  format: FileExtension,
  options: ExportOptions = {},
): Promise<Buffer> {
  if (format === "svg") {
    const svg = typeof input === "string" ? input : "";
    return typeof Buffer !== "undefined"
      ? Buffer.from(svg, "utf-8")
      : (new TextEncoder().encode(svg) as any);
  }

  if (format === "gif") {
    return _encodeGIF(input, options);
  }

  // png / jpeg / webp — Node.js only (sharp)
  if (typeof input !== "string") {
    throw new Error("[exportQR] Pass a pre-rendered SVG string for png/jpeg/webp export.");
  }
  return _sharpRaster(input, format, options);
}

// ---------------------------------------------------------------------------
// Raster (Node.js / sharp)
// ---------------------------------------------------------------------------

async function _sharpRaster(svg: string, format: string, opts: ExportOptions): Promise<Buffer> {
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
  throw new Error(`[exportQR] Unsupported format: "${format}". Use: svg | png | jpeg | webp | gif`);
}

// ---------------------------------------------------------------------------
// SVG → raw RGBA (browser: Canvas, Node.js: sharp)
// ---------------------------------------------------------------------------

function _parseBg(bg?: string): { r: number; g: number; b: number; alpha: number } {
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

/** Parse width/height from SVG string without a full DOM parser. */
function _svgDims(svg: string): { width: number; height: number } {
  const wm = svg.match(/\bwidth=["']?([\d.]+)/);
  const hm = svg.match(/\bheight=["']?([\d.]+)/);
  const vb = svg.match(/viewBox=["']?\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)/);
  return {
    width:  parseFloat(wm?.[1] ?? vb?.[1] ?? "512"),
    height: parseFloat(hm?.[1] ?? vb?.[2] ?? "512"),
  };
}

async function _svgToRgba(
  svg: string,
  width: number,
  height: number,
  bg: { r: number; g: number; b: number; alpha: number },
): Promise<Uint8ClampedArray> {
  // ── Browser path ──────────────────────────────────────────────────────────
  if (typeof document !== "undefined") {
    return new Promise<Uint8ClampedArray>((resolve, reject) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;

      if (bg.alpha > 0) {
        ctx.fillStyle = `rgba(${bg.r},${bg.g},${bg.b},${bg.alpha})`;
        ctx.fillRect(0, 0, width, height);
      }

      const img = new Image();
      // Use object URL so embedded images (data URIs, GIFs) are preserved.
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(ctx.getImageData(0, 0, width, height).data);
      };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(new Error("SVG render failed: " + e)); };
      img.src = url;
    });
  }

  // ── Node.js path (sharp) ──────────────────────────────────────────────────
  let sharp: any;
  try {
    const m = await import("sharp");
    sharp = m.default || m;
  } catch {
    throw new Error("The 'sharp' package is required for GIF export in Node.js.");
  }
  const svgBuf = Buffer.from(svg, "utf-8");
  const { data } = await sharp(svgBuf)
    .resize(width, height, { fit: "contain", background: bg })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
}

// ---------------------------------------------------------------------------
// GIF encoder (gifenc — pure JS, works in browser + Node.js)
// ---------------------------------------------------------------------------

async function _encodeGIF(input: string | Options, opts: ExportOptions): Promise<Buffer> {
  const { QRCodeGenerate, getAnimationDuration } = await import("./index");

  let gifenc: any;
  try {
    gifenc = await import("gifenc");
  } catch {
    throw new Error("The 'gifenc' package is required for GIF export. Run: npm install gifenc");
  }
  const { GIFEncoder, quantize, applyPalette } = gifenc.default ?? gifenc;

  const fps    = Math.max(1, Math.min(50, opts.fps    ?? 20));
  const cycles = Math.max(1,              opts.cycles  ?? 1);
  const repeat =                          opts.repeat  ?? 0;
  const bg = _parseBg(opts.background);

  const isSvgString = typeof input === "string";

  // Determine animation cycle duration
  let cycleDur = 0;
  if (!isSvgString) {
    const qrOpts = input as Options;
    const animList = qrOpts.animation
      ? (Array.isArray(qrOpts.animation) ? qrOpts.animation : [qrOpts.animation])
      : [];
    cycleDur = getAnimationDuration(animList);
  }

  const totalFrames = cycleDur > 0 ? Math.round(cycleDur * cycles * fps) : 1;
  const frameDelay  = Math.round(1000 / fps); // gifenc uses ms

  // Render first frame — also used to read intrinsic SVG dimensions.
  const firstSvg = isSvgString
    ? (input as string)
    : (await QRCodeGenerate(input as Options, undefined, 0)).svg;

  const cachedMatrix = isSvgString
    ? undefined
    : (await QRCodeGenerate(input as Options, undefined, 0)).matrix;

  // Resolve output dimensions
  const intrinsic = _svgDims(firstSvg);
  const outW = opts.width  ?? intrinsic.width;
  const outH = opts.height ?? intrinsic.height;

  const gif = GIFEncoder();

  for (let f = 0; f < totalFrames; f++) {
    const svg = (f === 0 || isSvgString)
      ? firstSvg
      : (await QRCodeGenerate(input as Options, cachedMatrix, (f / fps) % cycleDur)).svg;

    const rgba = await _svgToRgba(svg, outW, outH, bg);
    const palette = quantize(rgba, 256, { format: "rgba4444" });
    const index   = applyPalette(rgba, palette);

    gif.writeFrame(index, outW, outH, {
      palette,
      delay: frameDelay,
      repeat: f === 0 ? repeat : undefined,
    });
  }

  gif.finish();
  const bytes = gif.bytes();
  return typeof Buffer !== "undefined" ? Buffer.from(bytes) : bytes as any;
}

/** @deprecated Use `exportQR(qrOptions, 'gif', options)` instead. */
export async function exportGIF(
  qrOptions: Options,
  gifOptions: ExportOptions = {},
): Promise<Buffer> {
  return _encodeGIF(qrOptions, gifOptions);
}
