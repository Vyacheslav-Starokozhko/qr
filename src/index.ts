import { QRAnalyzer } from "./core/analyzer";
import { validateQRCanvas } from "./core/validator";
import { QRShapes, shapes } from "./renderer/icons";
import { neighborShapes, Neighbors } from "./renderer/dots";
import { cornerDots } from "./renderer/cornerDot";
import { cornerSquares } from "./renderer/cornerSquare";
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
  QrOverlayMask,
  QrAnimation,
  QrEffect,
} from "./types";
import { detectFrameInset } from "./frame-inset";
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
import { defaultOptions } from "./default";

export { QRShapes, FileExtension, ExportOptions };

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

/**
 * Infer a solid GIF background that contrasts with the QR's dot color.
 * Priority: explicit bg color on the options → contrast-safe fallback (white or black).
 */
function _inferGifBg(input: string | Options): string {
  if (typeof input === "string") return "#ffffff";
  const qrOpts = input as Options;
  // Explicit non-transparent bg — use it directly.
  if (qrOpts.backgroundEnable !== false) {
    const c = qrOpts.backgroundOptions?.color;
    if (c && c !== "transparent") return c;
  }
  // No bg (or transparent) — pick white or black based on dot luminance.
  const dotLum = _luminance(_dotColor(qrOpts));
  // WCAG contrast ratio = (lighter + 0.05) / (darker + 0.05).
  // White bg lum = 1 → ratio with dots = (1.05) / (dotLum + 0.05).
  // Black bg lum = 0 → ratio with dots = (dotLum + 0.05) / 0.05.
  const contrastOnWhite = 1.05 / (dotLum + 0.05);
  const contrastOnBlack = (dotLum + 0.05) / 0.05;
  return contrastOnWhite >= contrastOnBlack ? "#ffffff" : "#000000";
}

/** @deprecated Use `exportQR(qrOptions, 'gif', options)` instead. */
export async function exportGIF(
  qrOptions: Options,
  gifOptions: ExportOptions = {},
): Promise<Buffer | Uint8Array> {
  return _gifExport(qrOptions, gifOptions);
}

async function _gifExport(
  input: string | Options,
  opts: ExportOptions,
): Promise<Buffer | Uint8Array> {
  const fps = Math.max(1, Math.min(50, opts.fps ?? 20));
  const cycles = Math.max(1, opts.cycles ?? 1);
  const repeat = opts.repeat ?? 0;
  const bg = parseBg(opts.background);
  const isSvgString = typeof input === "string";

  let cycleDur = 0;
  if (!isSvgString) {
    const qrOpts = input as Options;
    const animList = qrOpts.animation
      ? Array.isArray(qrOpts.animation)
        ? qrOpts.animation
        : [qrOpts.animation]
      : [];
    cycleDur = getAnimationDuration(animList);
  }

  const totalFrames = cycleDur > 0 ? Math.round(cycleDur * cycles * fps) : 1;
  const frameDelay = Math.round(1000 / fps);

  // Generate frame 0 once — reuse both svg and matrix (avoids double QRCodeGenerate)
  let firstSvg: string;
  let cachedMatrix: import("./types").QRMatrix | undefined;
  if (isSvgString) {
    firstSvg = input as string;
  } else {
    const first = await QRCodeGenerate(input as Options, undefined, 0);
    firstSvg = first.svg;
    cachedMatrix = first.matrix;
  }

  const intrinsic = svgDims(firstSvg);
  const outW = opts.width ?? intrinsic.width;
  const outH = opts.height ?? intrinsic.height;

  // Build all SVG strings first (pure CPU — fast string construction)
  const svgs: string[] = [firstSvg];
  for (let f = 1; f < totalFrames; f++) {
    if (isSvgString) {
      svgs.push(firstSvg);
    } else {
      const { svg } = await QRCodeGenerate(
        input as Options,
        cachedMatrix,
        (f / fps) % cycleDur,
      );
      svgs.push(svg);
    }
  }

  // Batch-render all SVGs to RGBA (canvas reuse in browser, parallel in Node.js)
  const frames = await renderSvgBatch(svgs, outW, outH, bg);

  // Encode: global palette + frame deduplication handled inside encodeGifFrames
  return encodeGifFrames(frames, outW, outH, frameDelay, repeat);
}

export * from "./types";
export { randomizeOptions, invertOptions, normalizeOptions } from "./randomize";
export type { RandomizeConfig, RandomizeTuning } from "./randomize";
export { analyzeFrame, compressFrame } from "./core/frame-analyzer";
export type {
  FrameAnalysis,
  FrameSource,
  CompressFrameOptions,
  CompressFrameResult,
} from "./core/frame-analyzer";

// --- Helpers ---

type ZoneType = "dots" | "cornerSquare" | "cornerDot";

function getModuleZone(x: number, y: number, size: number): ZoneType {
  const inTL = x >= 0 && x < 7 && y >= 0 && y < 7;
  const inTR = x >= size - 7 && x < size && y >= 0 && y < 7;
  const inBL = x >= 0 && x < 7 && y >= size - 7 && y < size;

  if (inTL || inTR || inBL) {
    let localX = x;
    let localY = y;
    if (inTR) localX = x - (size - 7);
    if (inBL) localY = y - (size - 7);

    if (localX >= 2 && localX <= 4 && localY >= 2 && localY <= 4) {
      return "cornerDot";
    }
    return "cornerSquare";
  }
  return "dots";
}

function getEyePositions(matrixSize: number, padding: number) {
  return [
    { id: "tl", x: padding, y: padding },
    { id: "tr", x: matrixSize - 7 + padding, y: padding },
    { id: "bl", x: padding, y: matrixSize - 7 + padding },
  ];
}

function isInnerEyeStart(x: number, y: number, size: number): boolean {
  return (x === 2 && y === 2) ||
         (x === size - 5 && y === 2) ||
         (x === 2 && y === size - 5);
}

function isOuterEyeStart(x: number, y: number, size: number): boolean {
  return (x === 0 && y === 0) ||
         (x === size - 7 && y === 0) ||
         (x === 0 && y === size - 7);
}

// Gradient generator bound to a specific zone (bx, by, bw, bh)
function generateGradientDef(
  id: string,
  grad: Gradient,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): string {
  const stops = grad.colorStops
    .map((s) => `<stop offset="${s.offset}" stop-color="${s.color}" />`)
    .join("");

  const angle = (grad.rotation || 0) * (Math.PI / 180);

  // Zone center
  const cx = bx + bw / 2;
  const cy = by + bh / 2;

  // Radius (half the diagonal)
  const r = Math.sqrt(bw * bw + bh * bh) / 2;

  if (grad.type === "radial") {
    return `
      <radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fx="${cx.toFixed(2)}" fy="${cy.toFixed(2)}">
        ${stops}
      </radialGradient>
    `;
  }

  const x1 = (cx - r * Math.cos(angle)).toFixed(2);
  const y1 = (cy - r * Math.sin(angle)).toFixed(2);
  const x2 = (cx + r * Math.cos(angle)).toFixed(2);
  const y2 = (cy + r * Math.sin(angle)).toFixed(2);

  return `
      <linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
        ${stops}
      </linearGradient>
    `;
}

/** Generates an SVG `<pattern>` element whose tile has a transparent background.
 *  The geometric shape is filled with `fillRef` (a colour or `url(#gradient)`).
 *  Stacking multiple such patterns on a dots/eye mask produces layered effects. */
function generateMaskPatternDef(
  id: string,
  mask: QrOverlayMask,
  fillRef: string,
  fullSize: number,
): string {
  if (mask.type === "custom") {
    const tw = mask.tileWidth ?? 10;
    const th = mask.tileHeight ?? 10;
    return `<pattern id="${id}" width="${tw}" height="${th}" patternUnits="userSpaceOnUse"><path d="${mask.path}" fill="${fillRef}"/></pattern>`;
  }

  const s = mask.scale ?? 3;
  const cx = fullSize / 2,
    cy = fullSize / 2;

  switch (mask.type) {
    case "stripe": {
      const a = mask.angle ?? 45;
      // One filled stripe + one transparent gap per tile
      return `<pattern id="${id}" width="${s * 2}" height="${s * 2}" patternUnits="userSpaceOnUse" patternTransform="rotate(${a},${cx},${cy})">
        <rect width="${s * 2}" height="${s}" fill="${fillRef}"/>
      </pattern>`;
    }
    case "zigzag": {
      const w = s * 2,
        h = s * 2;
      // Diamond / chevron shapes — transparent background
      return `<pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">
        <polygon points="0,${s} ${s},0 ${w},${s} ${s},${h}" fill="${fillRef}"/>
      </pattern>`;
    }
    case "wave": {
      const w = s * 4,
        h = s * 2;
      // S-curve band — transparent above, filled below the wave boundary
      return `<pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">
        <path d="M0,${h / 2} C${w / 4},0 ${(w * 3) / 4},${h} ${w},${h / 2} L${w},${h} L0,${h} Z" fill="${fillRef}"/>
      </pattern>`;
    }
    case "checker": {
      const w = s * 2,
        h = s * 2;
      return `<pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">
        <rect width="${s}" height="${s}" fill="${fillRef}"/>
        <rect x="${s}" y="${s}" width="${s}" height="${s}" fill="${fillRef}"/>
      </pattern>`;
    }
  }
}

/** Builds all `<defs>` for one overlay layer and returns the resolved fill reference. */
function generateOverlayLayerDef(
  id: string,
  layer: QrOverlay,
  fullSize: number,
): { defs: string; fillRef: string } {
  let defs = "";
  let fillRef: string;

  if (layer.fill.type === "gradient") {
    const gradId = `overlay-grad-${id}`;
    defs += generateGradientDef(
      gradId,
      layer.fill.gradient,
      0,
      0,
      fullSize,
      fullSize,
    );
    fillRef = `url(#${gradId})`;
  } else if (layer.fill.type === "image") {
    const patId = `overlay-img-${id}`;
    const pw = layer.fill.width ?? fullSize;
    const ph = layer.fill.height ?? fullSize;
    defs += `<pattern id="${patId}" x="0" y="0" width="${pw}" height="${ph}" patternUnits="userSpaceOnUse">
      <image href="${layer.fill.source}" x="0" y="0" width="${pw}" height="${ph}" preserveAspectRatio="xMidYMid slice"/>
    </pattern>`;
    fillRef = `url(#${patId})`;
  } else {
    fillRef = layer.fill.color;
  }

  if (layer.mask) {
    const patId = `overlay-pat-${id}`;
    defs += generateMaskPatternDef(patId, layer.mask, fillRef, fullSize);
    fillRef = `url(#${patId})`;
  }

  return { defs, fillRef };
}

function createSymbol(id: string, part: QrPartOptions): string {
  const shape = part.shape;
  if (!shape) return "";

  if (shape.type === "figure") {
    return "";
  }

  if (shape.type === "image-icon") {
    const par = shape.preserveAspectRatio ?? "xMidYMid slice";
    // The symbol is used inside a <mask> where fill="white" has no effect on <image> elements.
    // A feFlood+feComposite filter converts the image to solid white while preserving its alpha,
    // so SVG luminance masking sees white (visible) wherever the image is non-transparent.
    const filterId = `${id}-mask-filter`;
    return `
        <filter id="${filterId}" color-interpolation-filters="sRGB" x="0" y="0" width="1" height="1" filterUnits="objectBoundingBox">
          <feFlood flood-color="white" result="white"/>
          <feComposite in="white" in2="SourceGraphic" operator="in"/>
        </filter>
        <symbol id="${id}" viewBox="0 0 1 1">
          <image href="${shape.source}" x="0" y="0" width="1" height="1" preserveAspectRatio="${par}" filter="url(#${filterId})"/>
        </symbol>
      `;
  }

  if (shape.type === "custom-icon" && shape.path) {
    return `
        <symbol id="${id}" viewBox="${shape.viewBox || "0 0 24 24"}">
          <path d="${shape.path}" />
        </symbol>
      `;
  }

  if (shape.type === "icon" && shape.path) {
    const shapeEntry =
      shapes[shape.path as keyof typeof shapes] || shapes["inner-eye-square"];
    const d = shapeEntry.d;
    const viewBox = shape.viewBox || shapeEntry.viewBox || "0 0 24 24";
    return `
        <symbol id="${id}" viewBox="${viewBox}">
          <path d="${d}" />
        </symbol>
      `;
  }

  return "";
}

// --- Auto-layout for images ---

/** Internal image type with resolved flat x/y coordinates (in matrix modules). */
type ResolvedQrImage = Omit<QrImage, "position"> & {
  x: number;
  y: number;
  /** Clamped width used for dot-exclusion zone (visual width may differ). */
  excW: number;
  /** Clamped height used for dot-exclusion zone (visual height may differ). */
  excH: number;
  /** Clamped margin used for dot-exclusion zone. */
  excMargin: number;
};

/**
 * Max fraction of total QR area that can be safely obscured per error-correction level.
 * Used to derive per-QR maxExclusionSide so small and large QR codes get different limits.
 */
const ECL_SAFE_FRACTION: Record<string, number> = {
  L: 0.07,
  M: 0.15,
  Q: 0.25,
  H: 0.3,
};

/**
 * Clamp an image's exclusion zone (width, height, margin) so it never exceeds
 * the ECL-safe area. Uses step-1 (integer-module) resolution so small QR codes
 * get tighter limits than large ones.
 * The visual image size is unchanged — only the dot-exclusion bounds are clamped.
 */
function clampImageExclusion(
  width: number,
  height: number,
  margin: number,
  matrixSize: number,
  ecl: string,
): { excW: number; excH: number; excMargin: number } {
  const fraction = ECL_SAFE_FRACTION[ecl] ?? 0.3;
  const maxExclusionSide = Math.floor(matrixSize * Math.sqrt(fraction));
  const excW = Math.min(width, maxExclusionSide);
  const excH = Math.min(height, maxExclusionSide);
  const maxMargin = Math.max(
    0,
    Math.floor((maxExclusionSide - Math.max(excW, excH)) / 2),
  );
  return { excW, excH, excMargin: Math.min(margin, maxMargin) };
}

// ─── Critical-zone constants ─────────────────────────────────────────────────
// Each finder pattern is 7×7 modules.  The 1-module-wide separator that
// surrounds it on the inner sides is also forbidden (QR spec requires it to be
// white and unobstructed). Together they form an 8×8 critical zone at every
// corner that images must never cover.
const EYE_SIZE = 7; // finder-pattern width/height in modules
const CRITICAL = 8; // finder + separator = hard exclusion boundary

/** Top-left origins of the 3 finder patterns (in matrix coordinates). */
function getEyeZones(matrixSize: number) {
  return [
    { id: "top-left", x: 0, y: 0 },
    { id: "top-right", x: matrixSize - EYE_SIZE, y: 0 },
    { id: "bottom-left", x: 0, y: matrixSize - EYE_SIZE },
  ];
}

/**
 * Returns true if a rectangle overlaps any critical zone
 * (finder pattern + its 1-module separator = CRITICAL × CRITICAL area).
 */
function overlapsEye(
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  matrixSize: number,
): boolean {
  for (const e of getEyeZones(matrixSize)) {
    if (
      rx < e.x + CRITICAL &&
      rx + rw > e.x &&
      ry < e.y + CRITICAL &&
      ry + rh > e.y
    )
      return true;
  }
  return false;
}

/**
 * Pushes a custom-positioned image out of every critical zone it overlaps.
 * A console.warn is emitted for each adjustment so the caller is aware.
 */
