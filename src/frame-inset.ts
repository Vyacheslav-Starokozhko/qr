/**
 * detectFrameInset
 *
 * Analyses a frame image and returns the bounding box of the rectangular
 * region where the QR code should sit. Supports two frame archetypes:
 *
 *   A) White-hole frames: the QR area is bright white (or transparent), the
 *      frame decoration is a darker or coloured surround. Works by scoring
 *      each row/column by the fraction of "empty" (bright/transparent) pixels
 *      and finding the band with the greatest total score.
 *
 *   B) Gray-interior frames: the QR area is a light-gray zone bounded on all
 *      sides by dark decorative elements, with a similar-coloured outer border
 *      outside the frame. Works by finding the longest light run per row that
 *      does NOT touch the image edges, picking the one closest to the image
 *      centre, and taking the most consistent y-band of such runs.
 *
 * Archetype A is tried first; if its result is too small or badly proportioned,
 * archetype B is attempted as a fallback.
 */

export interface FrameInset {
   x: number;
   y: number;
   width: number;
   height: number;
}

/** Pixels with alpha below this are treated as "empty" */
const ALPHA_THRESHOLD = 128;
/** Archetype A: pixels with luminance above this are "empty" (white-hole frames) */
const LUMA_THRESHOLD = 240;
/** Archetype B: pixels with luminance below this are "dark" (border pixels) */
const INNER_DARK_THRESHOLD = 120;

/** Decode a source string (data URI or file path) to a raw RGBA array */
async function toRawRGBA(source: string): Promise<{
   data: Uint8Array | Uint8ClampedArray;
   width: number;
   height: number;
}> {
   if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      return new Promise((resolve, reject) => {
         const img = new Image();
         img.crossOrigin = 'Anonymous';
         img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Canvas 2D not supported'));
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, img.width, img.height);
            resolve({
               data: imageData.data,
               width: img.width,
               height: img.height,
            });
         };
         img.onerror = reject;
         img.src = source;
      });
   }

   let input: any;
   if (source.startsWith('data:')) {
      const commaIdx = source.indexOf(',');
      const b64 = source.slice(commaIdx + 1);
      input = typeof Buffer !== 'undefined' ? Buffer.from(b64, 'base64') : source;
   } else {
      input = source;
   }

   let sharp: any;
   try {
      const sharpModule = await import('sharp');
      sharp = sharpModule.default || sharpModule;
   } catch {
      throw new Error("The 'sharp' package is required for frame detection in Node.js.");
   }
   const { data, info } = await sharp(input)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

   return { data, width: info.width, height: info.height };
}

/** Returns true if the pixel at byte offset `i` is "empty" (transparent or very bright) */
function isEmptyA(data: Uint8Array | Uint8ClampedArray, i: number): boolean {
   if (data[i + 3] < ALPHA_THRESHOLD) return true;
   const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
   return luma > LUMA_THRESHOLD;
}

/** Returns true if the pixel at byte offset `i` is "light" for archetype B */
function isLightB(data: Uint8Array | Uint8ClampedArray, i: number): boolean {
   if (data[i + 3] < ALPHA_THRESHOLD) return true;
   const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
   return luma > INNER_DARK_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Archetype A-1 — histogram (pure white/transparent rectangular hole)
// ---------------------------------------------------------------------------

/** Largest rectangle in histogram — classic O(n) stack algorithm */
function largestRectInHistogram(heights: number[]): {
   left: number;
   width: number;
   height: number;
} {
   const stack: number[] = [];
   let best = { left: 0, width: 0, height: 0 };
   const n = heights.length;

   for (let i = 0; i <= n; i++) {
      const h = i < n ? heights[i] : 0;
      while (stack.length > 0 && h < heights[stack[stack.length - 1]]) {
         const height = heights[stack.pop()!];
         const left = stack.length > 0 ? stack[stack.length - 1] + 1 : 0;
         const width = i - left;
         if (width * height > best.width * best.height) best = { left, width, height };
      }
      stack.push(i);
   }
   return best;
}

/** Find the largest contiguous rectangle where every pixel is empty (white or transparent). */
function detectHistogram(
   data: Uint8Array | Uint8ClampedArray,
   width: number,
   height: number,
): { x: number; y: number; width: number; height: number; area: number } | null {
   const colHeights = new Array<number>(width).fill(0);
   let best = { x: 0, y: 0, width: 0, height: 0, area: 0 };

   for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
         colHeights[col] = isEmptyA(data, (row * width + col) * 4)
            ? colHeights[col] + 1
            : 0;
      }
      const { left, width: rw, height: rh } = largestRectInHistogram(colHeights);
      const area = rw * rh;
      if (area > best.area)
         best = { x: left, y: row - rh + 1, width: rw, height: rh, area };
   }

   return best.area > 0 ? best : null;
}

