import { QRAnalyzer } from "./core/analyzer";
import { shapes } from "./renderer/shapes";
import { NewQRConfig, QrPart, QrImage, QrFrame, Gradient } from "./types";
import { detectFrameInset } from "./frame-inset";
import { exportQR, ExportFormat, ExportOptions } from "./export";

export { exportQR };
export type { ExportFormat, ExportOptions };

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
  const positions = [
    { x: 2, y: 2 },
    { x: size - 7 + 2, y: 2 },
    { x: 2, y: size - 7 + 2 },
  ];
  return positions.some((p) => p.x === x && p.y === y);
}

// Генератор градієнтів з прив'язкою до конкретної зони (bx, by, bw, bh)
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

  // Центр зони
  const cx = bx + bw / 2;
  const cy = by + bh / 2;

  // Радіус (половина діагоналі)
  const r = Math.sqrt(bw * bw + bh * bh) / 2;

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

function createSymbol(id: string, part: QrPart): string {
  if (part.shape === "custom-icon" && part.customIconPath) {
    return `
        <symbol id="${id}" viewBox="${part.customIconViewBox || "0 0 24 24"}">
          <path d="${part.customIconPath}" /> 
        </symbol>
      `;
  }
  return "";
}

// --- Auto-layout for images without explicit x/y ---

/** Returns the 3 eye zones (7×7 blocks) in matrix coordinates (no padding). */
function getEyeZones(matrixSize: number) {
  return [
    { id: "top-left", x: 0, y: 0 },
    { id: "top-right", x: matrixSize - 7, y: 0 },
    { id: "bottom-left", x: 0, y: matrixSize - 7 },
  ];
}

/**
 * Returns true if a rectangle [rx, ry, rw, rh] overlaps any of the 3 eye zones.
 */
function overlapsEye(
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  matrixSize: number,
): boolean {
  for (const e of getEyeZones(matrixSize)) {
    if (rx < e.x + 7 && rx + rw > e.x && ry < e.y + 7 && ry + rh > e.y)
      return true;
  }
  return false;
}

/**
 * If a manually-positioned image overlaps an eye zone, push it to the nearest
 * safe side and log a console.warn with the original vs adjusted coordinates.
 */
function clampImageFromEyes(
  img: import("./types").QrImage,
  imgIndex: number,
  matrixSize: number,
): import("./types").QrImage {
  let x = img.x!;
  let y = img.y!;

  for (const e of getEyeZones(matrixSize)) {
    const overlapX = x < e.x + 7 && x + img.width > e.x;
    const overlapY = y < e.y + 7 && y + img.height > e.y;
    if (!overlapX || !overlapY) continue;

    // Find the axis with the smallest penetration depth and push out
    const opts = [
      { axis: "x" as const, dir: 1, depth: e.x + 7 - x },
      { axis: "x" as const, dir: -1, depth: x + img.width - e.x },
      { axis: "y" as const, dir: 1, depth: e.y + 7 - y },
      { axis: "y" as const, dir: -1, depth: y + img.height - e.y },
    ]
      .filter((o) => o.depth > 0)
      .sort((a, b) => a.depth - b.depth);

    if (!opts.length) continue;
    const fix = opts[0];
    const origX = x;
    const origY = y;

    if (fix.axis === "x") x = fix.dir > 0 ? e.x + 7 : e.x - img.width;
    else y = fix.dir > 0 ? e.y + 7 : e.y - img.height;

    console.warn(
      `[QR] images[${imgIndex}] overlaps the "${e.id}" eye zone. ` +
        `Auto-adjusted: (${origX.toFixed(1)}, ${origY.toFixed(1)}) → (${x.toFixed(1)}, ${y.toFixed(1)}).`,
    );
  }

  return { ...img, x, y };
}

/**
 * Resolves x/y for images that don't have explicit coordinates.
 * Manually-placed images are validated and clamped away from eye zones.
 * Auto-positioned images are distributed in the data zone avoiding eye areas.
 */
