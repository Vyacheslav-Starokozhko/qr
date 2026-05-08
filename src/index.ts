import { QRAnalyzer } from "./core/analyzer";
import { analyzeFrame, compressFrame } from "./core/frame-analyzer";
import { validateQRCanvas } from "./core/validator";
import { defaultOptions } from "./default";
import {
  FileExtension,
  ExportOptions,
  parseBg,
  svgDims,
  renderSvgBatch,
  encodeGifFrames,
  sharpRaster,
  canvasRaster,
} from "./export";
import { detectFrameInset } from "./frame-inset";
import {
  invertOptions,
  normalizeOptions,
  RandomizeConfig,
  randomizeOptions,
} from "./randomize";

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
  invertOptions,
  randomizeOptions,
  RandomizeConfig,
  normalizeOptions,
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
  const svg =
    typeof input === "string" ? input : (await QRCodeGenerate(input)).svg;
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
    const matrix = cachedMatrix;
    const margin = merged.margin ?? 4;
    let svg = _renderSVG(matrix, merged);
    if (merged.frameEnable !== false && merged.frame) {
      svg = await _composeWithFrame(svg, merged.frame);
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
  svg += _renderEyes(matrix, opts);
  svg += _renderDots(matrix, opts);
  svg += "</g>";

  // Images (rendered in pixel coords, on top of dots)
  if (opts.imageEnable !== false && opts.images?.length) {
    svg += _renderImages(opts.images, totalSize, margin * scale);
  }

  svg += "</svg>";
  return svg;
}

function _renderImages(
  images: QrImage[],
  totalSize: number,
  marginPx: number,
): string {
  const qrSize = totalSize - 2 * marginPx;
  let svg = "";

  for (const img of images) {
    const w = img.width;
    const h = img.height;
    const pos = img.position;
    let x: number;
    let y: number;

    if (pos?.type === "custom") {
      x = marginPx + (pos.x / 100) * qrSize - w / 2;
      y = marginPx + (pos.y / 100) * qrSize - h / 2;
    } else {
      switch (pos?.type ?? "center") {
        case "top":
          x = (totalSize - w) / 2; y = marginPx; break;
        case "bottom":
          x = (totalSize - w) / 2; y = totalSize - marginPx - h; break;
        case "left":
          x = marginPx; y = (totalSize - h) / 2; break;
        case "right":
          x = totalSize - marginPx - w; y = (totalSize - h) / 2; break;
        case "extra-top":
          x = (totalSize - w) / 2; y = 0; break;
        case "extra-bottom":
          x = (totalSize - w) / 2; y = totalSize - h; break;
        case "extra-left":
          x = 0; y = (totalSize - h) / 2; break;
        case "extra-right":
          x = totalSize - w; y = (totalSize - h) / 2; break;
        default: // center
          x = (totalSize - w) / 2; y = (totalSize - h) / 2;
      }
    }

    const opacityAttr = img.opacity != null ? ` opacity="${img.opacity}"` : "";
    const parAttr = img.preserveAspectRatio
      ? ` preserveAspectRatio="${img.preserveAspectRatio}"`
      : "";
    svg += `<image href="${img.source}" x="${x}" y="${y}" width="${w}" height="${h}"${opacityAttr}${parAttr}/>`;
  }

  return svg;
}

function _partColor(part: QrPartOptions | undefined): string {
  const base = part?.overlays?.find((o) => !o.mask);
  if (base?.fill.type === "color") return base.fill.color;
  if (base?.fill.type === "gradient")
    return base.fill.gradient.colorStops[0]?.color ?? "#000000";
  return "#000000";
}

function _eyePart(
  shape: any,
  x: number,
  y: number,
  size: number,
  color: string,
  figureRegistry: Record<string, (x: number, y: number, s: number) => string>,
): string {
  if (shape?.type === "icon") {
    const icon = shapes[shape.path as keyof typeof shapes];
    if (icon) {
      return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${icon.viewBox}"><path d="${icon.d}" fill="${color}"/></svg>`;
    }
  } else if (shape?.type === "custom-icon") {
    const vb = shape.viewBox ?? "0 0 24 24";
    return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${vb}"><path d="${shape.path}" fill="${color}"/></svg>`;
  } else if (shape?.type === "image-icon") {
    const par = shape.preserveAspectRatio ?? "xMidYMid slice";
    return `<image href="${shape.source}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="${par}"/>`;
  }
  const key = shape?.path ?? "square";
  const draw = figureRegistry[key] ?? figureRegistry["square"];
  return `<path d="${draw(x, y, size)}" fill="${color}"/>`;
}

function _renderEyes(matrix: QRMatrix, opts: Options): string {
  const size = matrix.length;
  const sqShape = opts.cornersSquareOptions?.shape as any;
  const dotShape = opts.cornersDotOptions?.shape as any;
  const sqColor = _partColor(opts.cornersSquareOptions);
  const dotColor = _partColor(opts.cornersDotOptions);

  let svg = "";
  for (const [ex, ey] of [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ] as [number, number][]) {
    svg += _eyePart(sqShape, ex, ey, 7, sqColor, cornerSquares);
    svg += _eyePart(dotShape, ex + 2, ey + 2, 3, dotColor, cornerDots);
  }
  return svg;
}

function _dotIconCell(shape: any, x: number, y: number, size: number, color: string): string {
  if (shape?.type === "icon") {
    const icon = shapes[shape.path as keyof typeof shapes];
    if (icon) {
      return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${icon.viewBox}"><path d="${icon.d}" fill="${color}"/></svg>`;
    }
  } else if (shape?.type === "custom-icon") {
    const vb = shape.viewBox ?? "0 0 24 24";
    return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${vb}"><path d="${shape.path}" fill="${color}"/></svg>`;
  } else if (shape?.type === "image-icon") {
    const par = shape.preserveAspectRatio ?? "xMidYMid slice";
    return `<image href="${shape.source}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="${par}"/>`;
  }
  return "";
}

function _renderDots(matrix: QRMatrix, opts: Options): string {
  const dotShape = opts.dotsOptions?.shape as any;
  const dotColor = _partColor(opts.dotsOptions);
  const scale = opts.dotsOptions?.scale ?? 1;

  if (dotShape?.type === "icon" || dotShape?.type === "custom-icon" || dotShape?.type === "image-icon") {
    const pad = (1 - scale) / 2;
    let svg = "";
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix.length; x++) {
        if (!matrix[y][x].isDark) continue;
        const t = matrix[y][x].type;
        if (t === "pos-finder" || t === "pos-separator") continue;
        svg += _dotIconCell(dotShape, x + pad, y + pad, scale, dotColor);
      }
    }
    return svg || _renderDotsWithFigure(matrix, "square", dotColor, scale);
  }

  const dotKey = dotShape?.path ?? "square";
  return _renderDotsWithFigure(matrix, dotKey, dotColor, scale);
}

function _renderDotsWithFigure(
  matrix: QRMatrix,
  key: string,
  dotColor: string,
  scale: number,
): string {
  const dotDraw = neighborShapes[key] ?? neighborShapes["square"];
  let pathD = "";
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix.length; x++) {
      if (!matrix[y][x].isDark) continue;
      const t = matrix[y][x].type;
      if (t === "pos-finder" || t === "pos-separator") continue;
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
