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
   QRValidateResult,
   ValidatorTuning,
   QrDecoration,
   QrDecorationBuiltinShape,
   QrWrapperShape,
   QRMatrix,
   QrOverlay,
   QrLayerFill,
   QrOverlayMask,
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

async function _makeCanvas(svg: string, w: number, h: number): Promise<HTMLCanvasElement | null> {
   if (typeof document === 'undefined') return null;
   return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      img.onload = () => { ctx.drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url); resolve(canvas); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG render failed')); };
      img.src = url;
   });
}

async function _gifExport(
   input: string | Options,
   options: ExportOptions,
): Promise<Uint8Array> {
   const qrOpts = typeof input === 'string' ? ({ ...defaultOptions, data: input } as Options) : input;
   const { svg } = await QRCodeGenerate(qrOpts);
   const { width: svgW, height: svgH } = svgDims(svg);
   const outW = options.width ?? svgW;
   const outH = options.height ?? svgH;
   const bg = parseBg(options.background ?? _inferGifBg(input));
   const fps = options.fps ?? 20;
   const frameDelay = Math.round(100 / fps);
   const repeat = options.repeat ?? 0;
   const frames = await renderSvgBatch([svg], outW, outH, bg);
   return encodeGifFrames(frames, outW, outH, frameDelay, repeat) as Promise<Uint8Array>;
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
   const ecl = opts.qrOptions?.errorCorrectionLevel ?? 'H';
   const analyzer = new QRAnalyzer(opts.data || '', ecl);
   const matrix = analyzer.getMatrix();
   const margin = opts.margin ?? 4;

   const svg = _renderSVG(matrix, opts);
   const { width: svgW, height: svgH } = svgDims(svg);

   return {
      svg,
      matrix,
      validate: async (tuning?: ValidatorTuning) => {
         const canvas = await _makeCanvas(svg, svgW, svgH);
         if (!canvas) {
            return {
               valid: false, contrastRatio: 1, degradedModules: 0, totalModules: 0,
               finderPatternsOk: false, timingPatternsOk: false, eccHeadroom: 0,
               issues: ['validate() requires a browser environment'],
            };
         }
         return validateQRCanvas(canvas, matrix, margin, ecl, tuning);
      },
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

function _partColor(part: QrPartOptions | undefined): string {
   const base = part?.overlays?.find(o => !o.mask);
   if (base?.fill.type === 'color') return base.fill.color;
   if (base?.fill.type === 'gradient') return base.fill.gradient.colorStops[0]?.color ?? '#000000';
   return '#000000';
}

function _renderEyes(matrix: QRMatrix, opts: Options): string {
   const size = matrix.length;
   const sqKey = (opts.cornersSquareOptions?.shape as any)?.path ?? 'square';
   const dotKey = (opts.cornersDotOptions?.shape as any)?.path ?? 'square';
   const sqDraw = cornerSquares[sqKey] ?? cornerSquares['square'];
   const dotDraw = cornerDots[dotKey] ?? cornerDots['square'];
   const sqColor = _partColor(opts.cornersSquareOptions);
   const dotColor = _partColor(opts.cornersDotOptions);

   let svg = '';
   for (const [ex, ey] of [[0, 0], [size - 7, 0], [0, size - 7]] as [number, number][]) {
      svg += `<path d="${sqDraw(ex, ey, 7)}" fill="${sqColor}"/>`;
      svg += `<path d="${dotDraw(ex + 2, ey + 2, 3)}" fill="${dotColor}"/>`;
   }
   return svg;
}

function _renderDots(matrix: QRMatrix, opts: Options): string {
   const dotKey = (opts.dotsOptions?.shape as any)?.path ?? 'square';
   const dotDraw = neighborShapes[dotKey] ?? neighborShapes['square'];
   const dotColor = _partColor(opts.dotsOptions);
   const scale = opts.dotsOptions?.scale ?? 1;
   let pathD = '';

   for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix.length; x++) {
         if (!matrix[y][x].isDark) continue;
         if (matrix[y][x].type !== 'data') continue;
         const n: Neighbors = {
            t: matrix[y - 1]?.[x]?.isDark ?? false,
            r: matrix[y]?.[x + 1]?.isDark ?? false,
            b: matrix[y + 1]?.[x]?.isDark ?? false,
            l: matrix[y]?.[x - 1]?.isDark ?? false,
         };
         pathD += dotDraw(x, y, n, scale);
      }
   }

   return pathD ? `<path d="${pathD}" fill="${dotColor}"/>` : '';
}
