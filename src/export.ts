declare var __webpack_require__: any;
declare var __non_webpack_require__: any;

export type FileExtension = "svg" | "png" | "jpeg" | "webp";

export interface ExportOptions {
  /** Output width in pixels. Defaults to the SVG's own width attribute. */
  width?: number;
  /** Output height in pixels. Defaults to the SVG's own height attribute. */
  height?: number;
  /** Quality for lossy formats (jpeg, webp). 1–100. Default: 90. */
  quality?: number;
}

/**
 * Converts an SVG string to the requested format and returns a Buffer.
 *
 * @example
 * const { svg } = await QRCodeGenerate({ ... });
 * const pngBuf = await exportQR(svg, 'png', { width: 1000 });
 * fs.writeFileSync('qr.png', pngBuf);
 */
export async function exportQR(
  svg: string,
  format: FileExtension,
  options: ExportOptions = {},
): Promise<Buffer> {
  if (format === "svg") {
    return typeof Buffer !== "undefined"
      ? Buffer.from(svg, "utf-8")
      : (new TextEncoder().encode(svg) as any);
  }

  const svgBuf =
    typeof Buffer !== "undefined" ? Buffer.from(svg, "utf-8") : (svg as any);
  let sharp: any;
  try {
    const sharpModule = await import("sharp");
    sharp = sharpModule.default || sharpModule;
  } catch (err) {
    throw new Error(
      "The 'sharp' package is required for PNG/JPEG/WEBP export in Node.js.",
    );
  }
  let pipeline = sharp(svgBuf);

  if (options.width || options.height) {
    pipeline = pipeline.resize(options.width, options.height, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  const quality = options.quality ?? 90;

  switch (format) {
    case "png":
      return pipeline.png().toBuffer();
    case "jpeg":
      return pipeline.jpeg({ quality }).toBuffer();
    case "webp":
      return pipeline.webp({ quality }).toBuffer();
    default:
      throw new Error(
        `[exportQR] Unsupported format: "${format}". Use: svg | png | jpeg | webp`,
      );
  }
}

// ---------------------------------------------------------------------------
// GIF export
// ---------------------------------------------------------------------------

import type { Options, GifExportOptions } from "./types";

/**
 * Encodes an animated QR code (or a static one) as an animated GIF Buffer.
 *
 * Requires `gif-encoder-2` and `sharp` to be installed.
 *
 * @example
 * const buf = await exportGIF({ data: 'https://example.com', animation: { type: 'pulse' } });
 * fs.writeFileSync('qr.gif', buf);
 */
export async function exportGIF(
  qrOptions: Options,
  gifOptions: GifExportOptions = {},
): Promise<Buffer> {
  // Lazy-load QRCodeGenerate and getAnimationDuration to avoid circular dep at module init
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
    throw new Error(
      "The 'gif-encoder-2' package is required for GIF export. Run: npm install gif-encoder-2",
    );
  }

  const animList = qrOptions.animation
    ? (Array.isArray(qrOptions.animation) ? qrOptions.animation : [qrOptions.animation])
    : [];

  const cycleDur = getAnimationDuration(animList); // seconds, 0 if no animations

  const fps = Math.max(1, Math.min(50, gifOptions.fps ?? 20));
  const cycles = Math.max(1, gifOptions.cycles ?? 1);
  const repeat = gifOptions.repeat ?? 0;

  // For static QR: one frame, duration 1s
  const totalDur = cycleDur > 0 ? cycleDur * cycles : 1;
  const totalFrames = cycleDur > 0 ? Math.round(totalDur * fps) : 1;
  const frameDelay = Math.round(1000 / fps); // ms per frame

  // Generate the first frame to learn the intrinsic SVG size
  const firstResult = await QRCodeGenerate(qrOptions, undefined, 0);
  const firstSvgBuf = Buffer.from(firstResult.svg, "utf-8");

  // Determine output dimensions
  let outW = gifOptions.width;
  let outH = gifOptions.height;
  if (!outW || !outH) {
    const meta = await sharp(firstSvgBuf).metadata();
    outW = outW ?? meta.width ?? 512;
    outH = outH ?? meta.height ?? 512;
  }

  // Parse background
  let bgColor: { r: number; g: number; b: number; alpha: number } = { r: 0, g: 0, b: 0, alpha: 0 };
  const bg = gifOptions.background;
  if (bg && bg !== "transparent") {
    const hex = bg.replace("#", "");
    if (hex.length === 6 || hex.length === 8) {
      bgColor = {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        alpha: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      };
    }
  }

  const encoder = new GifEncoder(outW, outH, "neuquant", true);
  encoder.setDelay(frameDelay);
  encoder.setRepeat(repeat);
  encoder.setQuality(10);
  encoder.start();

  // Cache the matrix from the first QR call to speed up frame generation
  const cachedMatrix = firstResult.matrix;

  for (let f = 0; f < totalFrames; f++) {
    const secs = cycleDur > 0 ? (f / fps) % cycleDur : 0;

    let svgBuf: Buffer;
    if (f === 0) {
      svgBuf = firstSvgBuf;
    } else {
      const result = await QRCodeGenerate(qrOptions, cachedMatrix, secs);
      svgBuf = Buffer.from(result.svg, "utf-8");
    }

    // Render SVG to raw RGBA
    let pipeline = sharp(svgBuf).resize(outW, outH, {
      fit: "contain",
      background: bgColor,
    });
    const { data } = await pipeline.raw().toBuffer({ resolveWithObject: true });

    encoder.addFrame(data);
  }

  encoder.finish();

  const buf = encoder.out.getData();
  return Buffer.from(buf);
}
