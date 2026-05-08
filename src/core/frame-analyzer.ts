import { Options } from "../types";

export type FrameAnalysis = {
  /** Dominant frame border colors, most prominent first (up to 5 hex strings) */
  palette: string[];
  /** Whether the frame border is predominantly dark */
  isDark: boolean;
  /** Detected inner cutout color — used as the QR background */
  cutoutColor: string;
  /**
   * Detected bounding box of the QR cutout area, in source-image pixels.
   * Use `insetFraction` when the output frame dimensions differ from the source image.
   */
  inset: { x: number; y: number; width: number; height: number };
  /**
   * Same bounding box as `inset`, but normalized to [0–1] relative to source dimensions.
   * To get output pixel coordinates: multiply x/width by `frame.width`, y/height by `frame.height`.
   *
   * @example
   * const { insetFraction } = await analyzeFrame(source);
   * const frameWidth = 1000, frameHeight = 800;
   * frame: {
   *   source,
   *   width: frameWidth, height: frameHeight,
   *   inset: {
   *     x: Math.round(insetFraction.x * frameWidth),
   *     y: Math.round(insetFraction.y * frameHeight),
   *     width:  Math.round(insetFraction.width  * frameWidth),
   *     height: Math.round(insetFraction.height * frameHeight),
   *   }
   * }
   */
  insetFraction: { x: number; y: number; width: number; height: number };
  /** Natural pixel dimensions of the source frame image */
  sourceWidth: number;
  sourceHeight: number;
  /** Ready-to-use QR options whose colors complement the frame */
  options: Partial<Options>;
};