function clampImageFromEyes(
  img: ResolvedQrImage,
  imgIndex: number,
  matrixSize: number,
): ResolvedQrImage {
  let { x, y } = img;

  for (const e of getEyeZones(matrixSize)) {
    const overlapX = x < e.x + CRITICAL && x + img.width > e.x;
    const overlapY = y < e.y + CRITICAL && y + img.height > e.y;
    if (!overlapX || !overlapY) continue;

    // Find the axis with the smallest penetration depth and push out
    const opts = [
      { axis: "x" as const, dir: 1, depth: e.x + CRITICAL - x },
      { axis: "x" as const, dir: -1, depth: x + img.width - e.x },
      { axis: "y" as const, dir: 1, depth: e.y + CRITICAL - y },
      { axis: "y" as const, dir: -1, depth: y + img.height - e.y },
    ]
      .filter((o) => o.depth > 0)
      .sort((a, b) => a.depth - b.depth);

    if (!opts.length) continue;
    const fix = opts[0];
    const origX = x;
    const origY = y;

    if (fix.axis === "x") x = fix.dir > 0 ? e.x + CRITICAL : e.x - img.width;
    else y = fix.dir > 0 ? e.y + CRITICAL : e.y - img.height;

    console.warn(
      `[QR] images[${imgIndex}] overlaps the critical "${e.id}" zone ` +
        `(finder pattern + separator). ` +
        `Auto-adjusted: (${origX.toFixed(1)}, ${origY.toFixed(1)}) → (${x.toFixed(1)}, ${y.toFixed(1)}).`,
    );
  }

  return { ...img, x, y };
}

/**
 * Resolves every QrImage's position into a flat { x, y } coordinate pair.
 *
 * Safe zone layout (mirrors the diagram):
 *
 *   ┌──[CRIT]──┬──[extra-top]──┬──[CRIT]──┐
 *   │  TL eye  │  Safe Zone 2  │  TR eye  │
 *   ├──────────┼───────────────┤          │
 *   │[extra-   │               │[extra-   │
 *   │  left]   │  Safe Zone 1  │  right]  │
 *   │ Zone 2   │    (center)   │  Zone 4  │
 *   │          │               │          │
 *   ├──[CRIT]──┴──[extra-bot]──┴──────────┤
 *   │  BL eye  │  Safe Zone 2  │          │
 *   └──────────┴───────────────┴──────────┘
 *
 * Critical zone = finder pattern (7×7) + 1-module separator = CRITICAL (8)
 * from each occupied corner. Images are never placed inside these areas.
 *
 * Named positions:
 *  "center"        → Safe Zone 1: centred in the full matrix
 *  "top"           → upper quarter of the inner data zone (between top eyes and centre)
 *  "bottom"        → lower quarter of the inner data zone
 *  "left"          → left quarter of the inner data zone
 *  "right"         → right quarter of the inner data zone
 *  "extra-top"     → Safe Zone 2: top border strip, centred between TL and TR eyes;
 *                    image centred within the EYE_SIZE-module eye band vertically
 *  "extra-bottom"  → Safe Zone 2: bottom border strip, aligned with BL eye row;
 *                    image centred within the EYE_SIZE-module eye band vertically
 *  "extra-left"    → Safe Zone 2: left border strip, centred between TL and BL eyes;
 *                    image centred within the EYE_SIZE-module eye band horizontally
 *  "extra-right"   → Safe Zone 4: right border strip, aligned with TR eye column;
 *                    image centred within the EYE_SIZE-module eye band horizontally
 *  "custom"        → explicit x/y (auto-clamped out of critical zones with a warning)
 */
function resolveImagePositions(
  images: QrImage[],
  matrixSize: number,
  ecl: string,
): ResolvedQrImage[] {
  // Inner data zone — starts after finder + separator on each side
  const dataStart = CRITICAL; // = 8
  const dataEnd = matrixSize - CRITICAL;
  const dataSize = dataEnd - dataStart;
  const cx = matrixSize / 2;
  const cy = matrixSize / 2;

  /** Compute the top-left x/y for a named position type. */
  function namedCenter(
    type: NonNullable<Exclude<QrImagePosition, { type: "custom" }>["type"]>,
    w: number,
    h: number,
  ): { x: number; y: number } {
    switch (type) {
      // ── inner data-zone positions (Safe Zones 1, 3, 4) ──────────────────
      case "top":
        return { x: cx - w / 2, y: dataStart + dataSize * 0.25 - h / 2 };
      case "bottom":
        return { x: cx - w / 2, y: dataStart + dataSize * 0.75 - h / 2 };
      case "left":
        return { x: dataStart + dataSize * 0.25 - w / 2, y: cy - h / 2 };
      case "right":
        return { x: dataStart + dataSize * 0.75 - w / 2, y: cy - h / 2 };

      // ── border-strip positions (Safe Zone 2 / 4) ─────────────────────────
      //
      // Rules for "extra-*":
      //  • Parallel axis  (along the border): centred in the SAFE GAP between
      //    the two relevant critical zones: gap = [CRITICAL, matrixSize-CRITICAL].
      //    Centre = matrixSize/2.
      //  • Perpendicular axis (into the QR): centred within EYE_SIZE modules,
      //    clamped ≥ 0 so the image never sticks out of the QR boundary.
      //
      // extra-top  — top border, Safe Zone 2
      //   gap: x ∈ [CRITICAL, matrixSize-CRITICAL]  (between TL and TR)
      //   band: y ∈ [0, EYE_SIZE-1]
      case "extra-top":
        return {
          x: cx - w / 2,
          y: Math.max(0, (EYE_SIZE - h) / 2),
        };

      // extra-bottom — bottom border, Safe Zone 2
      //   gap: x ∈ [CRITICAL, matrixSize]  (BL eye on left, nothing on right)
      //         → use matrixSize/2 for visual symmetry; clamping handles BL
      //   band: y ∈ [matrixSize-EYE_SIZE, matrixSize-1]
      case "extra-bottom":
        return {
          x: cx - w / 2,
          y: matrixSize - EYE_SIZE + Math.max(0, (EYE_SIZE - h) / 2),
        };

      // extra-left — left border, Safe Zone 2
      //   gap: y ∈ [CRITICAL, matrixSize-CRITICAL]  (between TL and BL)
      //   band: x ∈ [0, EYE_SIZE-1]
      case "extra-left":
        return {
          x: Math.max(0, (EYE_SIZE - w) / 2),
          y: cy - h / 2,
        };

      // extra-right — right border, Safe Zone 4
      //   gap: y ∈ [CRITICAL, matrixSize]  (TR eye on top, nothing below)
      //         → use matrixSize/2 for visual symmetry; clamping handles TR
      //   band: x ∈ [matrixSize-EYE_SIZE, matrixSize-1]
      case "extra-right":
        return {
          x: matrixSize - EYE_SIZE + Math.max(0, (EYE_SIZE - w) / 2),
          y: cy - h / 2,
        };

      case "center":
      default:
        return { x: cx - w / 2, y: cy - h / 2 };
    }
  }

  return images.map((img, globalIdx) => {
    const pos = img.position;
    const { source, excludeDots, opacity, preserveAspectRatio } = img;

    // Convert 0-100 percentage inputs to module units
    const width = (img.width / 100) * matrixSize;
    const height = (img.height / 100) * matrixSize;
    const imgMarginModules = ((img.margin ?? 0) / 100) * matrixSize;

    const { excW, excH, excMargin } =
      excludeDots && img.margin != null
        ? clampImageExclusion(width, height, imgMarginModules, matrixSize, ecl)
        : { excW: width, excH: height, excMargin: imgMarginModules };

    const base = {
      source,
      width,
      height,
      excludeDots,
      margin: img.margin,
      opacity,
      preserveAspectRatio,
      excW,
      excH,
      excMargin,
    };

    if (pos?.type === "custom") {
      // custom x/y are also percentages → convert to modules
      const xm = (pos.x / 100) * matrixSize;
      const ym = (pos.y / 100) * matrixSize;
      const resolved: ResolvedQrImage = { ...base, x: xm, y: ym };
      return overlapsEye(xm, ym, width, height, matrixSize)
        ? clampImageFromEyes(resolved, globalIdx, matrixSize)
        : resolved;
    }

    // Named auto-position (covers all non-custom variants)
    const type = (pos?.type ?? "center") as NonNullable<
      Exclude<QrImagePosition, { type: "custom" }>["type"]
    >;
    const { x, y } = namedCenter(type, width, height);
    return { ...base, x, y };
  });
}

// --- Figure helpers ---

function getNeighbors(
  x: number,
  y: number,
  matrix: import("./types").QRMatrix,
  size: number,
): Neighbors {
  return {
    t: y > 0 && matrix[y - 1][x]?.isDark,
    r: x < size - 1 && matrix[y][x + 1]?.isDark,
    b: y < size - 1 && matrix[y + 1][x]?.isDark,
    l: x > 0 && matrix[y][x - 1]?.isDark,
  };
}

/** Return the top-left corner of the eye (finder pattern) that contains (x, y). */
function getEyeOrigin(
  x: number,
  y: number,
  size: number,
): { ex: number; ey: number } | null {
  const origins = [
    { ex: 0, ey: 0 },
    { ex: size - 7, ey: 0 },
    { ex: 0, ey: size - 7 },
  ];
  for (const o of origins) {
    if (x >= o.ex && x < o.ex + 7 && y >= o.ey && y < o.ey + 7) return o;
  }
  return null;
}

// --- validateQR ---

/**
 * Validates a rendered QR SVG against the source options.
 *
 * Renders the SVG to an off-screen canvas, then samples every module against
 * the expected QR matrix (derived from `options.data` and ECL) to detect
 * contrast problems, degraded finder/timing patterns, and ECC headroom.
 *
 * Requires a browser environment (uses `document` + Canvas API).
 *
 * @param svg     — SVG string produced by {@link QRCodeGenerate}.
 * @param options — The same options object used to generate the SVG.
 */
export async function validateQR(
  svg: string,
  options: Options,
  tuning?: ValidatorTuning,
): Promise<QRValidateResult> {
  const fail = (msg: string): QRValidateResult => ({
    valid: false,
    contrastRatio: 1,
    degradedModules: 0,
    totalModules: 0,
    finderPatternsOk: false,
    timingPatternsOk: false,
    eccHeadroom: 0,
    issues: [msg],
  });

  if (typeof document === "undefined") {
    return fail("validateQR() requires a browser environment");
  }

  const config = { ...defaultOptions, ...options };
  const ecl = config.qrOptions?.errorCorrectionLevel ?? "H";
  const matrix = new QRAnalyzer(config.data ?? "", ecl).getMatrix();
  const matrixSize = matrix.length;

  const margin = ((config.margin ?? 10) / 100) * matrixSize;
  const clampedBR =
    config.borderRadius != null
      ? Math.max(0, Math.min(100, config.borderRadius))
      : 0;
  const _c = _wrapperSafeC(config.wrapper, clampedBR);
  const minSafeMargin = _c > 0 && _c < 1 ? (_c * matrixSize) / (2 * (1 - _c)) : 0;
  const effectiveMargin = Math.max(margin, minSafeMargin);

  const wMatch = svg.match(/\bwidth="([\d.]+)"/);
  const hMatch = svg.match(/\bheight="([\d.]+)"/);
  const w = wMatch ? parseFloat(wMatch[1]) : (config.width ?? 1000);
  const h = hMatch ? parseFloat(hMatch[1]) : (config.height ?? 1000);

  const canvas = await svgToCanvas(svg, w, h);
  if (!canvas)
    return fail("validateQR() requires a browser environment (canvas is null)");

  return validateQRCanvas(canvas, matrix, effectiveMargin, ecl, tuning);
}

// --- Main Function ---

/**
 * Static slider/input maximums for this QR code.
 * Recomputed only when `data` or `errorCorrectionLevel` changes.
 */
export interface QRMaxValues {
  /** Max image width/height in modules. */
  imageSize: number;
  /** Max QR border margin in modules. */
  frameMargin: number;
  /** Max excludeDots margin in modules. */
  imageMargin: number;
}

interface QRGenerateResultBase {
  matrixSize: number;
  eyeZones: QREyeZone[];
  maxValues: QRMaxValues;
  getMaxPos: (
    imageWidth: number,
    imageHeight: number,
  ) => { maxX: number; maxY: number };
}

export interface QRGenerateResult extends QRGenerateResultBase {
  svg: string;
  /** The raw QR matrix — can be passed back as `_cachedMatrix` to skip re-encoding. */
  matrix: QRMatrix;
  /** Rendered canvas. `null` in non-browser environments (Node.js). */
  canvas: HTMLCanvasElement | null;
  /**
   * Pixel-based QR validation — samples the rendered canvas against the known
   * source matrix to check contrast, finder/timing pattern integrity, and
   * ECC headroom. Works with all dot shapes and color schemes.
   * Returns an error result when called in a non-browser environment.
   */
  validate: (tuning?: ValidatorTuning) => QRValidateResult;
  /**
   * Returns the computed pixel value for a config key.
   * Currently supported keys: `"borderRadius"`.
   */
  getOption<K extends "borderRadius">(key: K): number;
}

async function svgToCanvas(
  svg: string,
  width: number,
  height: number,
): Promise<HTMLCanvasElement | null> {
  if (typeof document === "undefined") return null;
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      reject(new Error("Could not get 2D context from canvas"));
      return;
    }
    const img = new Image();
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

// ─── Decoration helpers ───────────────────────────────────────────────────────

/** Mulberry32 seeded PRNG — returns values in [0, 1). */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function _f(n: number): string {
  return n.toFixed(3);
}

function _starPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  points: number,
): string {
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    d += (i === 0 ? "M" : "L") + _f(x) + "," + _f(y);
  }
  return d + "Z";
}

/** Render a single built-in geometric decoration shape centered at (cx, cy). */
function _renderBuiltinDecoration(
  shape: QrDecorationBuiltinShape,
  cx: number,
  cy: number,
  size: number,
  fillRef: string,
  opacity: number,
): string {
  const r = size / 2;
  const op = opacity < 1 ? ` opacity="${_f(opacity)}"` : "";
  const fill = `fill="${fillRef}"`;

  switch (shape) {
    case "dot":
      return `<circle cx="${_f(cx)}" cy="${_f(cy)}" r="${_f(r)}" ${fill}${op}/>`;

    case "ring":
      return `<circle cx="${_f(cx)}" cy="${_f(cy)}" r="${_f(r * 0.65)}" fill="none" stroke="${fillRef}" stroke-width="${_f(r * 0.5)}"${op}/>`;

    case "square":
      return `<rect x="${_f(cx - r)}" y="${_f(cy - r)}" width="${_f(size)}" height="${_f(size)}" ${fill}${op}/>`;

    case "diamond": {
      const d = `M${_f(cx)},${_f(cy - r)}L${_f(cx + r)},${_f(cy)}L${_f(cx)},${_f(cy + r)}L${_f(cx - r)},${_f(cy)}Z`;
      return `<path d="${d}" ${fill}${op}/>`;
    }

    case "star":
      return `<path d="${_starPath(cx, cy, r, r * 0.45, 5)}" ${fill}${op}/>`;

    case "star4":
      return `<path d="${_starPath(cx, cy, r, r * 0.35, 4)}" ${fill}${op}/>`;

    case "cross": {
      const t = r * 0.3;
      const d =
        `M${_f(cx - t)},${_f(cy - r)}H${_f(cx + t)}V${_f(cy - t)}` +
        `H${_f(cx + r)}V${_f(cy + t)}H${_f(cx + t)}V${_f(cy + r)}` +
        `H${_f(cx - t)}V${_f(cy + t)}H${_f(cx - r)}V${_f(cy - t)}H${_f(cx - t)}Z`;
      return `<path d="${d}" ${fill}${op}/>`;
    }

    case "triangle": {
      const d = `M${_f(cx)},${_f(cy - r)}L${_f(cx + r * 0.866)},${_f(cy + r * 0.5)}L${_f(cx - r * 0.866)},${_f(cy + r * 0.5)}Z`;
      return `<path d="${d}" ${fill}${op}/>`;
    }

    default:
      return `<circle cx="${_f(cx)}" cy="${_f(cy)}" r="${_f(r)}" ${fill}${op}/>`;
  }
}

/**
 * Generates an SVG `<g>` element containing all decoration layers scattered in
 * the empty margin space around the QR matrix.
 *
 * Decorations are rendered INSIDE the clip group, so they are always confined
 * to the QR background zone (including being hidden in rounded corners).
 *
 * Shape types supported:
 *  - Built-in strings: "dot" | "ring" | "square" | "diamond" | "star" | "star4" | "cross" | "triangle"
 *  - { type: "icon"; path }  — icon from the built-in shapes registry
 *  - { type: "custom-path"; path; viewBox? } — custom SVG path data
 *  - { type: "image"; source } — any image URL or base64 data-URI
 */