function resolveImagePositions(
  images: import("./types").QrImage[],
  matrixSize: number,
): import("./types").QrImage[] {
  const manualRaw = images.filter((img) => img.x != null && img.y != null);
  const auto = images.filter((img) => img.x == null || img.y == null);

  // Protect manually-placed images from overlapping eye zones
  const manual = manualRaw.map((img) => {
    const globalIdx = images.indexOf(img);
    return overlapsEye(img.x!, img.y!, img.width, img.height, matrixSize)
      ? clampImageFromEyes(img, globalIdx, matrixSize)
      : img;
  });

  if (auto.length === 0) return [...manual];

  // Data zone bounds (inside the eye-free area)
  const dataStart = 8; // leave 1 module gap after eye zone (7+1)
  const dataEnd = matrixSize - 8;
  const dataSize = dataEnd - dataStart; // usable width/height

  // Center of the full matrix
  const cx = matrixSize / 2;
  const cy = matrixSize / 2;

  // Candidate positions (in matrix coords, no padding)
  // We'll pick the best N positions for N auto images
  const candidates: { x: number; y: number }[] = [
    // 1. Center
    { x: cx, y: cy },
    // 2. Left-center, Right-center
    { x: dataStart + dataSize * 0.25, y: cy },
    { x: dataStart + dataSize * 0.75, y: cy },
    // 3. Top-center
    { x: cx, y: dataStart + dataSize * 0.25 },
    // 4. Bottom-center
    { x: cx, y: dataStart + dataSize * 0.75 },
    // 5. Bottom-right corner of data zone
    { x: dataStart + dataSize * 0.75, y: dataStart + dataSize * 0.75 },
    // 6. Top-right of data zone (safe — no eye there)
    { x: dataStart + dataSize * 0.75, y: dataStart + dataSize * 0.25 },
    // 7. Bottom-left of data zone
    { x: dataStart + dataSize * 0.25, y: dataStart + dataSize * 0.75 },
    // 8. Top-left of data zone (safe — no eye there for inner data)
    { x: dataStart + dataSize * 0.25, y: dataStart + dataSize * 0.25 },
  ];

  const resolved: import("./types").QrImage[] = [];
  let candidateIdx = 0;

  for (const img of auto) {
    // Find the next candidate that doesn't overlap an eye zone
    let placed = false;
    while (candidateIdx < candidates.length) {
      const c = candidates[candidateIdx++];
      const imgX = c.x - img.width / 2;
      const imgY = c.y - img.height / 2;
      if (!overlapsEye(imgX, imgY, img.width, img.height, matrixSize)) {
        resolved.push({ ...img, x: imgX, y: imgY });
        placed = true;
        break;
      }
    }
    // Fallback: center if no candidate worked
    if (!placed) {
      resolved.push({
        ...img,
        x: (matrixSize - img.width) / 2,
        y: (matrixSize - img.height) / 2,
      });
    }
  }

  return [...manual, ...resolved];
}

// --- Main Function ---

export interface QRGenerateResult {
  svg: string;
  matrixSize: number;
  eyeZones: QREyeZone[];
  getMaxPos: (
    imageWidth: number,
    imageHeight: number,
  ) => { maxX: number; maxY: number };
}

