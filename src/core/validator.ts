import { QRMatrix, QRValidateResult } from "../types";

const ECL_CAPACITY: Record<string, number> = {
  L: 0.07,
  M: 0.15,
  Q: 0.25,
  H: 0.30,
};

const FINDER_SIZE = 7;
const MIN_CONTRAST_RATIO = 3.0;
// Inner sampling inset: 20% on each side → use middle 60% of module to avoid
// anti-aliasing and shape-dependent pixel bleeding at edges
const SAMPLE_PAD = 0.2;
// Finder patterns with custom shapes (extra-rounded, classy, etc.) always have
// some corner modules that render as background. Allow up to 10% degradation
// before treating finder patterns as broken (12/147 ≈ 8.2% for typical
// extra-rounded outer-eye with 4 empty corners per pattern × 3 patterns).
const FINDER_DEGRADED_THRESHOLD = 0.10;

function srgbToLinear(c: number): number {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}

function rgbaLuminance(r: number, g: number, b: number, a: number): number {
  const af = a / 255;
  // Composite over white background for transparent pixels
  const rr = r * af + 255 * (1 - af);
  const gg = g * af + 255 * (1 - af);
  const bb = b * af + 255 * (1 - af);
  return (
    0.2126 * srgbToLinear(rr) +
    0.7152 * srgbToLinear(gg) +
    0.0722 * srgbToLinear(bb)
  );
}

function sampleRegion(
  data: Uint8ClampedArray,
  cw: number,
  ch: number,
  x: number,
  y: number,
  mw: number,
  mh: number,
): number {
  const x0 = Math.max(0, Math.ceil(x + mw * SAMPLE_PAD));
  const y0 = Math.max(0, Math.ceil(y + mh * SAMPLE_PAD));
  const x1 = Math.min(cw, Math.floor(x + mw * (1 - SAMPLE_PAD)));
  const y1 = Math.min(ch, Math.floor(y + mh * (1 - SAMPLE_PAD)));

  if (x1 <= x0 || y1 <= y0) {
    // Fallback: single center pixel when module is sub-pixel sized
    const cx = Math.min(cw - 1, Math.round(x + mw / 2));
    const cy = Math.min(ch - 1, Math.round(y + mh / 2));
    const idx = (cy * cw + cx) * 4;
    return rgbaLuminance(data[idx], data[idx + 1], data[idx + 2], data[idx + 3]);
  }

  let sum = 0;
  let count = 0;
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const idx = (py * cw + px) * 4;
      sum += rgbaLuminance(data[idx], data[idx + 1], data[idx + 2], data[idx + 3]);
      count++;
    }
  }
  return count > 0 ? sum / count : 0.5;
}

function isFinderModule(x: number, y: number, size: number): boolean {
  return (
    (x < FINDER_SIZE && y < FINDER_SIZE) ||
    (x >= size - FINDER_SIZE && y < FINDER_SIZE) ||
    (x < FINDER_SIZE && y >= size - FINDER_SIZE)
  );
}

function isTimingModule(x: number, y: number, size: number): boolean {
  const inner0 = FINDER_SIZE + 1;
  const inner1 = size - FINDER_SIZE - 2;
  return (
    (y === 6 && x >= inner0 && x <= inner1) ||
    (x === 6 && y >= inner0 && y <= inner1)
  );
}