function generateDecorationsSvg(
  decorations: QrDecoration[],
  effectiveMargin: number,
  matrixSize: number,
  fullSize: number,
): string {
  if (!decorations || decorations.length === 0) return "";

  const qmStart = effectiveMargin;
  const qmEnd = effectiveMargin + matrixSize;

  let defsStr = "";
  let elemsStr = "";

  for (let layerIdx = 0; layerIdx < decorations.length; layerIdx++) {
    const dec = decorations[layerIdx];
    const shapeDef = dec.shape ?? "dot";
    const color = dec.color ?? "#000000";
    const size = dec.size ?? 0.6;
    const opacity = dec.opacity ?? 1;
    const seed = dec.seed ?? 42;
    const placement = dec.placement ?? "scatter";
    // Offset seed per layer so two layers with the same seed still differ
    const rng = mulberry32(seed ^ (layerIdx * 0x9e3779b9));
    const halfSize = size / 2;

    // ── Placement zones ──────────────────────────────────────────────────────
    const topBand = { x1: 0, y1: 0, x2: fullSize, y2: qmStart };
    const bottomBand = { x1: 0, y1: qmEnd, x2: fullSize, y2: fullSize };
    const leftBand = { x1: 0, y1: qmStart, x2: qmStart, y2: qmEnd };
    const rightBand = { x1: qmEnd, y1: qmStart, x2: fullSize, y2: qmEnd };
    const tlCorner = { x1: 0, y1: 0, x2: qmStart, y2: qmStart };
    const trCorner = { x1: qmEnd, y1: 0, x2: fullSize, y2: qmStart };
    const blCorner = { x1: 0, y1: qmEnd, x2: qmStart, y2: fullSize };
    const brCorner = { x1: qmEnd, y1: qmEnd, x2: fullSize, y2: fullSize };

    type Zone = { x1: number; y1: number; x2: number; y2: number };
    let zones: Zone[];
    switch (placement) {
      case "corners":
        zones = [tlCorner, trCorner, blCorner, brCorner];
        break;
      case "top":
        zones = [topBand];
        break;
      case "bottom":
        zones = [bottomBand];
        break;
      case "left":
        zones = [leftBand];
        break;
      case "right":
        zones = [rightBand];
        break;
      case "edges":
      case "scatter":
      default:
        zones = [topBand, bottomBand, leftBand, rightBand];
    }

    const validZones = zones.filter(
      (z) => z.x2 - z.x1 >= size && z.y2 - z.y1 >= size,
    );
    if (validZones.length === 0) continue;

    // Auto count: ~35 % area density
    const totalArea = validZones.reduce(
      (sum, z) => sum + (z.x2 - z.x1) * (z.y2 - z.y1),
      0,
    );
    const slotArea = size * 1.6 * (size * 1.6);
    const autoCount = Math.max(1, Math.round((totalArea / slotArea) * 0.35));
    const count = dec.count ?? Math.min(autoCount, 80);

    // ── Scatter placement ────────────────────────────────────────────────────
    const placed: { cx: number; cy: number }[] = [];
    const minDist = size * 1.3;
    const zoneAreas = validZones.map((z) => (z.x2 - z.x1) * (z.y2 - z.y1));
    const totalZoneArea = zoneAreas.reduce((a, b) => a + b, 0);
    let attempts = 0;
    const maxAttempts = count * 40;

    while (placed.length < count && attempts < maxAttempts) {
      attempts++;
      let pick = rng() * totalZoneArea;
      let zoneIdx = validZones.length - 1;
      for (let i = 0; i < zoneAreas.length; i++) {
        pick -= zoneAreas[i];
        if (pick <= 0) {
          zoneIdx = i;
          break;
        }
      }
      const zone = validZones[zoneIdx];
      const cx =
        zone.x1 + halfSize + rng() * Math.max(0, zone.x2 - zone.x1 - size);
      const cy =
        zone.y1 + halfSize + rng() * Math.max(0, zone.y2 - zone.y1 - size);

      if (
        placed.some((p) => {
          const dx = p.cx - cx;
          const dy = p.cy - cy;
          return Math.sqrt(dx * dx + dy * dy) < minDist;
        })
      )
        continue;
      placed.push({ cx, cy });
    }

    if (placed.length === 0) continue;

    const opAttr = opacity < 1 ? ` opacity="${_f(opacity)}"` : "";

    // ── Resolve fill reference (gradient or plain color) ─────────────────────
    let fillRef = color;
    if (dec.gradient) {
      const gradId = `_dec_grad_${layerIdx}`;
      const zBx = Math.min(...validZones.map((z) => z.x1));
      const zBy = Math.min(...validZones.map((z) => z.y1));
      const zBw = Math.max(...validZones.map((z) => z.x2)) - zBx;
      const zBh = Math.max(...validZones.map((z) => z.y2)) - zBy;
      defsStr += generateGradientDef(gradId, dec.gradient, zBx, zBy, zBw, zBh);
      fillRef = `url(#${gradId})`;
    }

    // ── Render based on shape type ───────────────────────────────────────────
    if (typeof shapeDef === "string") {
      // Built-in geometric shape
      for (const { cx, cy } of placed) {
        elemsStr += _renderBuiltinDecoration(
          shapeDef as QrDecorationBuiltinShape,
          cx,
          cy,
          size,
          fillRef,
          opacity,
        );
      }
    } else if (shapeDef.type === "image") {
      // Raster / SVG image
      for (const { cx, cy } of placed) {
        elemsStr += `<image href="${shapeDef.source}" x="${_f(cx - halfSize)}" y="${_f(cy - halfSize)}" width="${_f(size)}" height="${_f(size)}" preserveAspectRatio="xMidYMid meet"${opAttr}/>`;
      }
    } else {
      // icon or custom-path — define a reusable <symbol> then <use> it
      const symId = `_dec_sym_${layerIdx}`;
      let symContent = "";
      let viewBox = "0 0 24 24";

      if (shapeDef.type === "icon") {
        const entry =
          shapes[shapeDef.path as keyof typeof shapes] ??
          shapes["inner-eye-square"];
        viewBox = entry.viewBox ?? "0 0 24 24";
        symContent = `<path d="${entry.d}" />`;
      } else {
        // custom-path
        viewBox = shapeDef.viewBox ?? "0 0 24 24";
        symContent = `<path d="${shapeDef.path}" />`;
      }

      defsStr += `<symbol id="${symId}" viewBox="${viewBox}">${symContent}</symbol>`;

      for (const { cx, cy } of placed) {
        elemsStr += `<use href="#${symId}" x="${_f(cx - halfSize)}" y="${_f(cy - halfSize)}" width="${_f(size)}" height="${_f(size)}" fill="${fillRef}"${opAttr}/>`;
      }
    }
  }

  if (!elemsStr) return "";
  const defsBlock = defsStr ? `<defs>${defsStr}</defs>` : "";
  return `<g>${defsBlock}${elemsStr}</g>`;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the safe-margin coefficient `c` for a given wrapper shape.
 *
 * `c = 1 − safeRadiusFactor / √2` where safeRadiusFactor is the ratio of the
 * shape's minimum boundary distance (from centre) to its outer radius:
 *   - convex n-gon: apothem / r = cos(π/n)
 *   - star shapes:  inner vertex ratio (the valley is the closest point)
 *   - circle/square: 1.0 (no extra margin needed beyond the circle formula)
 *
 * Plug `c` into `minSafeMargin = c·matrixSize / (2·(1−c))` to get the margin
 * (in module units) that keeps every QR corner inside the shape's boundary.
 */
function _wrapperSafeC(
  wrapper: import("./types").QrWrapper | undefined,
  clampedBorderRadius: number,
): number {
  if (wrapper) {
    const shape = wrapper.shape ?? "circle";
    if (shape === "square") return 0; // axis-aligned square never clips QR corners
    const safeRadiusFactor: Record<string, number> = {
      circle:   1.0,
      octagon:  Math.cos(Math.PI / 8),  // ≈ 0.924
      hexagon:  Math.cos(Math.PI / 6),  // ≈ 0.866
      pentagon: Math.cos(Math.PI / 5),  // ≈ 0.809
      diamond:  Math.cos(Math.PI / 4),  // ≈ 0.707
      triangle: Math.cos(Math.PI / 3),  // = 0.500
      star:     0.45,
      star4:    0.38,
    };
    const f = safeRadiusFactor[shape] ?? 1.0;
    return 1 - f / Math.SQRT2;
  }
  return (clampedBorderRadius / 100) * (1 - 1 / Math.SQRT2);
}

/**
 * Returns an SVG path string for the given wrapper shape, inscribed in a
 * square of `size` × `size` units with an optional inward `inset`.
 */
function buildWrapperShapePath(
  shape: QrWrapperShape,
  size: number,
  inset = 0,
): string {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2;

  // For a regular n-gon with vertex-radius r, the apothem (perpendicular
  // distance from centre to any edge midpoint) = r * cos(π/n).
  // To achieve a *uniform* ring width `inset` measured edge-to-edge:
  //   inner_apothem = outer_apothem - inset
  //   inner_r = outer_r - inset / cos(π/n)
  // For a circle cos(π/∞)=1, so no correction is needed.
  const polyR = (n: number): number =>
    inset === 0 ? outerR : outerR - inset / Math.cos(Math.PI / n);

  const polygon = (sides: number, rotationDeg = 0, r = outerR - inset): string => {
    const pts: string[] = [];
    for (let i = 0; i < sides; i++) {
      const angle =
        (i * 2 * Math.PI) / sides - Math.PI / 2 + (rotationDeg * Math.PI) / 180;
      pts.push(
        `${(cx + r * Math.cos(angle)).toFixed(3)} ${(cy + r * Math.sin(angle)).toFixed(3)}`,
      );
    }
    return `M ${pts.join(" L ")} Z`;
  };

  const star = (points: number, innerRatio: number, r = outerR - inset): string => {
    const pts: string[] = [];
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const ri = i % 2 === 0 ? r : r * innerRatio;
      pts.push(
        `${(cx + ri * Math.cos(angle)).toFixed(3)} ${(cy + ri * Math.sin(angle)).toFixed(3)}`,
      );
    }
    return `M ${pts.join(" L ")} Z`;
  };

  switch (shape) {
    case "circle": {
      const r = outerR - inset;
      return (
        `M ${(cx - r).toFixed(3)} ${cy.toFixed(3)} ` +
        `A ${r.toFixed(3)} ${r.toFixed(3)} 0 1 0 ${(cx + r).toFixed(3)} ${cy.toFixed(3)} ` +
        `A ${r.toFixed(3)} ${r.toFixed(3)} 0 1 0 ${(cx - r).toFixed(3)} ${cy.toFixed(3)} Z`
      );
    }
    case "square": {
      // Axis-aligned square: apothem = half-side = r — direct inset is uniform.
      const r = outerR - inset;
      return `M ${(cx - r).toFixed(3)} ${(cy - r).toFixed(3)} H ${(cx + r).toFixed(3)} V ${(cy + r).toFixed(3)} H ${(cx - r).toFixed(3)} Z`;
    }
    case "triangle":
      return polygon(3, 0, polyR(3));
    case "diamond":
      return polygon(4, 45, polyR(4));
    case "pentagon":
      return polygon(5, 0, polyR(5));
    case "hexagon":
      return polygon(6, 0, polyR(6));
    case "octagon":
      return polygon(8, 22.5, polyR(8));
    case "star":
      return star(5, 0.45, polyR(5));
    case "star4":
      return star(4, 0.38, polyR(4));
    default:
      return polygon(4, 0);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

let _qrIdCtr = 0;

function prefixSvgIds(svg: string, prefix: string): string {
  const ids = new Set<string>();
  svg.replace(/\bid="([^"]+)"/g, (_, id) => {
    ids.add(id);
    return _;
  });
  if (!ids.size) return svg;
  svg = svg.replace(/\bid="([^"]+)"/g, (_, id) => `id="${prefix}${id}"`);
  ids.forEach((id) => {
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    svg = svg.replace(
      new RegExp(`url\\(#${esc}\\)`, "g"),
      `url(#${prefix}${id})`,
    );
    svg = svg.replace(
      new RegExp(`href="#${esc}"`, "g"),
      `href="#${prefix}${id}"`,
    );
  });
  return svg;
}

// ---------------------------------------------------------------------------
// Animation builder
// ---------------------------------------------------------------------------