// ---------------------------------------------------------------------------
// Archetype A-2 — score-based (white-hole frames with partial occlusion)
// ---------------------------------------------------------------------------

/**
 * Find the contiguous band with the highest total score (sum of scores for all
 * indices in the band) where every element >= threshold.
 */
function findBestBand(
   scores: Float32Array,
   threshold: number,
): { start: number; end: number } {
   let bestStart = 0,
      bestEnd = -1,
      bestTotal = 0;
   let runStart = -1,
      runTotal = 0;

   for (let i = 0; i < scores.length; i++) {
      if (scores[i] >= threshold) {
         if (runStart === -1) {
            runStart = i;
            runTotal = 0;
         }
         runTotal += scores[i];
         if (runTotal > bestTotal) {
            bestTotal = runTotal;
            bestStart = runStart;
            bestEnd = i;
         }
      } else {
         runStart = -1;
      }
   }

   return { start: bestStart, end: bestEnd };
}

function detectScoreBased(
   data: Uint8Array | Uint8ClampedArray,
   width: number,
   height: number,
): { x: number; y: number; width: number; height: number } | null {
   const SCORE_THRESHOLD = 0.1;
   // Minimum opaque pixels in a row/col to consider it (avoids fully-transparent
   // outer border rows giving score = 0/0 = NaN / inflated fraction)
   const MIN_OPAQUE = 10;

   // Row scores: fraction of OPAQUE-white pixels among all opaque pixels.
   // Transparent pixels are skipped so that transparent outer borders don't
   // inflate the score for rows that contain no actual white content.
   const rowScore = new Float32Array(height);
   for (let y = 0; y < height; y++) {
      let white = 0;
      for (let x = 0; x < width; x++) {
         const i = (y * width + x) * 4;
         if (isEmptyA(data, i)) white++;
      }
      rowScore[y] = white / width;
   }

   const { start: y1, end: y2 } = findBestBand(rowScore, SCORE_THRESHOLD);
   if (y2 < y1) return null;

   // Column scores within the row band (same opaque-normalised approach)
   const colScore = new Float32Array(width);
   for (let x = 0; x < width; x++) {
      let white = 0;
      for (let y = y1; y <= y2; y++) {
         const i = (y * width + x) * 4;
         if (isEmptyA(data, i)) white++;
      }
      colScore[x] = white / (y2 - y1 + 1);
   }

   const { start: x1, end: x2 } = findBestBand(colScore, SCORE_THRESHOLD);
   if (x2 < x1) return null;

   return { x: x1, y: y1, width: x2 - x1 + 1, height: y2 - y1 + 1 };
}

// ---------------------------------------------------------------------------
// Archetype B — inner-run (gray interior bounded by dark borders)
// ---------------------------------------------------------------------------

