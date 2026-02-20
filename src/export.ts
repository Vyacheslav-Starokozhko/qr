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
    // Use dynamic import to be ESM compatible
    const sharpModule = await import("sharp");
    sharp = sharpModule.default || sharpModule;
  } catch (err) {
    throw new Error(
      "The 'sharp' package is required for PNG/JPEG/WEBP export in Node.js.",
    );
  }
  let pipeline = sharp(svgBuf);

  // Resize only if explicitly requested
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