function parseHexToRgb01(color: string): [number, number, number] {
  const m = color.match(/^#([0-9a-f]{3,8})$/i);
  if (!m) return [0.267, 0.533, 1];
  let hex = m[1];
  if (hex.length === 3)
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  const n = parseInt(hex.slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

type AnimWrap = (s: string) => string;
const identity: AnimWrap = (s) => s;

// Linear interpolation helper
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Triangular wave: values="vTo;vFrom;vTo" → goes vTo→vFrom→vTo over one cycle
function triangleWave(vTo: number, vFrom: number, cycleFrac: number): number {
  const x = ((cycleFrac % 1) + 1) % 1;
  return x <= 0.5 ? lerp(vTo, vFrom, x * 2) : lerp(vFrom, vTo, (x - 0.5) * 2);
}

// Returns the animation cycle duration in seconds (longest repeating animation)
export function getAnimationDuration(animations: QrAnimation[]): number {
  const defaults: Partial<Record<QrAnimation["type"], number>> = {
    draw: 1.5,
    shimmer: 2.5,
    "color-cycle": 4,
    float: 3,
    ripple: 2,
    spotlight: 3,
  };
  let max = 0;
  for (const a of animations) {
    const dur = a.duration ?? defaults[a.type] ?? 2;
    if (a.type === "draw" && a.repeat === false) continue; // one-shot, don't drive loop
    max = Math.max(max, dur);
  }
  return max > 0 ? max : 0;
}

function buildAnimations(
  animations: QrAnimation[],
  fullSize: number,
  uid: string,
  dotColor: string,
  /** When set (seconds elapsed), generate a static snapshot at that time instead of animated SVG */
  frameSecs?: number,
): {
  defs: string;
  wrapDots: AnimWrap;
  wrapEyes: AnimWrap;
  wrapContent: AnimWrap;
  overlay: string;
} {
  const isFrame = frameSecs !== undefined;
  let defs = "";
  let overlay = "";
  let wrapDots: AnimWrap = identity;
  let wrapEyes: AnimWrap = identity;
  let wrapContent: AnimWrap = identity;

  for (const anim of animations) {
    const rc =
      anim.repeat === false
        ? "1"
        : anim.repeat === true || anim.repeat == null
          ? "indefinite"
          : String(anim.repeat);
    const delay = anim.delay ?? 0;

    if (anim.type === "pulse") {
      const dur = anim.duration ?? 2;
      const vFrom = anim.from ?? 0.4;
      const vTo = anim.to ?? 1.0;
      const target = anim.target ?? "eyes";
      let wrap: AnimWrap;
      if (isFrame) {
        const secs = Math.max(0, frameSecs! - delay);
        const op = triangleWave(vTo, vFrom, secs / dur);
        wrap = (s) => (s ? `<g opacity="${op.toFixed(4)}">${s}</g>` : s);
      } else {
        const tag = `<animate attributeName="opacity" values="${vTo};${vFrom};${vTo}" dur="${dur}s" begin="${delay}s" repeatCount="${rc}"/>`;
        wrap = (s) => (s ? `<g style="will-change:opacity">${tag}${s}</g>` : s);
      }
      if (target === "eyes" || target === "all") wrapEyes = wrap;
      if (target === "dots" || target === "all") wrapDots = wrap;
    } else if (anim.type === "shimmer") {
      const dur = anim.duration ?? 2.5;
      const color = anim.color ?? "#ffffff";
      const op = anim.opacity ?? 0.35;
      const dir = anim.direction ?? "ltr";
      const gid = `qr-shimmer-${uid}`;
      const isH = dir === "ltr";
      const stops = `<stop offset="0%" stop-color="${color}" stop-opacity="0"/>
          <stop offset="40%" stop-color="${color}" stop-opacity="${op}"/>
          <stop offset="60%" stop-color="${color}" stop-opacity="${op}"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>`;
      if (isFrame) {
        const secs = Math.max(0, frameSecs! - delay);
        const phase = (secs % dur) / dur; // saw wave [0,1)
        if (isH) {
          const x1 = -fullSize + phase * 2 * fullSize;
          const x2 = x1 + fullSize;
          defs += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${x1.toFixed(2)}" y1="0" x2="${x2.toFixed(2)}" y2="0">${stops}</linearGradient>`;
        } else {
          const y1 = -fullSize + phase * 2 * fullSize;
          const y2 = y1 + fullSize;
          defs += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="${y1.toFixed(2)}" x2="0" y2="${y2.toFixed(2)}">${stops}</linearGradient>`;
        }
      } else if (isH) {
        defs += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${-fullSize}" y1="0" x2="0" y2="0">
          ${stops}
          <animate attributeName="x1" values="${-fullSize};${fullSize}"  dur="${dur}s" repeatCount="${rc}" begin="${delay}s" calcMode="linear"/>
          <animate attributeName="x2" values="0;${fullSize * 2}"         dur="${dur}s" repeatCount="${rc}" begin="${delay}s" calcMode="linear"/>
        </linearGradient>`;
      } else {
        defs += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="${-fullSize}" x2="0" y2="0">
          ${stops}
          <animate attributeName="y1" values="${-fullSize};${fullSize}"  dur="${dur}s" repeatCount="${rc}" begin="${delay}s" calcMode="linear"/>
          <animate attributeName="y2" values="0;${fullSize * 2}"         dur="${dur}s" repeatCount="${rc}" begin="${delay}s" calcMode="linear"/>
        </linearGradient>`;
      }
      overlay += `<rect width="${fullSize}" height="${fullSize}" fill="url(#${gid})" style="pointer-events:none"/>`;
    } else if (anim.type === "draw") {
      const dur = anim.duration ?? 1.5;
      const dir = anim.direction ?? "ltr";
      const cid = `qr-draw-${uid}`;
      if (isFrame) {
        const secs = Math.max(0, frameSecs! - delay);
        const progress = Math.min(secs / dur, 1);
        const dw = (fullSize * progress).toFixed(3);
        const dh = (fullSize * progress).toFixed(3);
        if (dir === "ltr")
          defs += `<clipPath id="${cid}"><rect x="0" y="0" width="${dw}" height="${fullSize}"/></clipPath>`;
        else if (dir === "ttb")
          defs += `<clipPath id="${cid}"><rect x="0" y="0" width="${fullSize}" height="${dh}"/></clipPath>`;
        else if (dir === "rtl")
          defs += `<clipPath id="${cid}"><rect x="${(fullSize * (1 - progress)).toFixed(3)}" y="0" width="${dw}" height="${fullSize}"/></clipPath>`; // btt
        else
          defs += `<clipPath id="${cid}"><rect x="0" y="${(fullSize * (1 - progress)).toFixed(3)}" width="${fullSize}" height="${dh}"/></clipPath>`;
      } else {
        if (dir === "ltr")
          defs += `<clipPath id="${cid}"><rect x="0" y="0" height="${fullSize}" width="0"><animate attributeName="width"  from="0" to="${fullSize}" dur="${dur}s" fill="freeze" begin="${delay}s"/></rect></clipPath>`;
        else if (dir === "ttb")
          defs += `<clipPath id="${cid}"><rect x="0" y="0" width="${fullSize}" height="0"><animate attributeName="height" from="0" to="${fullSize}" dur="${dur}s" fill="freeze" begin="${delay}s"/></rect></clipPath>`;
        else if (dir === "rtl")
          defs += `<clipPath id="${cid}"><rect x="${fullSize}" y="0" height="${fullSize}" width="0"><animate attributeName="x" from="${fullSize}" to="0" dur="${dur}s" fill="freeze" begin="${delay}s"/><animate attributeName="width" from="0" to="${fullSize}" dur="${dur}s" fill="freeze" begin="${delay}s"/></rect></clipPath>`; // btt
        else
          defs += `<clipPath id="${cid}"><rect x="0" y="${fullSize}" width="${fullSize}" height="0"><animate attributeName="y" from="${fullSize}" to="0" dur="${dur}s" fill="freeze" begin="${delay}s"/><animate attributeName="height" from="0" to="${fullSize}" dur="${dur}s" fill="freeze" begin="${delay}s"/></rect></clipPath>`;
      }
      const prev = wrapContent;
      wrapContent = (s) => prev(`<g style="will-change:clip-path" clip-path="url(#${cid})">${s}</g>`);
    } else if (anim.type === "glow") {
      const dur = anim.duration ?? 2;
      const glowColor = anim.color ?? dotColor;
      const intensity = anim.intensity ?? 3;
      const fid = `qr-glow-${uid}`;
      const [r, g, b] = parseHexToRgb01(glowColor);
      const cm = `values="0 0 0 0 ${r.toFixed(4)}  0 0 0 0 ${g.toFixed(4)}  0 0 0 0 ${b.toFixed(4)}  0 0 0 0.85 0"`;
      if (isFrame) {
        const secs = Math.max(0, frameSecs! - delay);
        const sd = triangleWave(0, intensity, secs / dur).toFixed(4);
        defs += `<filter id="${fid}" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="${sd}" result="blur"/>
          <feColorMatrix in="blur" type="matrix" ${cm} result="tinted"/>
          <feMerge><feMergeNode in="tinted"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>`;
      } else {
        defs += `<filter id="${fid}" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
          <feGaussianBlur in="SourceGraphic" result="blur">
            <animate attributeName="stdDeviation" values="0;${intensity};0" dur="${dur}s" repeatCount="${rc}" begin="${delay}s"/>
          </feGaussianBlur>
          <feColorMatrix in="blur" type="matrix" ${cm} result="tinted"/>
          <feMerge><feMergeNode in="tinted"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>`;
      }
      const prevD = wrapDots,
        prevE = wrapEyes;
      wrapDots = (s) => prevD(`<g style="will-change:filter" filter="url(#${fid})">${s}</g>`);
      wrapEyes = (s) => prevE(`<g style="will-change:filter" filter="url(#${fid})">${s}</g>`);
    } else if (anim.type === "color-cycle") {
      // Animated hueRotate — pure hue shift, luminance unchanged → all frames scannable.
      const dur = anim.duration ?? 4;
      const target = anim.target ?? "all";
      const fid = `qr-cc-${uid}`;
      if (isFrame) {
        const secs = Math.max(0, frameSecs! - delay);
        const deg = (((secs % dur) / dur) * 360).toFixed(2);
        defs += `<filter id="${fid}" color-interpolation-filters="sRGB">
          <feColorMatrix type="hueRotate" values="${deg}"/>
        </filter>`;
      } else {
        defs += `<filter id="${fid}" color-interpolation-filters="sRGB">
          <feColorMatrix type="hueRotate" values="0">
            <animate attributeName="values" from="0" to="360" dur="${dur}s" repeatCount="${rc}" begin="${delay}s" calcMode="linear"/>
          </feColorMatrix>
        </filter>`;
      }
      const wrap: AnimWrap = (s) =>
        s ? `<g style="will-change:filter" filter="url(#${fid})">${s}</g>` : s;
      if (target === "dots" || target === "all") {
        const p = wrapDots;
        wrapDots = (s) => p(wrap(s));
      }
      if (target === "eyes" || target === "all") {
        const p = wrapEyes;
        wrapEyes = (s) => p(wrap(s));
      }
    } else if (anim.type === "ripple") {
      // Expanding stroke rings that grow from the QR centre and fade out.
      // Each ring is a separate <circle> element in the overlay — never covers modules.
      const dur = anim.duration ?? 2;
      const ringColor = anim.color ?? dotColor;
      const peakOpacity = anim.opacity ?? 0.55;
      const count = Math.min(3, Math.max(1, anim.count ?? 1));
      const sw = anim.strokeWidth ?? 0.4;
      const cx = fullSize / 2,
        cy = fullSize / 2;
      // Rings expand from inner radius (20% of half-size) to outer (90% of half-size).
      const rMin = fullSize * 0.2,
        rMax = fullSize * 0.5;

      for (let ri = 0; ri < count; ri++) {
        const phaseOffset = ri / count; // stagger rings evenly
        if (isFrame) {
          const secs = Math.max(0, frameSecs! - delay);
          const phase = (((secs / dur + phaseOffset) % 1) + 1) % 1;
          const r = lerp(rMin, rMax, phase).toFixed(3);
          const op = (peakOpacity * (1 - phase)).toFixed(4);
          overlay += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ringColor}" stroke-width="${sw}" opacity="${op}" style="pointer-events:none"/>`;
        } else {
          const startR = rMin + phaseOffset * (rMax - rMin);
          const begVal = `${(-phaseOffset * dur + delay).toFixed(3)}s`;
          overlay += `<circle cx="${cx}" cy="${cy}" r="${startR.toFixed(3)}" fill="none" stroke="${ringColor}" stroke-width="${sw}" style="pointer-events:none">
            <animate attributeName="r" from="${rMin}" to="${rMax}" dur="${dur}s" begin="${begVal}" repeatCount="${rc}" calcMode="linear"/>
            <animate attributeName="opacity" from="${peakOpacity}" to="0" dur="${dur}s" begin="${begVal}" repeatCount="${rc}" calcMode="linear"/>
          </circle>`;
        }
      }
    } else if (anim.type === "spotlight") {
      // Moving radial gradient applied as a low-opacity overlay — never lowers contrast.
      const dur = anim.duration ?? 3;
      const color = anim.color ?? "#ffffff";
      const op = anim.opacity ?? 0.35;
      const radius = (anim.radius ?? 40) / 100; // convert % to fraction
      const gid = `qr-spot-${uid}`;
      // Spotlight sweeps in a circle: cx = 50 + 25*cos(t), cy = 50 + 25*sin(t)
      if (isFrame) {
        const secs = Math.max(0, frameSecs! - delay);
        const angle = ((secs % dur) / dur) * 2 * Math.PI;
        const cx = (0.5 + 0.25 * Math.cos(angle) * 100).toFixed(2);
        const cy = (0.5 + 0.25 * Math.sin(angle) * 100).toFixed(2);
        defs += `<radialGradient id="${gid}" cx="${cx}%" cy="${cy}%" r="${(radius * 100).toFixed(1)}%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stop-color="${color}" stop-opacity="${op}"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </radialGradient>`;
      } else {
        // keyframe series for cx and cy over the circular path
        const steps = 8;
        const cxVals = Array.from(
          { length: steps + 1 },
          (_, k) =>
            (50 + 25 * Math.cos((2 * Math.PI * k) / steps)).toFixed(2) + "%",
        ).join(";");
        const cyVals = Array.from(
          { length: steps + 1 },
          (_, k) =>
            (50 + 25 * Math.sin((2 * Math.PI * k) / steps)).toFixed(2) + "%",
        ).join(";");
        defs += `<radialGradient id="${gid}" cx="75%" cy="50%" r="${(radius * 100).toFixed(1)}%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stop-color="${color}" stop-opacity="${op}"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
          <animate attributeName="cx" values="${cxVals}" dur="${dur}s" repeatCount="${rc}" begin="${delay}s" calcMode="linear"/>
          <animate attributeName="cy" values="${cyVals}" dur="${dur}s" repeatCount="${rc}" begin="${delay}s" calcMode="linear"/>
        </radialGradient>`;
      }
      overlay += `<rect width="${fullSize}" height="${fullSize}" fill="url(#${gid})" style="pointer-events:none;mix-blend-mode:screen"/>`;
    } else if (anim.type === "float") {
      // Sinusoidal translate — displacement peaks at ±amplitude module units.
      // Maximum shift is << module gap, so every frame is scannable.
      const dur = anim.duration ?? 3;
      const amplitude = anim.amplitude ?? 1.2;
      const isV = (anim.direction ?? "vertical") === "vertical";
      if (isFrame) {
        const secs = Math.max(0, frameSecs! - delay);
        const t = Math.sin((2 * Math.PI * secs) / dur) * amplitude;
        const tx = isV ? 0 : t,
          ty = isV ? t : 0;
        const prev = wrapContent;
        wrapContent = (s) =>
          prev(
            `<g transform="translate(${tx.toFixed(4)},${ty.toFixed(4)})">${s}</g>`,
          );
      } else {
        const kfCount = 8;
        const vals = Array.from({ length: kfCount + 1 }, (_, k) => {
          const t = Math.sin((2 * Math.PI * k) / kfCount) * amplitude;
          return isV ? `0,${t.toFixed(4)}` : `${t.toFixed(4)},0`;
        }).join(";");
        const tid = `qr-float-${uid}`;
        // Wrap content in a group with animateTransform
        const prev = wrapContent;
        wrapContent = (s) =>
          prev(
            `<g style="will-change:transform"><animateTransform attributeName="transform" type="translate" values="${vals}" dur="${dur}s" repeatCount="${rc}" begin="${delay}s" calcMode="spline" keySplines="${Array(kfCount).fill("0.45 0 0.55 1").join(";")}"/>${s}</g>`,
          );
      }
    }
  }

  return { defs, wrapDots, wrapEyes, wrapContent, overlay };
}

function buildEffects(
  effects: QrEffect[],
  fullSize: number,
  uid: string,
  dotColor: string,
): {
  defs: string;
  wrapDots: AnimWrap;
  wrapEyes: AnimWrap;
  wrapAll: AnimWrap; // wraps background + dots + eyes + images inside clip group
  overlay: string; // blend-mode rects placed after all content
} {
  let defs = "";
  let overlay = "";
  let wrapDots: AnimWrap = identity;
  let wrapEyes: AnimWrap = identity;
  let wrapAll: AnimWrap = identity;

  for (let i = 0; i < effects.length; i++) {
    const fx = effects[i];
    const fid = `qr-fx${i}-${uid}`;
    // When target is "all", apply the filter to the entire content group —
    // DON'T also apply it to dots/eyes individually (they're already inside it).
    const isAll =
      fx.type !== "blend" &&
      (fx.target === "all" || (fx.type === "drop-shadow" && !fx.target));
    const toDots =
      !isAll &&
      (fx.target === "dots" ||
        !fx.target ||
        fx.type === "liquid" ||
        fx.type === "morphology");
    const toEyes = !isAll && fx.target === "eyes";

    switch (fx.type) {
      case "drop-shadow": {
        const dx = fx.dx ?? 1.5;
        const dy = fx.dy ?? 1.5;
        const bl = fx.blur ?? 1.5;
        const col = fx.color ?? "#000000";
        const op = fx.opacity ?? 0.45;
        defs += `<filter id="${fid}" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="${dx}" dy="${dy}" stdDeviation="${bl}" flood-color="${col}" flood-opacity="${op}"/>
        </filter>`;
        const wrap: AnimWrap = (s) =>
          s ? `<g filter="url(#${fid})">${s}</g>` : s;
        if (isAll) {
          const p = wrapAll;
          wrapAll = (s) => p(wrap(s));
        }
        if (toDots) {
          const p = wrapDots;
          wrapDots = (s) => p(wrap(s));
        }
        if (toEyes) {
          const p = wrapEyes;
          wrapEyes = (s) => p(wrap(s));
        }
        break;
      }

      case "neon-glow": {
        const glowCol = fx.color ?? dotColor;
        const intensity = fx.intensity ?? 2;
        const spread = fx.spread ?? intensity * 2.5;
        const [r, g, b] = parseHexToRgb01(glowCol);
        const rf = r.toFixed(4),
          gf = g.toFixed(4),
          bf = b.toFixed(4);
        defs += `<filter id="${fid}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="${spread.toFixed(2)}" result="wide"/>
          <feGaussianBlur in="SourceGraphic" stdDeviation="${intensity.toFixed(2)}" result="tight"/>
          <feColorMatrix in="wide"  type="matrix" values="0 0 0 0 ${rf} 0 0 0 0 ${gf} 0 0 0 0 ${bf} 0 0 0 0.55 0" result="wc"/>
          <feColorMatrix in="tight" type="matrix" values="0 0 0 0 ${rf} 0 0 0 0 ${gf} 0 0 0 0 ${bf} 0 0 0 1 0"    result="tc"/>
          <feMerge><feMergeNode in="wc"/><feMergeNode in="tc"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>`;
        const useAll = fx.target === "all" || !fx.target;
        const useDots = fx.target === "dots";
        const useEyes = fx.target === "eyes";
        const wrap: AnimWrap = (s) =>
          s ? `<g filter="url(#${fid})">${s}</g>` : s;
        if (useAll) {
          const p = wrapAll;
          wrapAll = (s) => p(wrap(s));
        }
        if (useDots) {
          const p = wrapDots;
          wrapDots = (s) => p(wrap(s));
        }
        if (useEyes) {
          const p = wrapEyes;
          wrapEyes = (s) => p(wrap(s));
        }
        break;
      }

      case "morphology": {
        const op = fx.operator ?? "dilate";
        const rad = fx.radius ?? 0.3;
        defs += `<filter id="${fid}">
          <feMorphology operator="${op}" radius="${rad.toFixed(3)}"/>
        </filter>`;
        const wrap: AnimWrap = (s) =>
          s ? `<g filter="url(#${fid})">${s}</g>` : s;
        // Default target for morphology is "dots"
        const useAll = fx.target === "all";
        const useDots = fx.target === "dots" || !fx.target;
        const useEyes = fx.target === "eyes";
        if (useAll) {
          const p = wrapAll;
          wrapAll = (s) => p(wrap(s));
        }
        if (useDots) {
          const p = wrapDots;
          wrapDots = (s) => p(wrap(s));
        }
        if (useEyes) {
          const p = wrapEyes;
          wrapEyes = (s) => p(wrap(s));
        }
        break;
      }

      case "liquid": {
        const blur = fx.blur ?? 1.2;
        const threshold = fx.threshold ?? 0.35;
        // Alpha row: new_a = K*old_a + C. Threshold point = -C/K.
        const K = 18;
        const C = -(threshold * K);
        defs += `<filter id="${fid}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="${blur.toFixed(3)}" result="blur"/>
          <feColorMatrix in="blur" type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${K} ${C.toFixed(4)}"
            result="mask"/>
          <feComposite in="SourceGraphic" in2="mask" operator="in"/>
        </filter>`;
        // Default target for liquid is "dots"
        const useAll = fx.target === "all";
        const useDots = fx.target === "dots" || !fx.target;
        const useEyes = fx.target === "eyes";
        const wrap: AnimWrap = (s) =>
          s ? `<g filter="url(#${fid})">${s}</g>` : s;
        if (useAll) {
          const p = wrapAll;
          wrapAll = (s) => p(wrap(s));
        }
        if (useDots) {
          const p = wrapDots;
          wrapDots = (s) => p(wrap(s));
        }
        if (useEyes) {
          const p = wrapEyes;
          wrapEyes = (s) => p(wrap(s));
        }
        break;
      }

      case "blend": {
        const mode = fx.mode;
        const op = fx.opacity ?? 0.5;
        let fill: string;
        if (fx.gradient) {
          const gid = `${fid}-grad`;
          defs += generateGradientDef(
            gid,
            fx.gradient,
            0,
            0,
            fullSize,
            fullSize,
          );
          fill = `url(#${gid})`;
        } else {
          fill = fx.color ?? "#ffffff";
        }
        // Mask by target: dots uses mask-dots, eyes uses mask-cornerSquare
        let maskAttr = "";
        if (fx.target === "dots") maskAttr = ` mask="url(#mask-dots)"`;
        if (fx.target === "eyes") maskAttr = ` mask="url(#mask-cornerSquare)"`;
        overlay += `<rect width="${fullSize}" height="${fullSize}" fill="${fill}"${maskAttr} opacity="${op}" style="mix-blend-mode:${mode}"/>`;
        break;
      }

      case "noise": {
        // feTurbulence blended with multiply: pure black (0) * anything = 0,
        // so dark dot modules stay dark regardless of noise value. Safe.
        const freq = fx.frequency ?? 0.65;
        const octaves = fx.octaves ?? 4;
        const op = fx.opacity ?? 0.15;
        const seed = fx.seed ?? 1;
        defs += `<filter id="${fid}" color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}" stitchTiles="stitch" result="noise"/>
          <feColorMatrix in="noise" type="saturate" values="0" result="gray"/>
          <feComposite in="SourceGraphic" in2="gray" operator="arithmetic" k1="${op.toFixed(3)}" k2="${(1 - op).toFixed(3)}" k3="0" k4="0"/>
        </filter>`;
        // arithmetic: k1*SG*gray + k2*SG = SG*(op*gray + 1-op) — darkens midtones only
        const wrap: AnimWrap = (s) =>
          s ? `<g filter="url(#${fid})">${s}</g>` : s;
        if (isAll) {
          const p = wrapAll;
          wrapAll = (s) => p(wrap(s));
        }
        if (toDots) {
          const p = wrapDots;
          wrapDots = (s) => p(wrap(s));
        }
        if (toEyes) {
          const p = wrapEyes;
          wrapEyes = (s) => p(wrap(s));
        }
        break;
      }

      case "duotone": {
        // Convert to grayscale then remap: lum=0 → colorDark, lum=1 → colorLight.
        // Uses feColorMatrix (saturate=0) + feComponentTransfer linear ramp per channel.
        const [rD, gD, bD] = parseHexToRgb01(fx.colorDark ?? "#000000");
        const [rL, gL, bL] = parseHexToRgb01(fx.colorLight ?? "#ffffff");
        defs += `<filter id="${fid}" color-interpolation-filters="sRGB">
          <feColorMatrix type="saturate" values="0" result="gray"/>
          <feComponentTransfer in="gray">
            <feFuncR type="linear" slope="${(rL - rD).toFixed(4)}" intercept="${rD.toFixed(4)}"/>
            <feFuncG type="linear" slope="${(gL - gD).toFixed(4)}" intercept="${gD.toFixed(4)}"/>
            <feFuncB type="linear" slope="${(bL - bD).toFixed(4)}" intercept="${bD.toFixed(4)}"/>
          </feComponentTransfer>
        </filter>`;
        const wrap: AnimWrap = (s) =>
          s ? `<g filter="url(#${fid})">${s}</g>` : s;
        if (isAll) {
          const p = wrapAll;
          wrapAll = (s) => p(wrap(s));
        }
        if (toDots) {
          const p = wrapDots;
          wrapDots = (s) => p(wrap(s));
        }
        if (toEyes) {
          const p = wrapEyes;
          wrapEyes = (s) => p(wrap(s));
        }
        break;
      }

      case "emboss": {
        // feSpecularLighting adds a white specular highlight on the lit side of
        // each dot. The dark dot bodies stay dark; only a highlight is added.
        const dir = fx.direction ?? "ne";
        const str = fx.strength ?? 0.6;
        const surface = fx.surfaceScale ?? 4;
        const lx = dir.includes("e") ? fullSize * 1.3 : -fullSize * 0.3;
        const ly = dir.includes("n") ? -fullSize * 0.3 : fullSize * 1.3;
        const lz = fullSize * 0.9;
        defs += `<filter id="${fid}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="0.4" result="bump"/>
          <feSpecularLighting in="bump" surfaceScale="${surface}" specularConstant="1.2" specularExponent="30" lighting-color="white" result="spec">
            <fePointLight x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" z="${lz.toFixed(1)}"/>
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specMasked"/>
          <feComposite in="SourceGraphic" in2="specMasked" operator="arithmetic" k1="0" k2="1" k3="${str.toFixed(3)}" k4="0"/>
        </filter>`;
        // feSpecularLighting only lights where there is alpha (the dot interior), preserving
        // the background. The arithmetic composite keeps SourceGraphic + highlight.
        const wrap: AnimWrap = (s) =>
          s ? `<g filter="url(#${fid})">${s}</g>` : s;
        if (isAll) {
          const p = wrapAll;
          wrapAll = (s) => p(wrap(s));
        }
        if (toDots) {
          const p = wrapDots;
          wrapDots = (s) => p(wrap(s));
        }
        if (toEyes) {
          const p = wrapEyes;
          wrapEyes = (s) => p(wrap(s));
        }
        break;
      }

      case "convex": {
        // feDiffuseLighting on a blurred alpha bump map → each dot appears as a
        // raised dome. "screen" blend adds the lighting only to dot bodies, leaving
        // the white background untouched.
        const az = fx.azimuth ?? 225;
        const el = fx.elevation ?? 45;
        const surface = fx.surfaceScale ?? 5;
        const str = fx.strength ?? 1.2;
        const lcolor = fx.lightColor ?? "white";
        defs += `<filter id="${fid}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.0" result="bump"/>
          <feDiffuseLighting in="bump" surfaceScale="${surface}" diffuseConstant="${str.toFixed(3)}" lighting-color="${lcolor}" result="diffuse">
            <feDistantLight azimuth="${az}" elevation="${el}"/>
          </feDiffuseLighting>
          <feComposite in="diffuse" in2="SourceAlpha" operator="in" result="diffuseMasked"/>
          <feBlend in="SourceGraphic" in2="diffuseMasked" mode="screen"/>
        </filter>`;
        const wrap: AnimWrap = (s) =>
          s ? `<g filter="url(#${fid})">${s}</g>` : s;
        if (isAll) {
          const p = wrapAll;
          wrapAll = (s) => p(wrap(s));
        }
        if (toDots) {
          const p = wrapDots;
          wrapDots = (s) => p(wrap(s));
        }
        if (toEyes) {
          const p = wrapEyes;
          wrapEyes = (s) => p(wrap(s));
        }
        break;
      }

      case "color-split": {
        // Separate R and B channels by ±offset, G stays centered.
        // Creates colorful fringing at dot edges; dot bodies stay dark.
        const off = fx.offset ?? 0.35;
        const isH = (fx.direction ?? "horizontal") === "horizontal";
        const dx = isH ? off : 0;
        const dy = isH ? 0 : off;
        defs += `<filter id="${fid}" color-interpolation-filters="sRGB">
          <feOffset in="SourceGraphic" dx="${-dx}" dy="${-dy}" result="left"/>
          <feColorMatrix in="left" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>
          <feOffset in="SourceGraphic" dx="${dx}" dy="${dy}" result="right"/>
          <feColorMatrix in="right" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/>
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>
          <feBlend in="r" in2="g" mode="screen" result="rg"/>
          <feBlend in="rg" in2="b" mode="screen"/>
        </filter>`;
        const wrap: AnimWrap = (s) =>
          s ? `<g filter="url(#${fid})">${s}</g>` : s;
        if (isAll) {
          const p = wrapAll;
          wrapAll = (s) => p(wrap(s));
        }
        if (toDots) {
          const p = wrapDots;
          wrapDots = (s) => p(wrap(s));
        }
        if (toEyes) {
          const p = wrapEyes;
          wrapEyes = (s) => p(wrap(s));
        }
        break;
      }
    }
  }

  return { defs, wrapDots, wrapEyes, wrapAll, overlay };
}

export async function QRCodeGenerate(
  options: Options,
  _cachedMatrix?: QRMatrix,
  _frameSecs?: number,
): Promise<QRGenerateResult> {
  const config = {
    ...defaultOptions,
    ...options,
  };
  const matrix: QRMatrix =
    _cachedMatrix ??
    (() => {
      const analyzer = new QRAnalyzer(
        config.data ?? "",
        config.qrOptions?.errorCorrectionLevel || "H",
      );
      return analyzer.getMatrix();
    })();
  const matrixSize = matrix.length;
  // margin is now 0-100 (% of matrixSize). Convert to module units here.
  const margin = ((config.margin ?? 10) / 100) * matrixSize;

  // --- Effective margin: ensure corner modules stay inside the rounded clip ---
  // When borderRadius > 0, analytically compute the minimum margin so that the
  // corner module at (effectiveMargin, effectiveMargin) lies exactly on the clip
  // arc boundary. This avoids any scale transform and fully respects the user's
  // margin when it's already large enough.
  //
  //   Let p  = borderRadius / 100 (0–1)
  //       c  = 1 − 1/√2              (≈ 0.2929, the safe-inset ratio)
  //       k  = p × c
  //   minSafeMargin = k × matrixSize / (2 × (1 − k))
  //
  // Derivation: fullSize = matrixSize + 2m, rx = p × fullSize/2,
  // safeInset = rx × c = m  →  solved for m.
  const clampedBorderRadius =
    config.borderRadius != null
      ? Math.max(0, Math.min(100, config.borderRadius))
      : 0;
  const _c = _wrapperSafeC(config.wrapper, clampedBorderRadius);
  const minSafeMargin = _c > 0 && _c < 1 ? (_c * matrixSize) / (2 * (1 - _c)) : 0;
  const effectiveMargin = Math.max(margin, minSafeMargin);

  // Pre-build bounds (returned alongside svg)
  const _eyeZones: QREyeZone[] = getEyeZones(matrixSize).map((e) => ({
    ...e,
    width: 7,
    height: 7,
  }));
  // getMaxPos: takes percentage inputs, returns percentage max position
  const _getMaxPos = (iwPct: number, ihPct: number) => ({
    maxX: Math.max(0, 100 - iwPct),
    maxY: Math.max(0, 100 - ihPct),
  });
  const _ecl = config.qrOptions?.errorCorrectionLevel || "H";
  const _eclFraction = ECL_SAFE_FRACTION[_ecl] ?? 0.3;
  // maxValues: fixed 0-100 percentages — same for any QR size, only ECL changes them
  const _imageSizeMax = Math.floor(Math.sqrt(_eclFraction) * 100); // H=54 Q=50 M=38 L=26
  const _maxValues: QRMaxValues = {
    imageSize: _imageSizeMax,
    imageMargin: Math.floor(_imageSizeMax / 2),
    frameMargin: 50,
  };
  const base: QRGenerateResultBase = {
    matrixSize,
    eyeZones: _eyeZones,
    maxValues: _maxValues,
    getMaxPos: _getMaxPos,
  };
  const _uid = ++_qrIdCtr;
  const finalizeResult = async (svg: string): Promise<QRGenerateResult> => {
    const prefixed = prefixSvgIds(svg, `qr${_uid}-`);
    const canvas = await svgToCanvas(prefixed, w, h);
    const validate = (tuning?: ValidatorTuning): QRValidateResult => {
      if (!canvas) {
        return {
          valid: false,
          contrastRatio: 1,
          degradedModules: 0,
          totalModules: 0,
          finderPatternsOk: false,
          timingPatternsOk: false,
          eccHeadroom: 0,
          issues: [
            "validate() requires a browser environment (canvas is null)",
          ],
        };
      }
      return validateQRCanvas(canvas, matrix, effectiveMargin, _ecl, tuning);
    };
    const getOption = <K extends "borderRadius">(key: K): number => {
      if (key === "borderRadius") return (clampedBorderRadius / 100) * (w / 2);
      return 0;
    };
    return { ...base, svg: prefixed, canvas, matrix, validate, getOption };
  };

  const fullSize = matrixSize + effectiveMargin * 2;
  const w = config.width ?? 1000;
  const h = config.height ?? 1000;

  const eyes = getEyePositions(matrixSize, effectiveMargin);
  const eyeFrameSize = 7; // Outer frame

  // --- 1. SETUP DEFS ---
  let defsString = "";

  // A. Background Gradient (FIXED)
  if (config.backgroundEnable !== false && config.backgroundOptions?.gradient) {
    defsString += generateGradientDef(
      "grad-bg",
      config.backgroundOptions.gradient,
      0,
      0,
      fullSize,
      fullSize,
    );
  }

  // B. Dots fill — overlays
  const dotsOverlayRefs: string[] = [];
  for (const [i, ov] of (config.dotsOptions.overlays ?? []).entries()) {
    const { defs, fillRef } = generateOverlayLayerDef(
      `dots-${i}`,
      ov,
      fullSize,
    );
    defsString += defs;
    dotsOverlayRefs.push(fillRef);
  }

  // C. Eye fills — overlays
  const squareOverlayRefs: string[] = [];
  const dotOverlayRefs: string[] = [];

  for (const [i, ov] of (
    config.cornersSquareOptions.overlays ?? []
  ).entries()) {
    const { defs, fillRef } = generateOverlayLayerDef(`sq-${i}`, ov, fullSize);
    defsString += defs;
    squareOverlayRefs.push(fillRef);
  }
  for (const [i, ov] of (config.cornersDotOptions.overlays ?? []).entries()) {
    const { defs, fillRef } = generateOverlayLayerDef(`dot-${i}`, ov, fullSize);
    defsString += defs;
    dotOverlayRefs.push(fillRef);
  }

  defsString += createSymbol("icon-dots", config.dotsOptions);
  defsString += createSymbol("icon-sq", config.cornersSquareOptions);
  defsString += createSymbol("icon-dot", config.cornersDotOptions);

  // --- 2. DRAW LOOP ---
  // Arrays instead of string +=: V8 can avoid O(n) copying on each append.
  // Joined once when consumed in the layer generators.
  const usesBuf = { dots: [] as string[], cornerSquare: [] as string[], cornerDot: [] as string[] };
  const pathBuf = { dots: [] as string[], cornerSquare: [] as string[], cornerDot: [] as string[] };

  // Pre-resolve shape type, path key, scale and drawer functions once per call
  // instead of re-looking them up on every matrix cell.
  const dotsShapeType = config.dotsOptions.shape?.type ?? "figure";
  const dotsShapePath = ((config.dotsOptions.shape as any)?.path ?? "square") as string;
  const dotsScale = config.dotsOptions.scale ?? 1;
  const dotsDrawer = neighborShapes[dotsShapePath] ?? neighborShapes["square"];

  const sqShapeType = config.cornersSquareOptions.shape?.type ?? "figure";
  const sqShapePath = ((config.cornersSquareOptions.shape as any)?.path ?? "square") as string;
  const sqScale = config.cornersSquareOptions.scale ?? 1;
  const sqMulti = config.cornersSquareOptions.isSingle === false || sqShapePath === "dots";
  const sqDrawer = neighborShapes[sqShapePath] ?? neighborShapes["square"];
  const sqSingleDrawer = cornerSquares[sqShapePath] ?? cornerSquares["square"];

  const cdShapeType = config.cornersDotOptions.shape?.type ?? "figure";
  const cdShapePath = ((config.cornersDotOptions.shape as any)?.path ?? "square") as string;
  const cdScale = config.cornersDotOptions.scale ?? 1;
  const cdMulti = config.cornersDotOptions.isSingle === false || cdShapePath === "dots";
  const cdDrawer = neighborShapes[cdShapePath] ?? neighborShapes["square"];
  const cdSingleDrawer = cornerDots[cdShapePath] ?? cornerDots["square"];

  const skipMatrix = Array(matrixSize)
    .fill(false)
    .map(() => Array(matrixSize).fill(false));
  // Tracks which eyes have already been drawn for figure-type eye zones
  const drawnEyes = new Set<string>();

  // Resolve auto-positions for images without explicit x/y
  const images = resolveImagePositions(
    config.imageEnable !== false ? config.images || [] : [],
    matrixSize,
    config.qrOptions?.errorCorrectionLevel || "H",
  );

  for (let y = 0; y < matrixSize; y++) {
    for (let x = 0; x < matrixSize; x++) {
      if (skipMatrix[y][x]) continue;
      if (!matrix[y][x].isDark) continue;

      const isBlocked = images.some((img) => {
        if (!img.excludeDots) return false;
        // Use clamped exclusion bounds (excW/excH/excMargin) centred on the image.
        // This prevents an oversized image from wiping all dots even when the
        // visual image is larger than the safe ECL area.
        const cx = img.x + img.width / 2;
        const cy = img.y + img.height / 2;
        const ex = cx - img.excW / 2;
        const ey = cy - img.excH / 2;
        const m = img.excMargin;
        return (
          x >= ex - 0.5 - m &&
          x <= ex + img.excW - 0.5 + m &&
          y >= ey - 0.5 - m &&
          y <= ey + img.excH - 0.5 + m
        );
      });
      if (isBlocked) continue;

      const zone = getModuleZone(x, y, matrixSize);
      // --- Figure rendering (math paths) ---
      if (zone === "dots") {
        if (dotsShapeType === "figure") {
          pathBuf.dots.push(dotsDrawer(
            x + effectiveMargin,
            y + effectiveMargin,
            getNeighbors(x, y, matrix, matrixSize),
            dotsScale,
          ));
          continue;
        }
        // icon / custom-icon / image-icon
        const sw = dotsScale;
        const off = (1 - sw) / 2;
        usesBuf.dots.push(`<use href="#icon-dots" x="${x + effectiveMargin + off}" y="${y + effectiveMargin + off}" width="${sw}" height="${sw}" />`);
        continue;
      }

      if (zone === "cornerSquare") {
        if (sqShapeType === "figure") {
          if (sqMulti) {
            pathBuf.cornerSquare.push(sqDrawer(
              x + effectiveMargin,
              y + effectiveMargin,
              getNeighbors(x, y, matrix, matrixSize),
              sqScale,
            ));
          } else {
            const origin = getEyeOrigin(x, y, matrixSize);
            if (!origin) continue;
            const eyeKey = `sq-${origin.ex}-${origin.ey}`;
            if (!drawnEyes.has(eyeKey)) {
              drawnEyes.add(eyeKey);
              pathBuf.cornerSquare.push(sqSingleDrawer(
                origin.ex + effectiveMargin,
                origin.ey + effectiveMargin,
                7,
              ));
            }
          }
          continue;
        }
        // icon
        if (config.cornersSquareOptions.isSingle !== false) {
          if (!isOuterEyeStart(x, y, matrixSize)) continue;
          const drawSize = 7;
          for (let dy = 0; dy < 7; dy++) {
            for (let dx = 0; dx < 7; dx++) {
              if (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4) continue;
              if (y + dy < matrixSize && x + dx < matrixSize)
                skipMatrix[y + dy][x + dx] = true;
            }
          }
          const sw = drawSize * sqScale;
          const off = (drawSize - sw) / 2;
          usesBuf.cornerSquare.push(`<use href="#icon-sq" x="${x + effectiveMargin + off}" y="${y + effectiveMargin + off}" width="${sw}" height="${sw}" />`);
        } else {
          const sw = sqScale;
          const off = (1 - sw) / 2;
          usesBuf.cornerSquare.push(`<use href="#icon-sq" x="${x + effectiveMargin + off}" y="${y + effectiveMargin + off}" width="${sw}" height="${sw}" />`);
        }
        continue;
      }

      // cornerDot
      if (cdShapeType === "figure") {
        if (cdMulti) {
          pathBuf.cornerDot.push(cdDrawer(
            x + effectiveMargin,
            y + effectiveMargin,
            getNeighbors(x, y, matrix, matrixSize),
            cdScale,
          ));
        } else {
          const origin = getEyeOrigin(x, y, matrixSize);
          if (!origin) continue;
          const eyeKey = `dot-${origin.ex}-${origin.ey}`;
          if (!drawnEyes.has(eyeKey)) {
            drawnEyes.add(eyeKey);
            pathBuf.cornerDot.push(cdSingleDrawer(
              origin.ex + 2 + effectiveMargin,
              origin.ey + 2 + effectiveMargin,
              3,
            ));
          }
        }
        continue;
      }
      // icon
      if (config.cornersDotOptions.isSingle !== false) {
        if (!isInnerEyeStart(x, y, matrixSize)) continue;
        const drawSize = 3;
        for (let dy = 0; dy < 3; dy++) {
          for (let dx = 0; dx < 3; dx++) {
            if (y + dy < matrixSize && x + dx < matrixSize)
              skipMatrix[y + dy][x + dx] = true;
          }
        }
        const sw = drawSize * cdScale;
        const off = (drawSize - sw) / 2;
        usesBuf.cornerDot.push(`<use href="#icon-dot" x="${x + effectiveMargin + off}" y="${y + effectiveMargin + off}" width="${sw}" height="${sw}" />`);
      } else {
        const sw = cdScale;
        const off = (1 - sw) / 2;
        usesBuf.cornerDot.push(`<use href="#icon-dot" x="${x + effectiveMargin + off}" y="${y + effectiveMargin + off}" width="${sw}" height="${sw}" />`);
      }
    }
  }

  // --- 2b. MARGIN FILL DOTS ---
  // • fillMargin === true (or omitted) → push into pathBuf.dots / usesBuf.dots
  //   so margin dots share the same gradient mask as the QR data dots.
  // • fillMargin object → push into separate margin buffers for an independent layer.

  const marginFillPathBuf: string[] = [];
  const marginFillUsesBuf: string[] = [];

  if (config.wrapper && config.wrapper.fillMargin !== false) {
    const fm = config.wrapper.fillMargin;
    const isFmObj = fm !== null && typeof fm === "object";

    const fmCast = isFmObj ? (fm as import("./types").QrWrapperFillMargin) : null;
    const fmShape = fmCast?.shape ?? config.dotsOptions.shape;
    const fmScale = fmCast?.scale ?? config.dotsOptions.scale ?? 1;
    const fmDensity = fmCast?.density ?? 1;

    const fmShapeType = fmShape?.type ?? "figure";
    const fmShapePath = ((fmShape as any)?.path ?? "square") as string;
    const fmIsIcon = fmShapeType === "icon" || fmShapeType === "custom-icon" || fmShapeType === "image-icon";
    const fmDrawer = fmIsIcon ? null : (neighborShapes[fmShapePath] ?? neighborShapes["square"]);
    const fmOffXY = fmIsIcon ? (1 - fmScale) / 2 : 0;
    const noNeighbors: Neighbors = { t: false, r: false, b: false, l: false };

    // Deterministic density hash — returns 0..1 for (mx, my)
    const hashPos = (mx: number, my: number): number => {
      let h = (((mx * 2654435761) ^ (my * 2246822519)) >>> 0);
      h = (((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0);
      return (h >>> 0) / 0x100000000;
    };

    const targetPath = isFmObj ? marginFillPathBuf : pathBuf.dots;
    const targetUses = isFmObj ? marginFillUsesBuf : usesBuf.dots;
    const ext = Math.ceil(effectiveMargin) + 1;

    for (let my = -ext; my < matrixSize + ext; my++) {
      for (let mx = -ext; mx < matrixSize + ext; mx++) {
        if (mx >= 0 && mx < matrixSize && my >= 0 && my < matrixSize) continue;
        if (fmDensity < 1 && hashPos(mx, my) >= fmDensity) continue;

        const px = mx + effectiveMargin;
        const py = my + effectiveMargin;
        if (px >= fullSize || py >= fullSize || px + 1 <= 0 || py + 1 <= 0) continue;

        if (fmIsIcon) {
          targetUses.push(`<use href="#icon-dots" x="${px + fmOffXY}" y="${py + fmOffXY}" width="${fmScale}" height="${fmScale}" />`);
        } else {
          targetPath.push(fmDrawer!(px, py, noNeighbors, fmScale));
        }
      }
    }
  }

  // --- 3. FINAL ASSEMBLY ---

  // Dots Layer (Global Gradient) — combines icon <use> elements and figure <path> data
  const generateDotsLayer = () => {
    const dotUses = usesBuf.dots.join("");
    const dotPath = pathBuf.dots.join("");
    if (!dotUses && !dotPath) return "";

    const maskContent =
      dotUses + (dotPath ? `<path d="${dotPath}" />` : "");

    defsString += `<mask id="mask-dots">
            <rect width="${fullSize}" height="${fullSize}" fill="black" />
            <g fill="white">${maskContent}</g>
        </mask>`;

    if (dotsOverlayRefs.length) {
      return dotsOverlayRefs
        .map((ref, i) => {
          const op = config.dotsOptions.overlays![i].opacity;
          const opAttr = op !== undefined ? ` opacity="${op}"` : "";
          return `<rect width="${fullSize}" height="${fullSize}" fill="${ref}" mask="url(#mask-dots)"${opAttr}/>`;
        })
        .join("");
    }

    return `<rect width="${fullSize}" height="${fullSize}" fill="#000000" mask="url(#mask-dots)"/>`;
  };

  // Margin Fill Layer — rendered only when fillMargin is a QrWrapperFillMargin object.
  // Uses a separate mask/gradient so the margin dots can have independent styling.
  const generateMarginFillLayer = (): string => {
    const mUses = marginFillUsesBuf.join("");
    const mPath = marginFillPathBuf.join("");
    if (!mUses && !mPath) return "";

    const fm = config.wrapper!.fillMargin as import("./types").QrWrapperFillMargin;
    const opacity = fm.opacity ?? 1;
    const opAttr = opacity !== 1 ? ` opacity="${opacity}"` : "";

    let fillRef: string;
    if (fm.gradient) {
      defsString += generateGradientDef("grad-margin-fill", fm.gradient, 0, 0, fullSize, fullSize);
      fillRef = "url(#grad-margin-fill)";
    } else {
      fillRef = fm.color ?? _dotColor(config);
    }

    const maskContent = mUses + (mPath ? `<path d="${mPath}" />` : "");

    defsString += `<mask id="mask-margin-fill">
            <rect width="${fullSize}" height="${fullSize}" fill="black" />
            <g fill="white">${maskContent}</g>
        </mask>`;

    return `<rect width="${fullSize}" height="${fullSize}" fill="${fillRef}" mask="url(#mask-margin-fill)"${opAttr}/>`;
  };

  // Eyes Layer — combines icon <use> elements and figure <path> data.
  // Mask defs are pushed into the root defsString to avoid nested <defs> in
  // the SVG body (non-standard and forces extra DOM parsing per eye layer).
  const generateEyeLayer = (
    key: "cornerSquare" | "cornerDot",
    partConfig: QrPartOptions,
  ) => {
    const eyeUses = usesBuf[key].join("");
    const eyePath = pathBuf[key].join("");
    if (!eyeUses && !eyePath) return "";

    const maskId = `mask-${key}`;
    const maskContent = eyeUses + (eyePath ? `<path d="${eyePath}" />` : "");

    // Push mask into root defs instead of inlining a nested <defs> block.
    defsString += `
        <mask id="${maskId}">
            <rect width="${fullSize}" height="${fullSize}" fill="black" />
            <g fill="white">${maskContent}</g>
        </mask>`;

    const overlayRefs =
      key === "cornerSquare" ? squareOverlayRefs : dotOverlayRefs;
    let rects = "";

    if (overlayRefs.length) {
      overlayRefs.forEach((ref, i) => {
        const op = partConfig.overlays![i].opacity;
        const opAttr = op !== undefined ? ` opacity="${op}"` : "";
        eyes.forEach((eye) => {
          rects += `<rect x="${eye.x}" y="${eye.y}" width="${eyeFrameSize}" height="${eyeFrameSize}" fill="${ref}" mask="url(#${maskId})"${opAttr}/>`;
        });
      });
    } else {
      eyes.forEach((eye) => {
        rects += `<rect x="${eye.x}" y="${eye.y}" width="${eyeFrameSize}" height="${eyeFrameSize}" fill="#000000" mask="url(#${maskId})" />`;
      });
    }
    return rects;
  };

  // Background Fill Logic (Color OR Gradient)
  const getBackgroundFill = () => {
    if (config.backgroundEnable === false) return "none";
    if (config.backgroundOptions?.gradient) return "url(#grad-bg)";
    return config.backgroundOptions?.color || "white";
  };

  // Images SVG (x/y are always resolved by resolveImagePositions)
  let imagesSvg = "";
  images.forEach((img) => {
    const imgX = img.x + effectiveMargin;
    const imgY = img.y + effectiveMargin;
    const par = img.preserveAspectRatio ?? "xMidYMid meet";
    const opacityAttr = img.opacity != null ? ` opacity="${img.opacity}"` : "";
    imagesSvg += `<image href="${img.source}" x="${imgX}" y="${imgY}" width="${img.width}" height="${img.height}" preserveAspectRatio="${par}"${opacityAttr} />`;
  });

  // ── Clip path + wrapper ring setup ────────────────────────────────────────
  // wrapper takes priority over borderRadius.
  //
  // When strokeWidth > 0 the ring is a FILLED DONUT rendered as a separate
  // design layer outside the clipped QR content:
  //   • QR content is clipped to the shape inset by strokeWidth
  //   • A mask punches the inner shape out of the outer shape → donut ring
  //   • The ring is filled with stroke/strokeGradient color
  //
  // This ensures the ring is a proper design element, not a simple line.
  let clipPathDef = "";
  let clipAttr = "";
  let bgRxAttr = ""; // only used for background rect in legacy borderRadius mode
  let wrapperRingSvg = ""; // donut ring rendered outside the clipped group

  const wrapper = config.wrapper;
  if (wrapper) {
    const sw = wrapper.strokeWidth ?? 0;
    const hasRing =
      sw > 0 && (wrapper.stroke != null || wrapper.strokeGradient != null);

    // ── Build path strings for outer and inner (clip) boundaries ─────────────
    let outerD: string;
    let innerD: string;

    if (wrapper.path) {
      // Custom path: scale from user viewBox coordinate space
      const vbParts = (wrapper.viewBox ?? "0 0 1 1")
        .split(/[\s,]+/)
        .map(Number);
      const vbW = vbParts[2] ?? 1;
      const vbH = vbParts[3] ?? 1;
      // Outer: scale to fill fullSize
      const sxO = (fullSize / vbW).toFixed(6);
      const syO = (fullSize / vbH).toFixed(6);
      outerD = `<path d="${wrapper.path}" transform="scale(${sxO},${syO})" />`;
      if (hasRing) {
        // Inner: scale to fill (fullSize - 2*sw), translated by sw
        const is = fullSize - 2 * sw;
        const sxI = (is / vbW).toFixed(6);
        const syI = (is / vbH).toFixed(6);
        innerD = `<path d="${wrapper.path}" transform="translate(${sw},${sw}) scale(${sxI},${syI})" />`;
      } else {
        innerD = outerD;
      }
    } else {
      const shape = wrapper.shape ?? "circle";
      outerD = `<path d="${buildWrapperShapePath(shape, fullSize, 0)}" />`;
      innerD = hasRing
        ? `<path d="${buildWrapperShapePath(shape, fullSize, sw)}" />`
        : outerD;
    }

    // Clip uses the inner (inset) boundary so ring area is outside the clip
    clipPathDef = `<clipPath id="qr-clip">${innerD}</clipPath>`;
    clipAttr = `clip-path="url(#qr-clip)"`;

    // ── Ring: filled donut via SVG mask ───────────────────────────────────────
    if (hasRing) {
      // Gradient or solid fill for the ring
      let ringFill: string;
      if (wrapper.strokeGradient) {
        defsString += generateGradientDef(
          "grad-wrapper-ring",
          wrapper.strokeGradient,
          0,
          0,
          fullSize,
          fullSize,
        );
        ringFill = "url(#grad-wrapper-ring)";
      } else {
        ringFill = wrapper.stroke!;
      }

      // Mask: outer shape is white (visible area), inner shape is black (hole)
      defsString += `
        <mask id="wrapper-ring-mask">
          ${outerD.replace("<path ", `<path fill="white" `)}
          ${innerD.replace("<path ", `<path fill="black" `)}
        </mask>`;

      wrapperRingSvg = `<rect width="${fullSize}" height="${fullSize}" fill="${ringFill}" mask="url(#wrapper-ring-mask)" />`;
    }
  } else {
    // Legacy: borderRadius → rounded-rect clip
    const borderRadius = (clampedBorderRadius / 100) * (fullSize / 2);
    if (borderRadius > 0) {
      bgRxAttr = `rx="${borderRadius.toFixed(3)}"`;
      clipPathDef = `<clipPath id="qr-clip"><rect width="${fullSize}" height="${fullSize}" ${bgRxAttr} /></clipPath>`;
      clipAttr = `clip-path="url(#qr-clip)"`;
    }
  }

  // Decorations: shapes scattered in the empty margin space outside the QR matrix.
  const decorationsSvg = generateDecorationsSvg(
    config.decorations ?? [],
    effectiveMargin,
    matrixSize,
    fullSize,
  );

  // Effects (static SVG filters + blend modes)
  const fxList: QrEffect[] = config.effects ?? [];
  const {
    defs: fxDefs,
    wrapDots: fxWrapDots,
    wrapEyes: fxWrapEyes,
    wrapAll: fxWrapAll,
    overlay: fxOverlay,
  } = buildEffects(fxList, fullSize, String(_uid), _dotColor(config));

  // Animation (temporal wrappers applied on top of effects)
  const animList: QrAnimation[] = config.animation ?? [];
  const {
    defs: animDefs,
    wrapDots: animWrapDots,
    wrapEyes: animWrapEyes,
    wrapContent: animWrapContent,
    overlay: animOverlay,
  } = buildAnimations(
    animList,
    fullSize,
    String(_uid),
    _dotColor(config),
    _frameSecs,
  );

  // Build layers: effects applied first (inner), animations wrap on top (outer)
  const dotsLayer = animWrapDots(fxWrapDots(generateDotsLayer()));
  const marginFillLayer = generateMarginFillLayer();
  const eyesLayer = animWrapEyes(
    fxWrapEyes(
      generateEyeLayer("cornerSquare", config.cornersSquareOptions) +
        generateEyeLayer("cornerDot", config.cornersDotOptions),
    ),
  );
  const bgImage =
    config.backgroundEnable !== false && config.backgroundOptions?.image
      ? `<image href="${config.backgroundOptions.image}" width="${fullSize}" height="${fullSize}" preserveAspectRatio="none" />`
      : "";
  const bgMinContrast = (() => {
    if (!bgImage) return "";
    const op = config.backgroundOptions?.minContrast ?? 0;
    if (op <= 0) return "";
    return `<rect width="${fullSize}" height="${fullSize}" fill="rgba(0,0,0,${Math.min(1, op).toFixed(3)})" style="pointer-events:none"/>`;
  })();

  // QR content: clipped group + ring layer on top
  const qrContent = `
    <defs>${defsString}${fxDefs}${animDefs}${clipPathDef}</defs>
    <g ${clipAttr}>
      ${animWrapContent(
        fxWrapAll(`<rect width="${fullSize}" height="${fullSize}" fill="${getBackgroundFill()}" ${bgRxAttr}/>
      ${bgImage}
      ${bgMinContrast}
      ${decorationsSvg}
      ${dotsLayer}
      ${marginFillLayer}
      ${eyesLayer}
      ${imagesSvg}
      ${fxOverlay}
      ${animOverlay}`),
      )}
    </g>
    ${wrapperRingSvg}`;

  // --- Frame label renderer ---
  /**
   * Renders a QrLabel as SVG text (+ optional background rect + defs) placed
   * inside the outer frame coordinate space (frame pixels, not QR modules).
   *
   * Position semantics:
   *   top    – strip above QR inset, full frame width, bottom margin toward QR
   *   bottom – strip below QR inset, full frame width, top margin toward QR
   *   center – inside QR inset, text centred
   *   custom – label.x / label.y are the text centre point (frame px)
   *   auto   – picks top or bottom strip based on which has more vertical space;
   *            label width = 100 % of that strip's width
   *
   * Text is auto-sized (fontSize derived from zone height) unless label.fontSize
   * is provided.  textLength + lengthAdjust ensure the text fills the label width.
   */
  function renderFrameLabel(
    label: import("./types").QrLabel,
    inset: { x: number; y: number; width: number; height: number },
    frameW: number,
    frameH: number,
  ): string {
    if (!label.text) return "";
    const text = label.text;
    const isRounded = label.style === "rounded";
    const gapMargin = label.margin ?? 8;
    // For rounded arc text, default to "top" so omitting position still works
    const pos = label.position ?? (isRounded ? "top" : "bottom");
    // Pre-escape text so both flat and arc paths can use it
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    // ── Zone: area allocated for the label (frame-px coords) ──────────────────
    // For top / bottom / auto we use the full frame width so the label is
    // horizontally centred across the whole frame (common in real frame designs).
    let zoneX: number;
    let zoneY: number;
    let zoneW: number;
    let zoneH: number;
    // Margins on each vertical side (gap toward the QR edge)
    let mTop: number;
    let mBottom: number;
    // Where the text anchors within the zone:
    //   "qr"     → adjacent to the QR code (bottom of top-strip / top of bottom-strip)
    //   "center" → vertically centred (used for "center" and "custom")
    let vAnchor: "qr" | "center" = "qr";

    switch (pos) {
      case "top":
        zoneX = inset.x;
        zoneY = 0;
        zoneW = inset.width;
        zoneH = inset.y;
        mTop = gapMargin * 0.3;
        mBottom = gapMargin;
        vAnchor = "qr"; // snap to bottom of zone (near QR top edge)
        break;

      case "center":
        zoneX = inset.x;
        zoneY = inset.y;
        zoneW = inset.width;
        zoneH = inset.height;
        mTop = gapMargin;
        mBottom = gapMargin;
        vAnchor = "center";
        break;

      case "auto": {
        const topH = inset.y;
        const bottomH = frameH - (inset.y + inset.height);
        if (topH >= bottomH) {
          zoneX = inset.x;
          zoneY = 0;
          zoneW = inset.width;
          zoneH = topH;
          mTop = gapMargin * 0.3;
          mBottom = gapMargin;
          vAnchor = "qr"; // bottom of top-strip → adjacent to QR
        } else {
          zoneX = inset.x;
          zoneY = inset.y + inset.height;
          zoneW = inset.width;
          zoneH = bottomH;
          mTop = gapMargin;
          mBottom = gapMargin * 0.3;
          vAnchor = "qr"; // top of bottom-strip → adjacent to QR
        }
        break;
      }

      case "custom": {
        const customW = label.width ?? inset.width;
        const cx = label.x ?? inset.x + inset.width / 2;
        const cy = label.y ?? inset.y + inset.height + gapMargin + 20;
        const estimatedH = (label.fontSize ?? 24) * 1.4;
        zoneX = cx - customW / 2;
        zoneY = cy - estimatedH / 2;
        zoneW = customW;
        zoneH = estimatedH;
        mTop = 0;
        mBottom = 0;
        vAnchor = "center";
        break;
      }

      case "bottom":
      default:
        zoneX = inset.x;
        zoneY = inset.y + inset.height;
        zoneW = inset.width;
        zoneH = frameH - (inset.y + inset.height);
        mTop = gapMargin;
        mBottom = gapMargin * 0.3;
        vAnchor = "qr"; // snap to top of zone (near QR bottom edge)
        break;
    }

    // ── Available dimensions inside the zone ──────────────────────────────────
    const availH = zoneH - mTop - mBottom;
    const availW = zoneW - gapMargin * 2;
    if (availH <= 0 || availW <= 0) return "";

    // Label width: explicit value capped to available, or fill available
    const labelW = label.width != null ? Math.min(label.width, availW) : availW;

    // ── Font size ─────────────────────────────────────────────────────────────
    // Three independent upper bounds — take the minimum:
    //  1. frameH × 7 % — keeps the label proportional to the overall frame
    //     regardless of how tall the free zone happens to be
    //  2. availH × 0.5 — never taller than half the zone (padding room)
    //  3. labelW / (chars × 0.6) — estimated natural character width cap,
    //     prevents excessive horizontal compression on long strings
    // Average character width ≈ fontSize × 0.6 for a typical sans-serif.
    const CHAR_RATIO = 0.6;
    const maxFontByFrame = frameH * 0.07;
    const maxFontByHeight = availH * 0.5;
    const maxFontByWidth = labelW / (Math.max(1, text.length) * CHAR_RATIO);
    const fontSize =
      label.fontSize != null
        ? label.fontSize
        : Math.max(
            8,
            Math.min(maxFontByFrame, maxFontByHeight, maxFontByWidth),
          );

    // ── Text anchor point (centre of the text rect) ───────────────────────────
    let textCX: number;
    let textCY: number;

    textCX = zoneX + zoneW / 2;

    if (pos === "custom") {
      textCX = label.x ?? inset.x + inset.width / 2;
      textCY = label.y ?? inset.y + inset.height + gapMargin + fontSize / 2;
    } else if (vAnchor === "center") {
      // Vertically centred inside the zone
      textCY = zoneY + mTop + availH / 2;
    } else {
      // "qr" anchor: snap text to the QR-adjacent edge of the zone
      // top-strip  → text sits at the bottom (near QR top edge): zoneY + zoneH - mBottom - fontSize/2
      // bottom-strip → text sits at the top (near QR bottom edge): zoneY + mTop + fontSize/2
      const nearBottom = pos === "top" || (pos === "auto" && zoneY === 0);
      textCY = nearBottom
        ? zoneY + zoneH - mBottom - fontSize / 2
        : zoneY + mTop + fontSize / 2;
    }

    // ── Rounded: curved text along the QR circle arc ──────────────────────────
    // Arc radius is derived from the QR background circle so the text always
    // wraps around the QR at its boundary — no manual radius tuning needed.
    //
    // "top"    → CCW arc over the top  (ascenders face outward / up)
    // "bottom" → CW  arc under the bottom (letters concave-up)
    // "auto"   → picks top or bottom by available strip height
    // default (no position set) → top arc
    //
    // dominant-baseline="central" centers glyphs vertically ON the arc path
    // so text is perfectly centered inside the arc background band.
    if (isRounded && pos !== "center" && pos !== "custom") {
      // Arc wraps the QR background circle — center = QR inset centre,
      // radius = QR circle radius + gapMargin (just outside the QR background).
      const arcCX = inset.x + inset.width / 2;
      const arcCY = inset.y + inset.height / 2;
      const arcR = Math.min(inset.width, inset.height) / 2 + gapMargin;

      if (arcR <= 0) return "";

      // top / auto → arc over the top; bottom → arc under the bottom
      const isTopArc = pos !== "bottom";

      const ax1 = (arcCX - arcR).toFixed(2);
      const ax2 = (arcCX + arcR).toFixed(2);
      const acy = arcCY.toFixed(2);
      // top  → sweep=0 (CCW) — arc goes over the top of the frame circle
      // bottom → sweep=1 (CW) — arc goes under the bottom of the frame circle
      const sweep = isTopArc ? 0 : 1;
      const arcPath = `M ${ax1},${acy} A ${arcR.toFixed(2)} ${arcR.toFixed(2)} 0 0 ${sweep} ${ax2},${acy}`;

      // Unique path ID per document
      const arcId = `_larc_${Math.round(arcCX)}_${Math.round(arcCY)}_${isTopArc ? "t" : "b"}`;

      // Text fill (colour or gradient)
      const arcNatW = text.length * fontSize * CHAR_RATIO;
      let arcDefsStr = "";
      let arcTextFill: string;
      if (label.fontGradient) {
        const arcTextY = isTopArc
          ? arcCY - arcR - fontSize / 2
          : arcCY + arcR - fontSize / 2;
        arcDefsStr += generateGradientDef(
          "grad-arc-text",
          label.fontGradient,
          arcCX - arcNatW / 2,
          arcTextY,
          arcNatW,
          fontSize,
        );
        arcTextFill = "url(#grad-arc-text)";
      } else {
        arcTextFill = label.fontColor ?? "#000000";
      }

      // Optional background: thick stroked arc band centered on the path
      let arcBgStr = "";
      const bgStrokeW = (fontSize * 1.8).toFixed(2);
      if (label.fontBackgroundGradient) {
        arcDefsStr += generateGradientDef(
          "grad-arc-bg",
          label.fontBackgroundGradient,
          arcCX - arcR,
          arcCY - arcR,
          arcR * 2,
          arcR * 2,
        );
        arcBgStr = `<path d="${arcPath}" fill="none" stroke="url(#grad-arc-bg)" stroke-width="${bgStrokeW}" stroke-linecap="round"/>`;
      } else if (label.fontBackgroundColor) {
        arcBgStr = `<path d="${arcPath}" fill="none" stroke="${label.fontBackgroundColor}" stroke-width="${bgStrokeW}" stroke-linecap="round"/>`;
      }

      const textAttrs: string[] = [
        `font-size="${fontSize.toFixed(2)}"`,
        `font-family="${label.fontFamily ?? "sans-serif"}"`,
        // Centers glyphs vertically ON the arc path (inside the background band)
        `dominant-baseline="central"`,
        `fill="${arcTextFill}"`,
      ];
      if (label.fontWeight != null)
        textAttrs.push(`font-weight="${label.fontWeight}"`);
      if (label.fontStyle) textAttrs.push(`font-style="${label.fontStyle}"`);

      const arcDefsBlock = `<defs>${arcDefsStr}<path id="${arcId}" d="${arcPath}" fill="none"/></defs>`;
      const arcText = `<text ${textAttrs.join(" ")}><textPath href="#${arcId}" startOffset="50%" text-anchor="middle">${escaped}</textPath></text>`;
      return `${arcDefsBlock}${arcBgStr}${arcText}`;
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── textLength — overflow protection only, never stretch ──────────────────
    // Only applied when the estimated natural width exceeds labelW (compress to fit).
    // Short / medium text is centred at its natural width without distortion.
    const estimatedNaturalW = text.length * fontSize * CHAR_RATIO;
    const clampText = estimatedNaturalW > labelW;

    // ── Background rect ───────────────────────────────────────────────────────
    // Width: full zone width for strip positions (top/bottom/auto) so the
    // colour band spans edge-to-edge like a real frame label.
    // Height: always tight around the text (fontSize + vertical padding) —
    // never the full zone height, which could cover the whole frame image.
    const isStrip = pos === "top" || pos === "bottom" || pos === "auto";
    const bgPadY = fontSize * 0.2;
    const bgPadX = fontSize * 0.3;
    const bgX = isStrip ? zoneX : textCX - labelW / 2 - bgPadX;
    const bgY = textCY - fontSize / 2 - bgPadY;
    const bgW = isStrip ? zoneW : labelW + bgPadX * 2;
    const bgH = fontSize + bgPadY * 2;

    let defsStr = "";
    let bgStr = "";

    if (label.fontBackgroundGradient) {
      defsStr += generateGradientDef(
        "grad-label-bg",
        label.fontBackgroundGradient,
        bgX,
        bgY,
        bgW,
        bgH,
      );
      bgStr = `<rect x="${bgX.toFixed(2)}" y="${bgY.toFixed(2)}" width="${bgW.toFixed(2)}" height="${bgH.toFixed(2)}" fill="url(#grad-label-bg)" />`;
    } else if (label.fontBackgroundColor) {
      bgStr = `<rect x="${bgX.toFixed(2)}" y="${bgY.toFixed(2)}" width="${bgW.toFixed(2)}" height="${bgH.toFixed(2)}" fill="${label.fontBackgroundColor}" />`;
    }

    // ── Text fill (solid colour or gradient) ──────────────────────────────────
    const textGradW = clampText ? labelW : estimatedNaturalW;
    let textFill: string;
    if (label.fontGradient) {
      defsStr += generateGradientDef(
        "grad-label-text",
        label.fontGradient,
        textCX - textGradW / 2,
        textCY - fontSize / 2,
        textGradW,
        fontSize,
      );
      textFill = "url(#grad-label-text)";
    } else {
      textFill = label.fontColor ?? "#000000";
    }

    // ── Build <text> element ──────────────────────────────────────────────────
    const textAttrs: string[] = [
      `x="${textCX.toFixed(2)}"`,
      `y="${textCY.toFixed(2)}"`,
      `text-anchor="middle"`,
      `dominant-baseline="central"`,
      `font-size="${fontSize.toFixed(2)}"`,
      `font-family="${label.fontFamily ?? "sans-serif"}"`,
    ];
    if (label.fontWeight != null)
      textAttrs.push(`font-weight="${label.fontWeight}"`);
    if (label.fontStyle) textAttrs.push(`font-style="${label.fontStyle}"`);
    textAttrs.push(`fill="${textFill}"`);
    // Apply textLength only to compress overflowing text (never to expand short text)
    if (clampText) {
      textAttrs.push(`textLength="${labelW.toFixed(2)}"`);
      textAttrs.push(`lengthAdjust="spacingAndGlyphs"`);
    }

    const defsBlock = defsStr ? `<defs>${defsStr}</defs>` : "";
    return `${defsBlock}${bgStr}<text ${textAttrs.join(" ")}>${escaped}</text>`;
  }

  // --- Frame composition ---
  const frame = config.frameEnable !== false ? config.frame : undefined;

  if (frame) {
    // Resolve inset (where QR sits inside the frame), in frame pixels
    const userInset = frame.inset;
    const needsAutoPosition =
      !userInset || userInset.x == null || userInset.y == null;

    // Detect the hole in the frame whenever we need auto-positioning
    let detectedZone = needsAutoPosition
      ? await detectFrameInset(frame.source, frame.width, frame.height)
      : null;

    // Fallback detected zone: 80% centered
    if (needsAutoPosition && !detectedZone) {
      const fw = frame.width * 0.8;
      const fh = frame.height * 0.8;
      detectedZone = {
        x: (frame.width - fw) / 2,
        y: (frame.height - fh) / 2,
        width: fw,
        height: fh,
      };
    }

    // Final dimensions — prefer user-specified, else use detected
    const iw = userInset?.width ?? detectedZone!.width;
    const ih = userInset?.height ?? detectedZone!.height;

    // Final position — if x/y given use them; otherwise center within detected zone
    const ix = userInset?.x ?? detectedZone!.x + (detectedZone!.width - iw) / 2;
    const iy =
      userInset?.y ?? detectedZone!.y + (detectedZone!.height - ih) / 2;

    const inset = { x: ix, y: iy, width: iw, height: ih };

    // Output size: use frame dimensions unless overridden
    const svgW = config.width ?? frame.width;
    const svgH = config.height ?? frame.height;

    // Uniform scale: fit the square QR into the inset area without stretching.
    // Use the smaller dimension so the QR always fits, then centre within the inset.
    const scale = Math.min(inset.width, inset.height) / fullSize;
    const qrDisplaySize = scale * fullSize;
    const qrOffsetX = inset.x + (inset.width - qrDisplaySize) / 2;
    const qrOffsetY = inset.y + (inset.height - qrDisplaySize) / 2;

    // Collect all labels: single `label` (backward compat) + `labels` array
    const allLabels = [
      ...(frame.label ? [frame.label] : []),
      ...(frame.labels ?? []),
    ];
    const labelSvg = allLabels
      .map((l) => renderFrameLabel(l, inset, frame.width, frame.height))
      .join("");

    return finalizeResult(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${frame.width} ${frame.height}" width="${svgW}" height="${svgH}">
      <!-- Frame image (behind everything) -->
      <image href="${frame.source}" x="0" y="0" width="${frame.width}" height="${frame.height}" preserveAspectRatio="xMidYMid slice" />
      <!-- QR code scaled into the inset area -->
      <g transform="translate(${qrOffsetX.toFixed(3)}, ${qrOffsetY.toFixed(3)}) scale(${scale.toFixed(6)}, ${scale.toFixed(6)})">
        ${qrContent}
      </g>
      ${labelSvg}
    </svg>`);
  }

  // --- No frame: standard output ---
  return finalizeResult(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fullSize} ${fullSize}" width="${w}" height="${h}">
    ${qrContent}
  </svg>`);
}

// --- UI Utilities ---

export interface QREyeZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface QRBounds {
  /** Size of the QR matrix in modules (e.g. 31 for a version-3 QR) */
  matrixSize: number;
  /** The 3 eye (finder pattern) zones in module coordinates */
  eyeZones: QREyeZone[];
  /** Slider/input maximums derived from this QR's matrix size and ECL. */
  maxValues: QRMaxValues;
  /**
   * Returns the maximum allowed top-left position for an image of the given size,
   * so it stays fully inside the QR area.
   *   maxX = matrixSize - imageWidth
   *   maxY = matrixSize - imageHeight
   * Use these as the upper bound for your x/y position inputs.
   */
  getMaxPos: (
    imageWidth: number,
    imageHeight: number,
  ) => { maxX: number; maxY: number };
}

/**
 * Returns bounds information for constraining image position inputs in a UI.
 *
 * @example
 * const { matrixSize, eyeZones, getMaxPos } = getQRBounds('https://example.com');
 * const { maxX, maxY } = getMaxPos(imageWidth, imageHeight);
 * // Use maxX / maxY as slider/input max values
 */
export function getQRBounds(
  data: string,
  errorCorrectionLevel: "L" | "M" | "Q" | "H" = "H",
): QRBounds {
  const analyzer = new QRAnalyzer(data, errorCorrectionLevel);
  const matrixSize = analyzer.getMatrix().length;

  const eyeZones: QREyeZone[] = getEyeZones(matrixSize).map((e) => ({
    ...e,
    width: 7,
    height: 7,
  }));

  const _eclFraction = ECL_SAFE_FRACTION[errorCorrectionLevel] ?? 0.3;
  const _imageSizeMax = Math.floor(Math.sqrt(_eclFraction) * 100);

  return {
    matrixSize,
    eyeZones,
    maxValues: {
      imageSize: _imageSizeMax,
      imageMargin: Math.floor(_imageSizeMax / 2),
      frameMargin: 50,
    },
    getMaxPos: (iwPct: number, ihPct: number) => ({
      maxX: Math.max(0, 100 - iwPct),
      maxY: Math.max(0, 100 - ihPct),
    }),
  };
}

// --- QRCodeCreate: stateful instance with update() and matrix caching ---

/** Deep-merge QR options: nested option objects are merged rather than replaced. */
function mergeQROptions(base: Options, updates: Partial<Options>): Options {
  const result: Options = { ...base };
  for (const _k in updates) {
    const k = _k as keyof Options;
    const bv = base[k];
    const uv = updates[k];
    if (uv === undefined) continue;
    if (
      uv !== null &&
      typeof uv === "object" &&
      !Array.isArray(uv) &&
      bv !== null &&
      typeof bv === "object" &&
      !Array.isArray(bv)
    ) {
      (result as Record<string, unknown>)[k] = {
        ...(bv as object),
        ...(uv as object),
      };
    } else {
      (result as Record<string, unknown>)[k] = uv;
    }
  }
  return result;
}

/**
 * A live QR code handle returned by {@link createQRCode}.
 * Call {@link QRCodeHandle.update} to re-render with new options — the QR
 * matrix is cached and reused whenever `data` and `qrOptions` are unchanged,
 * so style-only updates skip the expensive matrix generation step.
 */
export interface QRCodeHandle extends QRGenerateResult {
  /**
   * Merge `partialOptions` into the current options and re-render.
   * Nested option objects (dotsOptions, backgroundOptions, …) are merged at
   * one level deep, so you can change a single sub-field without re-specifying
   * the whole object.
   * Returns the same handle (mutated in-place) for easy chaining.
   */
  update(partialOptions: Partial<Options>): Promise<QRCodeHandle>;
}

/**
 * Create a QR code instance that supports incremental updates.
 *
 * Unlike {@link QRCodeGenerate}, the returned handle caches the QR matrix and
 * only rebuilds it when `data` or `qrOptions.errorCorrectionLevel` changes.
 * Style-only updates (colors, shapes, images, …) skip matrix generation and
 * re-render the SVG directly, which is significantly faster for interactive UIs.
 *
 * @example
 * ```ts
 * const qr = await createQRCode({ data: "https://example.com", width: 400, height: 400 });
 * document.body.innerHTML = qr.svg;
 *
 * // Change only the dot color — matrix is reused
 * await qr.update({ dotsOptions: { color: "#e11d48" } });
 * document.body.innerHTML = qr.svg;
 * ```
 */
export async function createQRCode(
  initialOptions: Options,
): Promise<QRCodeHandle> {
  let opts: Options = { ...initialOptions };
  let cachedMatrix: QRMatrix | null = null;
  let cachedData = "";
  let cachedEcl = "";

  async function build(): Promise<QRGenerateResult> {
    const merged = { ...defaultOptions, ...opts };
    const data = merged.data ?? "";
    const ecl = merged.qrOptions?.errorCorrectionLevel ?? "H";

    if (!cachedMatrix || data !== cachedData || ecl !== cachedEcl) {
      const analyzer = new QRAnalyzer(data, ecl);
      cachedMatrix = analyzer.getMatrix();
      cachedData = data;
      cachedEcl = ecl;
    }

    return QRCodeGenerate(opts, cachedMatrix);
  }

  const initial = await build();

  const handle: QRCodeHandle = {
    svg: initial.svg,
    canvas: initial.canvas,
    matrix: initial.matrix,
    matrixSize: initial.matrixSize,
    eyeZones: initial.eyeZones,
    maxValues: initial.maxValues,
    getMaxPos: initial.getMaxPos,
    validate: initial.validate,
    getOption: initial.getOption,

    async update(partialOptions: Partial<Options>): Promise<QRCodeHandle> {
      opts = mergeQROptions(opts, partialOptions);
      const result = await build();
      handle.svg = result.svg;
      handle.canvas = result.canvas;
      handle.matrix = result.matrix;
      handle.matrixSize = result.matrixSize;
      handle.eyeZones = result.eyeZones;
      handle.maxValues = result.maxValues;
      handle.getMaxPos = result.getMaxPos;
      handle.validate = result.validate;
      handle.getOption = result.getOption;
      return handle;
    },
  };

  return handle;
}

// ---------------------------------------------------------------------------
// DOM utilities (browser-only)
// ---------------------------------------------------------------------------

export interface TransitionOptions {
  /** Cross-fade duration in ms. 0 = instant swap. Default 250. */
  duration?: number;
  /** CSS easing function. Default "ease-in-out". */
  easing?: string;
}

/**
 * Render or cross-fade a new QR SVG into a container element.
 *
 * Uses CSS Grid overlap so the container grows to the natural SVG size without
 * requiring explicit width/height. Safe to call rapidly — if called while a
 * previous transition is still running the outgoing layer is reused as the new
 * "old" frame, so layers never accumulate.
 *
 * @param container  DOM element that receives the QR layers.
 * @param newSvg     SVG string from `QRCodeGenerate` or `handle.svg`.
 * @param opts       Optional transition duration/easing.
 *
 * @example
 * // First render
 * const handle = await createQRCode(options);
 * crossFadeQR(containerEl, handle.svg);
 *
 * // Later update — matrix is reused when data/ecl unchanged, then cross-faded
 * await handle.update({ dotsOptions: { color: '#e11d48' } });
 * crossFadeQR(containerEl, handle.svg, { duration: 400 });
 */
export function crossFadeQR(
  container: HTMLElement,
  newSvg: string,
  opts: TransitionOptions = {},
): void {
  const dur = opts.duration ?? 250;
  const ease = opts.easing ?? "ease-in-out";

  // Instant path
  if (dur <= 0) {
    container.innerHTML = newSvg;
    return;
  }

  // Grid stacking: children placed in the same cell overlap naturally.
  // Only set once — don't clobber an existing display value.
  if (!container.dataset.qrInit) {
    container.dataset.qrInit = "1";
    container.style.display = "grid";
  }

  const prev = container.lastElementChild as HTMLElement | null;

  const layer = document.createElement("div");
  layer.style.cssText = `grid-area:1/1/2/2;opacity:0;will-change:opacity`;
  layer.innerHTML = newSvg;
  container.appendChild(layer);

  // Force a layout pass so the transition fires from 0→1 rather than jumping.
  layer.getBoundingClientRect();

  layer.style.transition = `opacity ${dur}ms ${ease}`;
  layer.style.opacity = "1";

  if (prev) {
    prev.style.transition = `opacity ${dur}ms ${ease}`;
    prev.style.opacity = "0";
    // Remove after transition to keep DOM clean.
    // `transitionend` is unreliable under rapid calls, so use a timer.
    setTimeout(() => prev.remove(), dur + 32);
  }
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