export async function generateSVG(
  config: NewQRConfig,
): Promise<QRGenerateResult> {
  const analyzer = new QRAnalyzer(
    config.data,
    config.qrOptions?.errorCorrectionLevel || "H",
  );
  const matrix = analyzer.getMatrix();
  const matrixSize = matrix.length;
  const padding = config.padding ?? 4;

  // Pre-build bounds (returned alongside svg)
  const _eyeZones: QREyeZone[] = getEyeZones(matrixSize).map((e) => ({
    ...e,
    width: 7,
    height: 7,
  }));
  const _getMaxPos = (iw: number, ih: number) => ({
    maxX: Math.max(0, matrixSize - iw),
    maxY: Math.max(0, matrixSize - ih),
  });
  const makeBounds = (svg: string): QRGenerateResult => ({
    svg,
    matrixSize,
    eyeZones: _eyeZones,
    getMaxPos: _getMaxPos,
  });

  const fullSize = matrixSize + padding * 2;
  const w = config.width ?? 1000;
  const h = config.height ?? 1000;

  const eyes = getEyePositions(matrixSize, padding);
  const eyeFrameSize = 7; // Зовнішня рамка
  const eyeDotSize = 3; // Внутрішній центр (серце)

  // --- 1. SETUP DEFS ---
  let defsString = "";

  // A. Background Gradient (FIXED)
  if (config.background?.gradient) {
    defsString += generateGradientDef(
      "grad-bg",
      config.background.gradient,
      0,
      0,
      fullSize,
      fullSize,
    );
  }

  // B. Global Dots Gradient
  if (config.dotsOptions.gradient) {
    defsString += generateGradientDef(
      "grad-dots",
      config.dotsOptions.gradient,
      0,
      0,
      fullSize,
      fullSize,
    );
  }

  // C. Independent Eye Gradients (FIXED LOGIC)
  eyes.forEach((eye) => {
    // 1. Градієнт для рамки (Corner Square) - розмір 7x7
    if (config.cornersSquareOptions.gradient) {
      defsString += generateGradientDef(
        `grad-sq-${eye.id}`,
        config.cornersSquareOptions.gradient,
        eye.x,
        eye.y,
        eyeFrameSize,
        eyeFrameSize,
      );
    }

    // 2. Градієнт для центру (Corner Dot) - розмір 3x3 (FIXED)
    // Важливо: ми додаємо зсув +2, щоб градієнт був стиснутий саме навколо серця
    if (config.cornersDotOptions.gradient) {
      defsString += generateGradientDef(
        `grad-dot-${eye.id}`,
        config.cornersDotOptions.gradient,
        eye.x + 2,
        eye.y + 2,
        eyeDotSize,
        eyeDotSize,
      );
    }
  });

  defsString += createSymbol("icon-dots", config.dotsOptions);
  defsString += createSymbol("icon-sq", config.cornersSquareOptions);
  defsString += createSymbol("icon-dot", config.cornersDotOptions);

  // --- 2. DRAW LOOP ---
  let paths = { dots: "", cornerSquare: "", cornerDot: "" };
  let uses = { dots: "", cornerSquare: "", cornerDot: "" };
  const skipMatrix = Array(matrixSize)
    .fill(false)
    .map(() => Array(matrixSize).fill(false));
  // Resolve auto-positions for images without explicit x/y
  const images = resolveImagePositions(config.images || [], matrixSize);

  for (let y = 0; y < matrixSize; y++) {
    for (let x = 0; x < matrixSize; x++) {
      if (skipMatrix[y][x]) continue;
      if (!matrix[y][x].isDark) continue;

      const isBlocked = images.some((img) => {
        if (!img.excludeDots) return false;
        // x/y are always resolved at this point
        const imgX = img.x!;
        const imgY = img.y!;
        return (
          x >= imgX - 0.5 &&
          x <= imgX + img.width - 0.5 &&
          y >= imgY - 0.5 &&
          y <= imgY + img.height - 0.5
        );
      });
      if (isBlocked) continue;

      const zone = getModuleZone(x, y, matrixSize);
      let partConfig: QrPart;
      let symbolId = "";

      if (zone === "dots") {
        partConfig = config.dotsOptions;
        symbolId = "#icon-dots";
      } else if (zone === "cornerSquare") {
        partConfig = config.cornersSquareOptions;
        symbolId = "#icon-sq";
      } else {
        partConfig = config.cornersDotOptions;
        symbolId = "#icon-dot";
      }

      // Single Icon Logic
      let drawSize = 1;
      let drawX = x + padding;
      let drawY = y + padding;

      if (zone === "cornerDot" && partConfig.isSingle) {
        if (!isInnerEyeStart(x, y, matrixSize)) continue;
        drawSize = 3;
        for (let dy = 0; dy < 3; dy++) {
          for (let dx = 0; dx < 3; dx++) {
            if (y + dy < matrixSize && x + dx < matrixSize)
              skipMatrix[y + dy][x + dx] = true;
          }
        }
      }

      const scale = partConfig.scale ?? 1;

      if (partConfig.shape === "custom-icon") {
        const w = drawSize * scale;
        const h = drawSize * scale;
        const offX = (drawSize - w) / 2;
        const offY = (drawSize - h) / 2;
        uses[zone] +=
          `<use href="${symbolId}" x="${drawX + offX}" y="${drawY + offY}" width="${w}" height="${h}" />`;
      } else {
        // @ts-ignore
        const drawFn = shapes[partConfig.shape] || shapes["square"];
        if (drawSize === 3)
          paths[zone] += drawFn(drawX + 1, drawY + 1, scale * 3) + " ";
        else paths[zone] += drawFn(drawX, drawY, scale) + " ";
      }
    }
  }

  // --- 3. FINAL ASSEMBLY ---

  // Dots Layer (Global Gradient)
  const generateDotsLayer = () => {
    if (!paths.dots && !uses.dots) return "";
    const fill = config.dotsOptions.gradient
      ? "url(#grad-dots)"
      : config.dotsOptions.color;
    return `
        <mask id="mask-dots">
            <rect width="100%" height="100%" fill="black" />
            <path d="${paths.dots}" fill="white" />
            <g fill="white">${uses.dots}</g>
        </mask>
        <rect width="100%" height="100%" fill="${fill}" mask="url(#mask-dots)" />
      `;
  };

  // Eyes Layer (Independent Gradients)
  const generateEyeLayer = (
    key: "cornerSquare" | "cornerDot",
    gradPrefix: string,
    partConfig: QrPart,
  ) => {
    if (!paths[key] && !uses[key]) return "";

    const maskId = `mask-${key}`;
    const maskDef = `
        <mask id="${maskId}">
            <rect width="100%" height="100%" fill="black" />
            <path d="${paths[key]}" fill="white" />
            <g fill="white">${uses[key]}</g>
        </mask>
      `;

    let rects = "";
    eyes.forEach((eye) => {
      let fill = partConfig.color;
      if (partConfig.gradient) {
        fill = `url(#${gradPrefix}-${eye.id})`;
      }
      // Тут ми малюємо прямокутник 7x7 для всього ока.
      // Це нормально, навіть для InnerDot, тому що userSpaceOnUse градієнт
      // вже стиснутий до 3x3 всередині цього простору.
      rects += `<rect x="${eye.x}" y="${eye.y}" width="${eyeFrameSize}" height="${eyeFrameSize}" fill="${fill}" mask="url(#${maskId})" />`;
    });
    return `<defs>${maskDef}</defs>${rects}`;
  };

  // Background Fill Logic (Color OR Gradient)
  const getBackgroundFill = () => {
    if (config.background?.gradient) return "url(#grad-bg)";
    return config.background?.color || "white"; // default white
  };

  // Images SVG (x/y are always resolved by resolveImagePositions)
  let imagesSvg = "";
  images.forEach((img) => {
    const imgX = img.x! + padding;
    const imgY = img.y! + padding;
    const par = img.preserveAspectRatio ?? "xMidYMid meet";
    const opacityAttr = img.opacity != null ? ` opacity="${img.opacity}"` : "";
    imagesSvg += `<image href="${img.source}" x="${imgX}" y="${imgY}" width="${img.width}" height="${img.height}" preserveAspectRatio="${par}"${opacityAttr} />`;
  });

  // Convert borderRadius from output pixels to SVG viewBox units (QR space)
  const borderRadius = config.borderRadius
    ? (config.borderRadius / w) * fullSize
    : 0;
  const rxAttr = borderRadius > 0 ? `rx="${borderRadius.toFixed(3)}"` : "";
  const clipPathDef =
    borderRadius > 0
      ? `<clipPath id="qr-clip"><rect width="${fullSize}" height="${fullSize}" ${rxAttr} /></clipPath>`
      : "";
  const clipAttr = borderRadius > 0 ? `clip-path="url(#qr-clip)"` : "";

  // The inner QR SVG content (background + dots + eyes + logos)
  const qrContent = `
    <defs>${defsString}${clipPathDef}</defs>
    <g ${clipAttr}>
      <rect width="100%" height="100%" fill="${getBackgroundFill()}" ${rxAttr}/>
      ${config.background?.image ? `<image href="${config.background.image}" width="100%" height="100%" preserveAspectRatio="none" />` : ""}
      ${generateDotsLayer()}
      ${generateEyeLayer("cornerSquare", "grad-sq", config.cornersSquareOptions)}
      ${generateEyeLayer("cornerDot", "grad-dot", config.cornersDotOptions)}
      ${imagesSvg}
    </g>`;

  // --- Frame composition ---
  const frame = config.frame;

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

    // Scale factor: map QR fullSize units → inset pixel area
    const scaleX = inset.width / fullSize;
    const scaleY = inset.height / fullSize;

    return makeBounds(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${frame.width} ${frame.height}" width="${svgW}" height="${svgH}">
      <!-- Frame image (behind everything) -->
      <image href="${frame.source}" x="0" y="0" width="${frame.width}" height="${frame.height}" preserveAspectRatio="xMidYMid slice" />
      <!-- QR code scaled into the inset area -->
      <g transform="translate(${inset.x}, ${inset.y}) scale(${scaleX.toFixed(6)}, ${scaleY.toFixed(6)})">
        ${qrContent}
      </g>
    </svg>`);
  }

  // --- No frame: standard output ---
  return makeBounds(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fullSize} ${fullSize}" width="${w}" height="${h}">
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

  return {
    matrixSize,
    eyeZones,
    getMaxPos: (imageWidth: number, imageHeight: number) => ({
      maxX: Math.max(0, matrixSize - imageWidth),
      maxY: Math.max(0, matrixSize - imageHeight),
    }),
  };
}