// ─── Color math ───────────────────────────────────────────────────────────────

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const r1 = r / 255, g1 = g / 255, b1 = b / 255;
  const max = Math.max(r1, g1, b1), min = Math.min(r1, g1, b1);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r1) h = ((g1 - b1) / d + (g1 < b1 ? 6 : 0)) / 6;
  else if (max === g1) h = ((b1 - r1) / d + 2) / 6;
  else h = ((r1 - g1) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  const sl = s / 100, ll = l / 100;
  const a = sl * Math.min(ll, 1 - ll);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  if (!hex.startsWith("#") || hex.length < 7) return [0, 0, 0];
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function srgbToLinear(c: number): number {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function wcag(la: number, lb: number): number {
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ─── Canvas loading ───────────────────────────────────────────────────────────

export type FrameSource = HTMLImageElement | HTMLCanvasElement | File | Blob | string;

async function sourceToImage(source: FrameSource): Promise<HTMLImageElement> {
  if (source instanceof HTMLImageElement) return source;

  let url: string;
  let needsRevoke = false;

  if (source instanceof File || source instanceof Blob) {
    url = URL.createObjectURL(source);
    needsRevoke = true;
  } else {
    url = source as string;
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (needsRevoke) URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      if (needsRevoke) URL.revokeObjectURL(url);
      reject(new Error("analyzeFrame: failed to load image"));
    };
    img.src = url;
  });
}

async function toCanvas(source: FrameSource, maxSize?: number): Promise<HTMLCanvasElement> {
  if (source instanceof HTMLCanvasElement) {
    if (!maxSize || (source.width <= maxSize && source.height <= maxSize)) return source;
  }

  const img = source instanceof HTMLCanvasElement
    ? await (async () => {
        const url = source.toDataURL();
        return sourceToImage(url);
      })()
    : await sourceToImage(source);

  let w = img.naturalWidth  || img.width;
  let h = img.naturalHeight || img.height;

  if (maxSize && Math.max(w, h) > maxSize) {
    const scale = maxSize / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return canvas;
}

// ─── Sampling helpers ─────────────────────────────────────────────────────────

// Pixel step: aim for ~150 samples per axis regardless of image resolution
function stepFor(size: number) {
  return Math.max(1, Math.floor(size / 150));
}

function isInBorder(
  px: number, py: number,
  w: number, h: number,
  fraction: number,
): boolean {
  const bx = w * fraction, by = h * fraction;
  return px < bx || px >= w - bx || py < by || py >= h - by;
}

function isInCenter(
  px: number, py: number,
  w: number, h: number,
  fraction: number,
): boolean {
  const cx0 = w * (0.5 - fraction / 2), cx1 = w * (0.5 + fraction / 2);
  const cy0 = h * (0.5 - fraction / 2), cy1 = h * (0.5 + fraction / 2);
  return px >= cx0 && px < cx1 && py >= cy0 && py < cy1;
}

// ─── Color extraction ─────────────────────────────────────────────────────────

// 24 hue buckets × 15° — covers the full wheel
const HUE_BUCKETS = 24;

function extractBorderPalette(
  data: Uint8ClampedArray,
  w: number, h: number,
  borderFraction: number,
): string[] {
  const step = stepFor(Math.min(w, h));

  // Each bucket accumulates weighted sums; weight = saturation (more vivid = more representative)
  const buckets = Array.from({ length: HUE_BUCKETS }, () => ({
    sumH: 0, sumS: 0, sumL: 0, weight: 0,
  }));

  for (let py = 0; py < h; py += step) {
    for (let px = 0; px < w; px += step) {
      if (!isInBorder(px, py, w, h, borderFraction)) continue;
      const i = (py * w + px) * 4;
      if (data[i + 3] < 64) continue; // transparent pixel

      const [hue, sat, lit] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
      if (sat < 8) continue; // skip near-grey pixels

      const bi = Math.floor(hue / (360 / HUE_BUCKETS)) % HUE_BUCKETS;
      const wt = sat / 100;
      buckets[bi].sumH += hue * wt;
      buckets[bi].sumS += sat * wt;
      buckets[bi].sumL += lit * wt;
      buckets[bi].weight += wt;
    }
  }

  return buckets
    .filter(b => b.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map(b => hslToHex(
      b.sumH / b.weight,
      Math.min(100, (b.sumS / b.weight) * 1.1), // slight saturation boost for vividness
      b.sumL / b.weight,
    ));
}

function detectBorderDarkness(
  data: Uint8ClampedArray,
  w: number, h: number,
  borderFraction: number,
): boolean {
  const step = stepFor(Math.min(w, h));
  let sumL = 0, count = 0;
  for (let py = 0; py < h; py += step) {
    for (let px = 0; px < w; px += step) {
      if (!isInBorder(px, py, w, h, borderFraction)) continue;
      const i = (py * w + px) * 4;
      if (data[i + 3] < 64) continue;
      sumL += rgbToHsl(data[i], data[i + 1], data[i + 2])[2];
      count++;
    }
  }
  return count > 0 && sumL / count < 50;
}

function detectCutoutColor(
  data: Uint8ClampedArray,
  w: number, h: number,
  centerFraction: number,
): string {
  const step = stepFor(Math.min(w, h));
  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  for (let py = 0; py < h; py += step) {
    for (let px = 0; px < w; px += step) {
      if (!isInCenter(px, py, w, h, centerFraction)) continue;
      const i = (py * w + px) * 4;
      if (data[i + 3] < 128) {
        sumR += 255; sumG += 255; sumB += 255; // transparent → treat as white
      } else {
        sumR += data[i]; sumG += data[i + 1]; sumB += data[i + 2];
      }
      count++;
    }
  }
  if (!count) return "#ffffff";
  const round = (v: number) => Math.round(v / count).toString(16).padStart(2, "0");
  return `#${round(sumR)}${round(sumG)}${round(sumB)}`;
}

/**
 * Detects the bounding box of the QR cutout area by classifying each row/column
 * as "cutout-like" or "frame-like" based on luminance distance to the two zones,
 * then expands outward from the image center to find the contiguous cutout block.
 */
function detectCutoutBounds(
  data: Uint8ClampedArray,
  w: number, h: number,
  borderFraction: number,
  centerFraction: number,
): { x: number; y: number; width: number; height: number } {
  const step = Math.max(1, Math.floor(Math.min(w, h) / 200));

  // Measure mean luminance of center (cutout) and border (frame) zones.
  // Skip transparent pixels — they're outside the frame content, not the cutout.
  let sumC = 0, cntC = 0, sumB = 0, cntB = 0;
  for (let py = 0; py < h; py += step) {
    for (let px = 0; px < w; px += step) {
      const i = (py * w + px) * 4;
      if (data[i + 3] < 128) continue; // skip transparent
      const lum = luminance(data[i], data[i + 1], data[i + 2]);
      if (isInCenter(px, py, w, h, centerFraction)) {
        sumC += lum; cntC++;
      } else if (isInBorder(px, py, w, h, borderFraction * 0.5)) {
        sumB += lum; cntB++;
      }
    }
  }
  const cutoutLum = cntC > 0 ? sumC / cntC : 0.9;
  const frameLum  = cntB > 0 ? sumB / cntB  : 0.1;

  // Fallback: insufficient contrast between zones — return centered 50% region
  if (Math.abs(cutoutLum - frameLum) < 0.08) {
    return {
      x: Math.round(w * 0.25), y: Math.round(h * 0.25),
      width: Math.round(w * 0.5), height: Math.round(h * 0.5),
    };
  }

  // Score each pixel: 1 = closer to cutout luminance, 0 = closer to frame luminance
  const isCutout = (lum: number) =>
    Math.abs(lum - cutoutLum) <= Math.abs(lum - frameLum);

  // Per-row score: fraction of OPAQUE pixels that are cutout-like.
  // Transparent pixels are skipped — an all-transparent row (outer background) scores 0.
  const rowScore = new Float32Array(h);
  for (let py = 0; py < h; py++) {
    let sum = 0, cnt = 0;
    for (let px = 0; px < w; px += step) {
      const i = (py * w + px) * 4;
      if (data[i + 3] < 128) continue;
      const lum = luminance(data[i], data[i + 1], data[i + 2]);
      sum += isCutout(lum) ? 1 : 0;
      cnt++;
    }
    rowScore[py] = cnt > 0 ? sum / cnt : 0;
  }

  // Per-column score
  const colScore = new Float32Array(w);
  for (let px = 0; px < w; px++) {
    let sum = 0, cnt = 0;
    for (let py = 0; py < h; py += step) {
      const i = (py * w + px) * 4;
      if (data[i + 3] < 128) continue;
      const lum = luminance(data[i], data[i + 1], data[i + 2]);
      sum += isCutout(lum) ? 1 : 0;
      cnt++;
    }
    colScore[px] = cnt > 0 ? sum / cnt : 0;
  }

  // Expand from image center outward along contiguous high-scoring rows/cols
  const scoreThr = 0.5;
  const midY = Math.floor(h / 2);
  const midX = Math.floor(w / 2);

  let top = midY, bottom = midY;
  if (rowScore[midY] >= scoreThr) {
    while (top > 0 && rowScore[top - 1] >= scoreThr) top--;
    while (bottom < h - 1 && rowScore[bottom + 1] >= scoreThr) bottom++;
  }

  let left = midX, right = midX;
  if (colScore[midX] >= scoreThr) {
    while (left > 0 && colScore[left - 1] >= scoreThr) left--;
    while (right < w - 1 && colScore[right + 1] >= scoreThr) right++;
  }

  // Clamp to image bounds and ensure non-zero size
  const x      = Math.max(0, left);
  const y      = Math.max(0, top);
  const width  = Math.max(1, Math.min(w, right + 1) - x);
  const height = Math.max(1, Math.min(h, bottom + 1) - y);

  return { x, y, width, height };
}

// ─── Contrast adjustment ──────────────────────────────────────────────────────

function adjustContrast(hex: string, bgHex: string, minRatio: number): string {
  const [r, g, b] = hexToRgb(hex);
  const bgLum = luminance(...hexToRgb(bgHex));
  if (wcag(luminance(r, g, b), bgLum) >= minRatio) return hex;

  const [h, s, l] = rgbToHsl(r, g, b);
  // Darken if the dot is already darker than background, lighten otherwise
  const makeDarker = luminance(r, g, b) < bgLum;
  let lo = makeDarker ? 0 : l;
  let hi = makeDarker ? l : 100;

  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const midLum = luminance(...hexToRgb(hslToHex(h, s, mid)));
    const ok = wcag(midLum, bgLum) >= minRatio;
    if (makeDarker) { if (ok) lo = mid; else hi = mid; }
    else             { if (ok) hi = mid; else lo = mid; }
  }
  return hslToHex(h, s, makeDarker ? lo : hi);
}

// ─── Options builder ──────────────────────────────────────────────────────────

function buildQROptions(
  palette: string[],
  cutoutColor: string,
): Partial<Options> {
  const fallbackDark  = "#1a1a1a";
  const fallbackLight = "#f5f5f5";
  const bgLum = luminance(...hexToRgb(cutoutColor));
  const bgIsDark = bgLum < 0.18;

  const fallback = bgIsDark ? fallbackLight : fallbackDark;
  const primary   = adjustContrast(palette[0] ?? fallback, cutoutColor, 3.0);
  const secondary = adjustContrast(palette[1] ?? primary,  cutoutColor, 3.0);

  return {
    backgroundOptions:    { color: cutoutColor },
    dotsOptions:          { overlays: [{ fill: { type: "color", color: primary } }] },
    cornersSquareOptions: { overlays: [{ fill: { type: "color", color: secondary } }] },
    cornersDotOptions:    { overlays: [{ fill: { type: "color", color: primary } }] },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyses a frame image and returns QR code options whose colors
 * complement the frame's visual palette.
 *
 * Samples the outer border to extract dominant hues; detects the inner
 * cutout color (typically white) to use as the QR background; adjusts
 * all generated colors to guarantee ≥ 3:1 WCAG contrast.
 *
 * Requires a browser environment (Canvas API).
 *
 * @param source         HTMLImageElement, HTMLCanvasElement, or an image URL / data-URL.
 * @param borderFraction Fraction of each edge to sample as the frame border. Default 0.3.
 * @param centerFraction Fraction of the center area to sample as the QR cutout. Default 0.4.
 */
export async function analyzeFrame(
  source: FrameSource,
  borderFraction = 0.3,
  centerFraction = 0.4,
): Promise<FrameAnalysis> {
  if (typeof document === "undefined") {
    throw new Error("analyzeFrame() requires a browser environment");
  }

  const canvas = await toCanvas(source);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("analyzeFrame(): could not get 2D context");

  const { width: w, height: h } = canvas;
  const { data } = ctx.getImageData(0, 0, w, h);

  const palette     = extractBorderPalette(data, w, h, borderFraction);
  const isDark      = detectBorderDarkness(data, w, h, borderFraction);
  const cutoutColor = detectCutoutColor(data, w, h, centerFraction);
  const options     = buildQROptions(palette, cutoutColor);

  const inset = detectCutoutBounds(data, w, h, borderFraction, centerFraction);
  const insetFraction = {
    x:      inset.x / w,
    y:      inset.y / h,
    width:  inset.width  / w,
    height: inset.height / h,
  };

  return { palette, isDark, cutoutColor, inset, insetFraction, sourceWidth: w, sourceHeight: h, options };
}

// ─── compressFrame ────────────────────────────────────────────────────────────

export type CompressFrameOptions = {
  /** Maximum pixel dimension (width or height). Larger images are scaled down proportionally.
   *  Default 1024. */
  maxSize?: number;
  /** Output image format.
   *  - `"auto"` (default) — WebP when supported, PNG for transparent images, JPEG otherwise.
   *  - `"webp"` — best compression, supports transparency, modern browsers only.
   *  - `"jpeg"` — smallest for opaque photos/frames; no alpha channel.
   *  - `"png"` — lossless, preserves transparency. */
  format?: "auto" | "webp" | "jpeg" | "png";
  /** Compression quality 0–1. Applies to `jpeg` and `webp`. Default 0.85. */
  quality?: number;
};

export type CompressFrameResult = {
  blob: Blob;
  dataURL: string;
  width: number;
  height: number;
  /** Compressed size in bytes */
  size: number;
};

function hasAlpha(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 16) { // sample every 4th pixel
    if (data[i] < 255) return true;
  }
  return false;
}

function supportsFormat(fmt: "webp" | "jpeg" | "png"): boolean {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  return c.toDataURL(`image/${fmt}`).startsWith(`data:image/${fmt}`);
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("compressFrame: toBlob failed"))),
      mime,
      quality,
    );
  });
}