function detectInnerRun(
   data: Uint8Array | Uint8ClampedArray,
   width: number,
   height: number,
): { x: number; y: number; width: number; height: number } | null {
   const cx = width / 2;
   const MIN_RUN_WIDTH = width * 0.15; // run must be ≥ 15% of image width
   const EDGE_MARGIN = 5;

   // For each row, find the centre-most inner run (not touching image edges)
   const rowRuns: Array<{ start: number; end: number } | null> = new Array(height).fill(
      null,
   );

   for (let y = 0; y < height; y++) {
      // Collect all light runs in the row
      const runs: Array<{ start: number; end: number }> = [];
      let start = -1;
      for (let x = 0; x <= width; x++) {
         const light = x < width ? isLightB(data, (y * width + x) * 4) : false;
         if (light) {
            if (start === -1) start = x;
         } else {
            if (start !== -1) {
               runs.push({ start, end: x - 1 });
               start = -1;
            }
         }
      }

      // Keep only inner runs (not touching edges, wide enough)
      const inner = runs.filter(
         r =>
            r.start > EDGE_MARGIN &&
            r.end < width - EDGE_MARGIN &&
            r.end - r.start + 1 >= MIN_RUN_WIDTH,
      );
      if (inner.length === 0) continue;

      // Pick the one whose centre is closest to image centre
      rowRuns[y] = inner.reduce((a, b) => {
         const da = Math.abs((a.start + a.end) / 2 - cx);
         const db = Math.abs((b.start + b.end) / 2 - cx);
         return db < da ? b : a;
      });
   }

   // Find the largest band of rows with valid inner runs, tolerating short gaps
   // (decorative elements inside the QR area may break a few rows' inner runs).
   const MAX_GAP = Math.max(10, Math.floor(height * 0.02)); // ≤ 2% of image height
   let bestY1 = 0,
      bestY2 = -1,
      bestCount = 0;
   let bandY1 = -1,
      bandCount = 0,
      gapLen = 0;

   for (let y = 0; y < height; y++) {
      if (rowRuns[y] !== null) {
         if (bandY1 === -1) bandY1 = y;
         bandCount++;
         gapLen = 0;
         if (bandCount > bestCount) {
            bestCount = bandCount;
            bestY1 = bandY1;
            bestY2 = y;
         }
      } else {
         gapLen++;
         if (gapLen > MAX_GAP) {
            bandY1 = -1;
            bandCount = 0;
            gapLen = 0;
         }
      }
   }

   if (bestY2 < bestY1 || bestCount < height * 0.05) return null;

   // Collect x-bounds from the band, using percentiles to ignore outlier rows
   const bandRuns = (
      rowRuns.slice(bestY1, bestY2 + 1) as Array<{
         start: number;
         end: number;
      } | null>
   ).filter(Boolean) as Array<{ start: number; end: number }>;

   if (bandRuns.length === 0) return null;

   const starts = bandRuns.map(r => r.start).sort((a, b) => a - b);
   const ends = bandRuns.map(r => r.end).sort((a, b) => a - b);
   // 10th percentile start (trim wider-left outliers) and 90th percentile end
   const x1 = starts[Math.floor(starts.length * 0.1)];
   const x2 = ends[Math.floor(ends.length * 0.9)];

   if (x2 <= x1) return null;

   return {
      x: x1,
      y: bestY1,
      width: x2 - x1 + 1,
      height: bestY2 - bestY1 + 1,
   };
}

// ---------------------------------------------------------------------------
// Quality gate
// ---------------------------------------------------------------------------

function isGoodResult(
   r: { x: number; y: number; width: number; height: number },
   imgW: number,
   imgH: number,
): boolean {
   const area = r.width * r.height;
   const aspect = r.width / Math.max(1, r.height);
   return area > imgW * imgH * 0.03 && aspect < 4 && aspect > 0.25;
}

function scaleResult(
   r: { x: number; y: number; width: number; height: number },
   scaleX: number,
   scaleY: number,
): FrameInset {
   return {
      x: Math.round(r.x * scaleX),
      y: Math.round(r.y * scaleY),
      width: Math.round(r.width * scaleX),
      height: Math.round(r.height * scaleY),
   };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect the largest "empty" rectangular region in the frame image.
 *
 * @param source  base64 data URI (`data:image/png;base64,...`) or absolute file path
 * @param frameDisplayWidth   The display width of the frame (as used in the SVG config)
 * @param frameDisplayHeight  The display height of the frame (as used in the SVG config)
 * @returns Inset rectangle scaled to frame display dimensions, or null on failure
 */
export async function detectFrameInset(
   source: string,
   frameDisplayWidth: number,
   frameDisplayHeight: number,
): Promise<FrameInset | null> {
   try {
      const { data, width, height } = await toRawRGBA(source);
      const scaleX = frameDisplayWidth / width;
      const scaleY = frameDisplayHeight / height;

      // Pass 1: histogram — finds the exact largest all-white/transparent rectangle.
      // Precise for frames with a clean white or transparent QR hole.
      const histResult = detectHistogram(data, width, height);
      if (histResult && isGoodResult(histResult, width, height)) {
         return scaleResult(histResult, scaleX, scaleY);
      }

      // Pass 2: score-based — tolerates partial occlusion inside the white area
      // (decorations, silhouettes, text overlaid on the white hole).
      const scoreResult = detectScoreBased(data, width, height);
      if (scoreResult && isGoodResult(scoreResult, width, height)) {
         return scaleResult(scoreResult, scaleX, scaleY);
      }

      // Pass 3: inner-run — for frames where the QR area is a gray/light region
      // surrounded by dark decorative borders, with a similar-coloured outer border.
      const innerResult = detectInnerRun(data, width, height);
      if (innerResult && isGoodResult(innerResult, width, height)) {
         return scaleResult(innerResult, scaleX, scaleY);
      }

      // Last resort: return whatever the histogram found, even if small
      if (histResult) return scaleResult(histResult, scaleX, scaleY);
      if (scoreResult) return scaleResult(scoreResult, scaleX, scaleY);
      return null;
   } catch (err) {
      console.warn('[detectFrameInset] Detection failed:', err);
      return null;
   }
}
