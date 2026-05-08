import { QRAnalyzer } from './core/analyzer';
import { validateQRCanvas } from './core/validator';
import { defaultOptions } from './default';
import {
   FileExtension,
   ExportOptions,
   parseBg,
   svgDims,
   svgToRgba,
   renderSvgBatch,
   encodeGifFrames,
   sharpRaster,
   canvasRaster,
} from './export';
import { detectFrameInset } from './frame-inset';
import { cornerDots } from './renderer/cornerDot';
import { cornerSquares } from './renderer/cornerSquare';
import { neighborShapes, Neighbors } from './renderer/dots';
import { QRShapes, shapes } from './renderer/icons';
import {
   Options,
   QrPartOptions,
   QrImage,
   QrImagePosition,
   Gradient,
   QRValidateResult,
   ValidatorTuning,
   QrDecoration,
   QrDecorationBuiltinShape,
   QrWrapperShape,
   QRMatrix,
   QrOverlay,
   QrLayerFill,
   QrOverlayMask,
   QrAnimation,
   QrEffect,
} from './types';

export { QRShapes, FileExtension, ExportOptions, QrOverlay, QrLayerFill };

/**
 * Export a QR code to any format.
 *
 * - **svg / png / jpeg / webp**: pass a pre-rendered SVG string as `input`.
 *   png/jpeg/webp require `sharp` (Node.js). svg works everywhere.
 * - **gif**: pass either an SVG string (→ static single-frame GIF) or the
 *   original `Options` object (→ animated GIF with all animation keyframes
 *   baked in). Works in **browser and Node.js** — no backend required.
 *
 * @example
 * const { svg } = await QRCodeGenerate({ data: 'https://example.com' });
 * const png = await exportQR(svg, 'png', { width: 1000 });
 *
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
): Promise<Buffer | Uint8Array> {
   // GIF has no true alpha — always ensure a solid background.
   // Priority: caller's explicit `options.background` → QR's own bg color → white.
   if (format === 'gif') {
      const gifOptions = options.background
         ? options
         : { ...options, background: _inferGifBg(input) };
      return _gifExport(input, gifOptions);
   }

   // All other formats: resolve to an SVG string first
   const svg = typeof input === 'string' ? input : (await QRCodeGenerate(input)).svg;

   if (format === 'svg') {
      return typeof Buffer !== 'undefined'
         ? Buffer.from(svg, 'utf-8')
         : new TextEncoder().encode(svg);
   }

   if (format === 'png' || format === 'jpeg' || format === 'webp') {
      // Browser: canvas API
      if (typeof document !== 'undefined') {
         return canvasRaster(svg, format, options);
      }
      // Node.js: sharp
      return sharpRaster(svg, format, options);
   }

   throw new Error(
      `[exportQR] Unknown format: "${format}". Use: svg | png | jpeg | webp | gif`,
   );
}

/** sRGB hex → WCAG relative luminance (0–1). */
function _luminance(hex: string): number {
   const { r, g, b } = parseBg(hex);
   const lin = (c: number) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
   };
   return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Pick the representative dot color from the first overlay base layer. */
function _dotColor(opts: Options): string {
   const base = opts.dotsOptions?.overlays?.find(o => !o.mask);
   if (base?.fill.type === 'color') return base.fill.color;
   if (base?.fill.type === 'gradient')
      return base.fill.gradient.colorStops[0]?.color ?? '#000000';
   return '#000000';
}

function _inferGifBg(input: string | Options): string {
   if (typeof input === 'string') return '#ffffff';
   return input.backgroundOptions?.color || '#ffffff';
}

async function _gifExport(
   input: string | Options,
   options: ExportOptions,
): Promise<Uint8Array> {
   const opts = typeof input === 'string' ? { ...defaultOptions, data: input } : input;
   const frames = await renderSvgBatch(opts, options);
   return encodeGifFrames(frames, options);
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

export type QRCodeGenerateResult = {
   svg: string;
   matrix: QRMatrix;
   /**
    * Run the pixel-based validator on the current QR output.
    * Scans the rendered SVG against the source matrix to detect any
    * scannability issues caused by custom shapes, colors, or overlays.
    */
   validate: (tuning?: ValidatorTuning) => Promise<QRValidateResult>;
};

/**
 * Generate a QR code SVG string.
 *
 * @example
 * const { svg } = await QRCodeGenerate({
 *   data: "Hello World",
 *   dotsOptions: { shape: { type: "figure", path: "rounded" } }
 * });
 */
export async function QRCodeGenerate(options: Options): Promise<QRCodeGenerateResult> {
   const opts = { ...defaultOptions, ...options };
   const analyzer = new QRAnalyzer(opts.data || '', opts);
   const matrix = analyzer.getMatrix();

   // 1. Generate core SVG
   const svg = _renderSVG(matrix, opts);

   // 2. Return result + validator helper
   return {
      svg,
      matrix,
      validate: (tuning?: ValidatorTuning) => validateQRCanvas(svg, matrix, tuning),
   };
}

// ─── Rendering Internals ───────────────────────────────────────────────────

function _renderSVG(matrix: QRMatrix, opts: Options): string {
   const margin = opts.margin ?? 4;
   const size = matrix.length + margin * 2;
   const scale = opts.width ? opts.width / size : 20;
   const totalSize = size * scale;

   const bg = opts.backgroundEnable ? opts.backgroundOptions?.color || '#ffffff' : 'none';

   let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}">`;

   // Background
   if (bg !== 'none') {
      svg += `<rect width="100%" height="100%" fill="${bg}" />`;
   }

   // Dots & Eyes
   svg += `<g transform="translate(${margin * scale}, ${margin * scale}) scale(${scale})">`;

   // Finder Patterns (Eyes)
   svg += _renderEyes(matrix, opts);

   // Data Modules (Dots)
   svg += _renderDots(matrix, opts);

   svg += '</g></svg>';
   return svg;
}

function _renderEyes(matrix: QRMatrix, opts: Options): string {
   const size = matrix.length;
   let svg = '';

   // Top Left
   svg += cornerSquares.render(0, 0, opts.cornersSquareOptions);
   svg += cornerDots.render(0, 0, opts.cornersDotOptions);

   // Top Right
   svg += cornerSquares.render(size - 7, 0, opts.cornersSquareOptions);
   svg += cornerDots.render(size - 7, 0, opts.cornersDotOptions);

   // Bottom Left
   svg += cornerSquares.render(0, size - 7, opts.cornersSquareOptions);
   svg += cornerDots.render(0, size - 7, opts.cornersDotOptions);

   return svg;
}

function _renderDots(matrix: QRMatrix, opts: Options): string {
   const neighbors = new Neighbors(matrix);
   let svg = '';

   for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix.length; x++) {
         if (!matrix[y][x].isDark) continue;
         if (matrix[y][x].type !== 'data') continue;

         const shape = opts.dotsOptions?.shape || { type: 'figure', path: 'square' };
         svg += neighborShapes.render(x, y, shape, neighbors, opts.dotsOptions);
      }
   }

   return svg;
}
