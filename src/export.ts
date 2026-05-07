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
 * Pass a pre-rendered **SVG string** for all formats including `"gif"` (static,
 * single-frame). Pass the original **Options object** when `format === "gif"` to
 * generate a true animated GIF — the encoder re-renders the SVG at every time
 * step so animation keyframes are preserved.
 *
 * @example
 * // PNG from SVG string
 * const { svg } = await QRCodeGenerate({ data: 'https://example.com' });
 * const png = await exportQR(svg, 'png', { width: 1000 });
 *
 * // Animated GIF from QR options
 * const gif = await exportQR(
 *   { data: 'https://example.com', animation: { type: 'pulse' } },
 *   'gif',
 *   { fps: 20, cycles: 2 },
 * );
 * fs.writeFileSync('qr.gif', gif);
 */
export async function exportQR(
  input: string | Options,
  format: FileExtension,
  options: ExportOptions = {},
): Promise<Buffer> {
  // ── SVG passthrough ────────────────────────────────────────────────────────
  if (format === "svg") {
    const svg = typeof input === "string" ? input : "";
    return typeof Buffer !== "undefined"
      ? Buffer.from(svg, "utf-8")
      : (new TextEncoder().encode(svg) as any);
  }

  // ── GIF branch ────────────────────────────────────────────────────────────
  if (format === "gif") {
    return _encodeGIF(input, options);
  }

  // ── Raster branch (png / jpeg / webp) ─────────────────────────────────────
  if (typeof input !== "string") {
    throw new Error("[exportQR] Pass a pre-rendered SVG string for png/jpeg/webp export.");
  }

  let sharp: any;
  try {
    const m = await import("sharp");
    sharp = m.default || m;
  } catch {
    throw new Error("The 'sharp' package is required for PNG/JPEG/WEBP export in Node.js.");
  }

  const svgBuf = typeof Buffer !== "undefined" ? Buffer.from(input, "utf-8") : (input as any);
  let pipeline = sharp(svgBuf);

  if (options.width || options.height) {
    pipeline = pipeline.resize(options.width, options.height, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  const quality = options.quality ?? 90;

  switch (format) {
    case "png":  return pipeline.png().toBuffer();
    case "jpeg": return pipeline.jpeg({ quality }).toBuffer();
    case "webp": return pipeline.webp({ quality }).toBuffer();
    default:
      throw new Error(`[exportQR] Unsupported format: "${format}". Use: svg | png | jpeg | webp | gif`);
  }
}

// ---------------------------------------------------------------------------
// GIF encoder (shared by exportQR and the legacy exportGIF alias)
// ---------------------------------------------------------------------------

async function _encodeGIF(input: string | Options, opts: ExportOptions): Promise<Buffer> {
  const { QRCodeGenerate, getAnimationDuration } = await import("./index");

  let sharp: any;
  try {
    const m = await import("sharp");
    sharp = m.default || m;
  } catch {
    throw new Error("The 'sharp' package is required for GIF export.");
  }

  let GifEncoder: any;
  try {
    const m = await import("gif-encoder-2");
    GifEncoder = m.default || m;
  } catch {
    throw new Error("The 'gif-encoder-2' package is required for GIF export. Run: npm install gif-encoder-2");
  }

  const fps    = Math.max(1, Math.min(50, opts.fps    ?? 20));
  const cycles = Math.max(1,              opts.cycles  ?? 1);
  const repeat =                          opts.repeat  ?? 0;

  // When a plain SVG string is given, produce a single-frame GIF.
  const isSvgString = typeof input === "string";

  let cycleDur = 0;
  if (!isSvgString) {
    const qrOpts = input as Options;
    const animList = qrOpts.animation
      ? (Array.isArray(qrOpts.animation) ? qrOpts.animation : [qrOpts.animation])
      : [];
    cycleDur = getAnimationDuration(animList);
  }

  const totalFrames = cycleDur > 0 ? Math.round(cycleDur * cycles * fps) : 1;
  const frameDelay  = Math.round(1000 / fps);

  // Render first frame to determine intrinsic dimensions.
  const firstSvgBuf: Buffer = isSvgString
    ? Buffer.from(input as string, "utf-8")
    : Buffer.from((await QRCodeGenerate(input as Options, undefined, 0)).svg, "utf-8");

  const cachedMatrix = isSvgString
    ? undefined
    : (await QRCodeGenerate(input as Options, undefined, 0)).matrix;

  let outW = opts.width;
  let outH = opts.height;
  if (!outW || !outH) {
    const meta = await sharp(firstSvgBuf).metadata();
    outW = outW ?? meta.width  ?? 512;
    outH = outH ?? meta.height ?? 512;
  }

  const bgColor = _parseBg(opts.background);

  const encoder = new GifEncoder(outW, outH, "neuquant", true);
  encoder.setDelay(frameDelay);
  encoder.setRepeat(repeat);
  encoder.setQuality(10);
  encoder.start();

  for (let f = 0; f < totalFrames; f++) {
    let svgBuf: Buffer;
    if (isSvgString || f === 0) {
      svgBuf = firstSvgBuf;
    } else {
      const secs = (f / fps) % cycleDur;
      const result = await QRCodeGenerate(input as Options, cachedMatrix, secs);
      svgBuf = Buffer.from(result.svg, "utf-8");
    }

    const { data } = await sharp(svgBuf)
      .resize(outW, outH, { fit: "contain", background: bgColor })
      .raw()
      .toBuffer({ resolveWithObject: true });

    encoder.addFrame(data);
  }

  encoder.finish();
  return Buffer.from(encoder.out.getData());
}

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

/** @deprecated Use `exportQR(qrOptions, 'gif', gifOptions)` instead. */
export async function exportGIF(
  qrOptions: Options,
  gifOptions: ExportOptions = {},
): Promise<Buffer> {
  return _encodeGIF(qrOptions, gifOptions);
}