export function validateQRCanvas(
  canvas: HTMLCanvasElement,
  matrix: QRMatrix,
  effectiveMargin: number,
  ecl: string,
): QRValidateResult {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      valid: false,
      contrastRatio: 1,
      degradedModules: 0,
      totalModules: 0,
      finderPatternsOk: false,
      timingPatternsOk: false,
      eccHeadroom: 0,
      issues: ["Could not get 2D context from canvas"],
    };
  }

  const matrixSize = matrix.length;
  const cw = canvas.width;
  const ch = canvas.height;
  const fullSize = matrixSize + effectiveMargin * 2;
  const scaleX = cw / fullSize;
  const scaleY = ch / fullSize;

  const { data } = ctx.getImageData(0, 0, cw, ch);

  // --- Pass 1: sample luminance for every module ---
  const luminances: number[][] = [];
  for (let y = 0; y < matrixSize; y++) {
    luminances[y] = [];
    for (let x = 0; x < matrixSize; x++) {
      const px = (effectiveMargin + x) * scaleX;
      const py = (effectiveMargin + y) * scaleY;
      luminances[y][x] = sampleRegion(data, cw, ch, px, py, scaleX, scaleY);
    }
  }

  // --- Pass 2: compute mean luminance per expected group (dark vs light) ---
  let sumDark = 0, countDark = 0;
  let sumLight = 0, countLight = 0;
  for (let y = 0; y < matrixSize; y++) {
    for (let x = 0; x < matrixSize; x++) {
      const lum = luminances[y][x];
      if (matrix[y][x].isDark) { sumDark += lum; countDark++; }
      else { sumLight += lum; countLight++; }
    }
  }
  const meanDark = countDark > 0 ? sumDark / countDark : 0;
  const meanLight = countLight > 0 ? sumLight / countLight : 1;

  // WCAG relative contrast ratio
  const L1 = Math.max(meanDark, meanLight);
  const L2 = Math.min(meanDark, meanLight);
  const contrastRatio = (L1 + 0.05) / (L2 + 0.05);

  // Adaptive threshold: midpoint between the two cluster means
  const threshold = (meanDark + meanLight) / 2;

  // Support inverted QR (light dots on dark background)
  const inverted = meanDark > meanLight;

  // Deadband around the threshold — modules with luminance in this zone are
  // "uncertain" and not counted as degraded. Prevents false positives from
  // custom shapes (rounded corners, classy dots, etc.) that only partially
  // fill their module's bounding box, pushing their average luminance toward
  // the midpoint even though the module is correctly rendered.
  const deadband = Math.abs(meanLight - meanDark) * 0.2;

  // --- Pass 3: classify degraded modules per structural zone ---
  let degradedFinder = 0, totalFinderModules = 0;
  let degradedTiming = 0, totalTimingModules = 0;
  let degradedData = 0, totalDataModules = 0;

  for (let y = 0; y < matrixSize; y++) {
    for (let x = 0; x < matrixSize; x++) {
      const { isDark } = matrix[y][x];
      const lum = luminances[y][x];
      // A module is only "apparently light/dark" when it's confidently past the
      // threshold; anything within the deadband is treated as correct.
      const confidentlyLight = inverted ? lum < threshold - deadband : lum > threshold + deadband;
      const confidentlyDark  = inverted ? lum > threshold + deadband : lum < threshold - deadband;
      const degraded = isDark ? confidentlyLight : confidentlyDark;

      if (isFinderModule(x, y, matrixSize)) {
        totalFinderModules++;
        if (degraded) degradedFinder++;
      } else if (isTimingModule(x, y, matrixSize)) {
        totalTimingModules++;
        if (degraded) degradedTiming++;
      } else {
        totalDataModules++;
        if (degraded) degradedData++;
      }
    }
  }

  const finderDegradedPct = totalFinderModules > 0 ? degradedFinder / totalFinderModules : 0;
  const finderPatternsOk = finderDegradedPct < FINDER_DEGRADED_THRESHOLD;
  const timingPatternsOk = degradedTiming === 0;

  const capacity = ECL_CAPACITY[ecl] ?? 0.30;
  const eccToleranceModules = Math.max(1, Math.floor(capacity * totalDataModules));
  const eccHeadroom = Math.max(0, 1 - degradedData / eccToleranceModules);

  const totalModules = totalFinderModules + totalTimingModules + totalDataModules;
  const degradedModules = degradedFinder + degradedTiming + degradedData;

  const issues: string[] = [];
  if (contrastRatio < MIN_CONTRAST_RATIO) {
    issues.push(
      `Low contrast: ${contrastRatio.toFixed(1)}:1 (minimum ${MIN_CONTRAST_RATIO.toFixed(1)}:1 required)`,
    );
  }
  if (!finderPatternsOk) {
    issues.push(
      `Finder patterns degraded: ${degradedFinder}/${totalFinderModules} modules corrupted`,
    );
  }
  if (!timingPatternsOk) {
    issues.push(
      `Timing patterns degraded: ${degradedTiming}/${totalTimingModules} modules corrupted`,
    );
  }
  if (degradedData > eccToleranceModules) {
    issues.push(
      `Too many degraded data modules: ${degradedData}/${totalDataModules} ` +
        `(ECC-${ecl} tolerates up to ${eccToleranceModules})`,
    );
  }

  const valid =
    contrastRatio >= MIN_CONTRAST_RATIO &&
    finderPatternsOk &&
    timingPatternsOk &&
    degradedData <= eccToleranceModules;

  return {
    valid,
    contrastRatio,
    degradedModules,
    totalModules,
    finderPatternsOk,
    timingPatternsOk,
    eccHeadroom,
    issues,
  };
}