/**
 * Resizes and compresses a frame image for efficient storage and transfer.
 *
 * Automatically picks the best output format (WebP → JPEG/PNG) based on
 * browser support and whether the image has transparency.
 *
 * Requires a browser environment (Canvas API).
 *
 * @param source  Image source — HTMLImageElement, HTMLCanvasElement, File, Blob, or URL.
 * @param options Compression settings (maxSize, format, quality).
 *
 * @example
 * const { blob, dataURL, size } = await compressFrame(file, { maxSize: 800, quality: 0.8 });
 * console.log(`Compressed to ${(size / 1024).toFixed(1)} KB`);
 */
export async function compressFrame(
  source: FrameSource,
  options?: CompressFrameOptions,
): Promise<CompressFrameResult> {
  if (typeof document === "undefined") {
    throw new Error("compressFrame() requires a browser environment");
  }

  const maxSize = options?.maxSize ?? 1024;
  const quality = Math.max(0, Math.min(1, options?.quality ?? 0.85));
  const fmt     = options?.format ?? "auto";

  const canvas = await toCanvas(source, maxSize);
  const ctx    = canvas.getContext("2d")!;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  let mime: string;
  if (fmt === "auto") {
    if (supportsFormat("webp"))        mime = "image/webp";
    else if (hasAlpha(data))           mime = "image/png";
    else                               mime = "image/jpeg";
  } else {
    mime = `image/${fmt}`;
  }

  const blob    = await canvasToBlob(canvas, mime, quality);
  const dataURL = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

  return {
    blob,
    dataURL,
    width:  canvas.width,
    height: canvas.height,
    size:   blob.size,
  };
}
