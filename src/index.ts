import { QRAnalyzer } from "./core/analyzer";
import { analyzeFrame, compressFrame } from "./core/frame-analyzer";
import { validateQRCanvas } from "./core/validator";
import { defaultOptions } from "./default";
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
} from "./export";
import { detectFrameInset } from "./frame-inset";

import { cornerDots } from "./renderer/cornerDot";
import { cornerSquares } from "./renderer/cornerSquare";
import { neighborShapes, Neighbors } from "./renderer/dots";
import { QRShapes, shapes } from "./renderer/icons";
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
  QrFrame,
  QrAnimation,
  QrShape,
  EQrPart,
  ECornerDotFigure,
  ECornerSquareFigure,
  EDotFigure,
  EShapeType,
  Gradient,
  FigureShape,
  QrPart,
  ShapeType,
} from "./types";

export {
  QRShapes,
  FileExtension,
  ExportOptions,
  QrOverlay,
  QrLayerFill,
  QrFrame,
  compressFrame,
  analyzeFrame,
  QrAnimation,
  Options,
  QrImage,
  QrImagePosition,
  QrDecoration,
  QrDecorationBuiltinShape,
  QrWrapperShape,
  QrOverlayMask,
  QrEffect,
  QrShape,
  QrPartOptions,
  EQrPart,
  ECornerDotFigure,
  ECornerSquareFigure,
  EDotFigure,
  EShapeType,
  // Validation
  ValidatorTuning,
  QRValidateResult,
  // Matrix
  QRMatrix,
  // Gradient
  Gradient,
  FigureShape,
  QrPart,
  ShapeType,
};

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
  if (format === "gif") {
    const gifOptions = options.background
      ? options
      : { ...options, background: _inferGifBg(input) };
    return _gifExport(input, gifOptions);
  }

  // All other formats: resolve to an SVG string first
  const svg =
    typeof input === "string" ? input : (await QRCodeGenerate(input)).svg;

  if (format === "svg") {
    return typeof Buffer !== "undefined"
      ? Buffer.from(svg, "utf-8")
      : new TextEncoder().encode(svg);
  }

  if (format === "png" || format === "jpeg" || format === "webp") {
    // Browser: canvas API
    if (typeof document !== "undefined") {
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
  const base = opts.dotsOptions?.overlays?.find((o) => !o.mask);
  if (base?.fill.type === "color") return base.fill.color;
  if (base?.fill.type === "gradient")
    return base.fill.gradient.colorStops[0]?.color ?? "#000000";
  return "#000000";
}

function _inferGifBg(input: string | Options): string {
  if (typeof input === "string") return "#ffffff";
  return input.backgroundOptions?.color || "#ffffff";
}

async function _makeCanvas(
  svg: string,
  w: number,
  h: number,
): Promise<HTMLCanvasElement | null> {
  if (typeof document === "undefined") return null;
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG render failed"));
    };
    img.src = url;
  });
}

async function _gifExport(
  input: string | Options,
  options: ExportOptions,
): Promise<Uint8Array> {
  const qrOpts =
    typeof input === "string"
      ? ({ ...defaultOptions, data: input } as Options)
      : input;
  const { svg } = await QRCodeGenerate(qrOpts);
  const { width: svgW, height: svgH } = svgDims(svg);
  const outW = options.width ?? svgW;
  const outH = options.height ?? svgH;
  const bg = parseBg(options.background ?? _inferGifBg(input));
  const fps = options.fps ?? 20;
  const frameDelay = Math.round(100 / fps);
  const repeat = options.repeat ?? 0;
  const frames = await renderSvgBatch([svg], outW, outH, bg);
  return encodeGifFrames(
    frames,
    outW,
    outH,
    frameDelay,
    repeat,
  ) as Promise<Uint8Array>;
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

async function _composeWithFrame(
  qrSvg: string,
  frame: QrFrame,
): Promise<string> {
  const userInset = frame.inset;
  let inset: { x: number; y: number; width: number; height: number };

  if (userInset && userInset.x != null && userInset.y != null) {
    inset = {
      x: userInset.x,
      y: userInset.y,
      width: userInset.width,
      height: userInset.height,
    };
  } else {
    const detected = await detectFrameInset(
      frame.source,
      frame.width,
      frame.height,
    );
    if (detected) {
      const iw = userInset?.width ?? detected.width;
      const ih = userInset?.height ?? detected.height;
      inset = {
        x: userInset?.x ?? Math.round(detected.x + (detected.width - iw) / 2),
        y: userInset?.y ?? Math.round(detected.y + (detected.height - ih) / 2),
        width: iw,
        height: ih,
      };
    } else {
      const fw = Math.round(frame.width * 0.8);
      const fh = Math.round(frame.height * 0.8);
      inset = {
        x: Math.round((frame.width - fw) / 2),
        y: Math.round((frame.height - fh) / 2),
        width: fw,
        height: fh,
      };
    }
  }

  const qrDisplaySize = Math.min(inset.width, inset.height);
  const qrX = inset.x + (inset.width - qrDisplaySize) / 2;
  const qrY = inset.y + (inset.height - qrDisplaySize) / 2;
  const { width: qrTotalSize } = svgDims(qrSvg);
  const innerContent = qrSvg
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "");

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${frame.width}" height="${frame.height}" viewBox="0 0 ${frame.width} ${frame.height}"><image href="${frame.source}" x="0" y="0" width="${frame.width}" height="${frame.height}" preserveAspectRatio="xMidYMid meet"/><svg x="${qrX}" y="${qrY}" width="${qrDisplaySize}" height="${qrDisplaySize}" viewBox="0 0 ${qrTotalSize} ${qrTotalSize}">${innerContent}</svg></svg>`;
}

