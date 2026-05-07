declare var __webpack_require__: any;
declare var __non_webpack_require__: any;

export type FileExtension = "svg" | "png" | "jpeg" | "webp" | "gif";

export interface ExportOptions {
  /** Output width in pixels. Defaults to the SVG's own width attribute. */
  width?: number;
  /** Output height in pixels. Defaults to the SVG's own height attribute. */
  height?: number;
  /** Quality for lossy formats (jpeg, webp). 1–100. Default: 90. */
  quality?: number;
  /** GIF: frames per second. Default: 20. */
  fps?: number;
  /** GIF: number of full animation cycles. Default: 1. */
  cycles?: number;
  /** GIF: background — hex color or `"transparent"`. Default: `"transparent"`. */
  background?: string;
  /** GIF: loop count. 0 = loop forever (default). */
  repeat?: number;
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
  // Node.js
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

/** Encode pre-rendered RGBA frame array into an animated GIF using gifenc. */
export async function encodeGifFrames(
  frames: Uint8ClampedArray[],
  width: number,
  height: number,
  frameDelay: number,
  repeat: number,
): Promise<Buffer | Uint8Array> {
  let gifenc: any;
  try {
    gifenc = await import("gifenc");
  } catch {
    throw new Error("The 'gifenc' package is required for GIF export. Run: npm install gifenc");
  }
  // gifenc ESM: default export is the GIFEncoder function itself; named exports live on the namespace.
  // gifenc CJS (Node): default is an object with all named exports.
  const mod = gifenc.default && typeof gifenc.default === "object" ? gifenc.default : gifenc;
  const { GIFEncoder, quantize, applyPalette } = mod;

  const gif = GIFEncoder();
  for (let i = 0; i < frames.length; i++) {
    const palette = quantize(frames[i], 256, { format: "rgba4444" });
    const index   = applyPalette(frames[i], palette);
    gif.writeFrame(index, width, height, {
      palette,
      delay: frameDelay,
      repeat: i === 0 ? repeat : undefined,
    });
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
