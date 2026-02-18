import { QRAnalyzer } from "./core/analyzer";
import { shapes } from "./renderer/shapes";
import { NewQRConfig, QrPart, QrImage, Gradient } from "./types";

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

// --- Main Function ---

export function generateSVG(config: NewQRConfig): string {
  const analyzer = new QRAnalyzer(
    config.data,
    config.qrOptions?.errorCorrectionLevel || "H",
  );
  const matrix = analyzer.getMatrix();
  const matrixSize = matrix.length;
  const padding = config.padding ?? 4;

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
  const images = config.images || [];

  for (let y = 0; y < matrixSize; y++) {
    for (let x = 0; x < matrixSize; x++) {
      if (skipMatrix[y][x]) continue;
      if (!matrix[y][x].isDark) continue;

      const isBlocked = images.some((img) => {
        if (!img.excludeDots) return false;
        const imgX = img.x ?? (matrixSize - img.width) / 2;
        const imgY = img.y ?? (matrixSize - img.height) / 2;
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

  // Images SVG
  let imagesSvg = "";
  images.forEach((img) => {
    const imgX = (img.x ?? (matrixSize - img.width) / 2) + padding;
    const imgY = (img.y ?? (matrixSize - img.height) / 2) + padding;
    imagesSvg += `<image href="${img.source}" x="${imgX}" y="${imgY}" width="${img.width}" height="${img.height}" preserveAspectRatio="xMidYMid slice" />`;
  });

  // Convert borderRadius from output pixels to SVG viewBox units
  const borderRadius = config.borderRadius
    ? (config.borderRadius / w) * fullSize
    : 0;
  const rxAttr = borderRadius > 0 ? `rx="${borderRadius.toFixed(3)}"` : "";
  const clipPathDef =
    borderRadius > 0
      ? `<clipPath id="qr-clip"><rect width="${fullSize}" height="${fullSize}" ${rxAttr} /></clipPath>`
      : "";
  const clipAttr = borderRadius > 0 ? `clip-path="url(#qr-clip)"` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fullSize} ${fullSize}" width="${w}" height="${h}">
    <defs>${defsString}${clipPathDef}</defs>
    
    <g ${clipAttr}>
      <rect width="100%" height="100%" fill="${getBackgroundFill()}" ${rxAttr}/>
      
      ${config.background?.image ? `<image href="${config.background.image}" width="100%" height="100%" preserveAspectRatio="none" />` : ""}
      
      ${generateDotsLayer()}
      ${generateEyeLayer("cornerSquare", "grad-sq", config.cornersSquareOptions)}
      ${generateEyeLayer("cornerDot", "grad-dot", config.cornersDotOptions)}
      
      ${imagesSvg}
    </g>
  </svg>`;
}