/**
 * Run the frame inset auto-detection and return the detected QR area rectangle
 * (in display pixels). Use this to debug auto-positioning or to generate an
 * explicit `frame.inset` when detection fails.
 */
export async function calibrateFrame(
  source: string,
  frameWidth: number,
  frameHeight: number,
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return detectFrameInset(source, frameWidth, frameHeight);
}

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
export async function QRCodeGenerate(
  options: Options,
): Promise<QRCodeGenerateResult> {
  const opts = { ...defaultOptions, ...options };
  const ecl = opts.qrOptions?.errorCorrectionLevel ?? "H";
  const analyzer = new QRAnalyzer(opts.data || "", ecl);
  const matrix = analyzer.getMatrix();
  const margin = opts.margin ?? 4;

  let svg = _renderSVG(matrix, opts);

  if (opts.frameEnable !== false && opts.frame) {
    svg = await _composeWithFrame(svg, opts.frame);
  }

  const { width: svgW, height: svgH } = svgDims(svg);

  return {
    svg,
    matrix,
    validate: async (tuning?: ValidatorTuning) => {
      const canvas = await _makeCanvas(svg, svgW, svgH);
      if (!canvas) {
        return {
          valid: false,
          contrastRatio: 1,
          degradedModules: 0,
          totalModules: 0,
          finderPatternsOk: false,
          timingPatternsOk: false,
          eccHeadroom: 0,
          issues: ["validate() requires a browser environment"],
        };
      }
      return validateQRCanvas(canvas, matrix, margin, ecl, tuning);
    },
  };
}

// ---------------------------------------------------------------------------
// Live handle — createQRCode
// ---------------------------------------------------------------------------

/**
 * A live QR code handle returned by {@link createQRCode}.
 * Call {@link QRCodeHandle.update} to re-render with new options — the QR
 * matrix is cached and reused when `data` and `errorCorrectionLevel` are
 * unchanged, so style-only updates skip the expensive encoding step.
 */
export interface QRCodeHandle extends QRCodeGenerateResult {
  update(partialOptions: Partial<Options>): Promise<QRCodeHandle>;
}

/**
 * Create a stateful QR code instance that supports incremental updates.
 *
 * Unlike {@link QRCodeGenerate}, the handle caches the QR matrix and only
 * re-encodes when `data` or `errorCorrectionLevel` changes. Style-only
 * changes (colors, shapes, overlays, …) re-render the SVG directly.
 *
 * @example
 * const qr = await createQRCode({ data: 'https://example.com', width: 400 });
 * document.body.innerHTML = qr.svg;
 *
 * await qr.update({ dotsOptions: { overlays: [{ fill: { type: 'color', color: '#e11d48' } }] } });
 * document.body.innerHTML = qr.svg;
 */
export async function createQRCode(
  initialOptions: Options,
): Promise<QRCodeHandle> {
  let opts: Options = { ...initialOptions };
  let cachedMatrix: QRMatrix | null = null;
  let cachedData = "";
  let cachedEcl = "";

  async function build(): Promise<QRCodeGenerateResult> {
    const merged = { ...defaultOptions, ...opts };
    const ecl = merged.qrOptions?.errorCorrectionLevel ?? "H";
    const data = merged.data ?? "";
    if (!cachedMatrix || data !== cachedData || ecl !== cachedEcl) {
      cachedMatrix = new QRAnalyzer(data, ecl).getMatrix();
      cachedData = data;
      cachedEcl = ecl;
    }
    return QRCodeGenerate(opts);
  }

  const initial = await build();
  const handle: QRCodeHandle = {
    svg: initial.svg,
    matrix: initial.matrix,
    validate: initial.validate,
    async update(partialOptions: Partial<Options>): Promise<QRCodeHandle> {
      opts = { ...opts, ...partialOptions };
      const result = await build();
      handle.svg = result.svg;
      handle.matrix = result.matrix;
      handle.validate = result.validate;
      return handle;
    },
  };
  return handle;
}

// ---------------------------------------------------------------------------
// DOM utility — crossFadeQR
// ---------------------------------------------------------------------------

export interface CrossFadeOptions {
  /** Cross-fade duration in ms. 0 = instant swap. Default: 250. */
  duration?: number;
  /** CSS easing. Default: "ease-in-out". */
  easing?: string;
}

/**
 * Swap the QR SVG inside `container` with a smooth cross-fade.
 *
 * The container must have `position: relative` (or absolute/fixed).
 * The incoming SVG is overlaid on top and faded in while the outgoing one
 * fades out, then the outgoing element is removed.
 *
 * @example
 * const qr = await createQRCode({ data: 'https://example.com', width: 400 });
 * container.innerHTML = qr.svg;
 *
 * await qr.update({ dotsOptions: { overlays: [{ fill: { type: 'color', color: '#e11d48' } }] } });
 * await crossFadeQR(container, qr.svg);
 */
export async function crossFadeQR(
  container: Element,
  newSvg: string,
  options: CrossFadeOptions = {},
): Promise<void> {
  const duration = options.duration ?? 250;
  const easing = options.easing ?? "ease-in-out";

  const outgoing = container.firstElementChild as HTMLElement | null;

  const incoming = document.createElement("div");
  incoming.style.cssText = "position:absolute;inset:0;opacity:0;";
  incoming.innerHTML = newSvg;
  container.appendChild(incoming);

  if (!duration || !outgoing) {
    if (outgoing) outgoing.remove();
    incoming.style.cssText = "";
    return;
  }

  await incoming.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration,
    easing,
    fill: "forwards",
  }).finished;

  outgoing.remove();
  incoming.style.cssText = "";
}

// ─── Rendering Internals ───────────────────────────────────────────────────

function _renderSVG(matrix: QRMatrix, opts: Options): string {
  const margin = opts.margin ?? 4;
  const size = matrix.length + margin * 2;
  const scale = opts.width ? opts.width / size : 20;
  const totalSize = size * scale;

  const bg = opts.backgroundEnable
    ? opts.backgroundOptions?.color || "#ffffff"
    : "none";

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}">`;

  // Background
  if (bg !== "none") {
    svg += `<rect width="100%" height="100%" fill="${bg}" />`;
  }

  // Dots & Eyes
  svg += `<g transform="translate(${margin * scale}, ${margin * scale}) scale(${scale})">`;

  // Finder Patterns (Eyes)
  svg += _renderEyes(matrix, opts);

  // Data Modules (Dots)
  svg += _renderDots(matrix, opts);

  svg += "</g></svg>";
  return svg;
}

function _partColor(part: QrPartOptions | undefined): string {
  const base = part?.overlays?.find((o) => !o.mask);
  if (base?.fill.type === "color") return base.fill.color;
  if (base?.fill.type === "gradient")
    return base.fill.gradient.colorStops[0]?.color ?? "#000000";
  return "#000000";
}

function _renderEyes(matrix: QRMatrix, opts: Options): string {
  const size = matrix.length;
  const sqKey = (opts.cornersSquareOptions?.shape as any)?.path ?? "square";
  const dotKey = (opts.cornersDotOptions?.shape as any)?.path ?? "square";
  const sqDraw = cornerSquares[sqKey] ?? cornerSquares["square"];
  const dotDraw = cornerDots[dotKey] ?? cornerDots["square"];
  const sqColor = _partColor(opts.cornersSquareOptions);
  const dotColor = _partColor(opts.cornersDotOptions);

  let svg = "";
  for (const [ex, ey] of [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ] as [number, number][]) {
    svg += `<path d="${sqDraw(ex, ey, 7)}" fill="${sqColor}"/>`;
    svg += `<path d="${dotDraw(ex + 2, ey + 2, 3)}" fill="${dotColor}"/>`;
  }
  return svg;
}

function _renderDots(matrix: QRMatrix, opts: Options): string {
  const dotKey = (opts.dotsOptions?.shape as any)?.path ?? "square";
  const dotDraw = neighborShapes[dotKey] ?? neighborShapes["square"];
  const dotColor = _partColor(opts.dotsOptions);
  const scale = opts.dotsOptions?.scale ?? 1;
  let pathD = "";

  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix.length; x++) {
      if (!matrix[y][x].isDark) continue;
      if (matrix[y][x].type !== "data") continue;
      const n: Neighbors = {
        t: matrix[y - 1]?.[x]?.isDark ?? false,
        r: matrix[y]?.[x + 1]?.isDark ?? false,
        b: matrix[y + 1]?.[x]?.isDark ?? false,
        l: matrix[y]?.[x - 1]?.isDark ?? false,
      };
      pathD += dotDraw(x, y, n, scale);
    }
  }

  return pathD ? `<path d="${pathD}" fill="${dotColor}"/>` : "";
}
