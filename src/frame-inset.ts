/**
 * detectFrameInset
 *
 * Analyses a frame image and returns the bounding box of the largest
 * rectangular region that is either fully transparent (alpha < threshold)
 * or very bright (luminance > threshold) — i.e. the "hole" where the QR
 * code should sit.
 *
 * Algorithm: for every row build a histogram of consecutive "empty" pixels
 * above it, then apply the classic O(n) "largest rectangle in histogram"
 * stack algorithm. Total complexity: O(w × h).
 */

export interface FrameInset {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Pixels with alpha below this are considered "empty" */
const ALPHA_THRESHOLD = 128;
/** Pixels with luminance above this (0-255) are considered "empty" */
const LUMA_THRESHOLD = 240;

/** Decode a source string (data URI or file path) to a raw RGBA array */
async function toRawRGBA(source: string): Promise<{
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}> {
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas 2D not supported"));
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
  if (source.startsWith("data:")) {
    const commaIdx = source.indexOf(",");
    const b64 = source.slice(commaIdx + 1);
    input = typeof Buffer !== "undefined" ? Buffer.from(b64, "base64") : source;
  } else {
    input = source; // file path
  }

  let sharp: any;
  try {
    const sharpModule = await import("sharp");
    sharp = sharpModule.default || sharpModule;
  } catch (err) {
    throw new Error(
      "The 'sharp' package is required for frame detection in Node.js.",
    );
  }
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { data, width: info.width, height: info.height };
}

/** Returns true if the pixel at offset `i` (RGBA) is considered "empty" */
function isEmpty(data: Uint8Array | Uint8ClampedArray, i: number): boolean {
  const a = data[i + 3];
  if (a < ALPHA_THRESHOLD) return true;
  // Weighted luminance for non-transparent pixels
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  return luma > LUMA_THRESHOLD;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
}

/** Largest rectangle in histogram — returns { left, width, height } */
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
      if (width * height > best.width * best.height) {
        best = { left, width, height };
      }
    }
    stack.push(i);
  }
  return best;
}

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

    // Build per-row histograms and track the best rectangle
    const heights = new Array<number>(width).fill(0);
    let best: Rect = { x: 0, y: 0, width: 0, height: 0, area: 0 };

    for (let row = 0; row < height; row++) {
      // Update histogram column heights
      for (let col = 0; col < width; col++) {
        const i = (row * width + col) * 4;
        heights[col] = isEmpty(data, i) ? heights[col] + 1 : 0;
      }

      // Find largest rectangle terminating at this row
      const { left, width: rw, height: rh } = largestRectInHistogram(heights);
      const area = rw * rh;
      if (area > best.area) {
        best = {
          x: left,
          y: row - rh + 1,
          width: rw,
          height: rh,
          area,
        };
      }
    }

    if (best.area === 0) return null;

    // Scale from image pixel space to frame display space
    const scaleX = frameDisplayWidth / width;
    const scaleY = frameDisplayHeight / height;

    return {
      x: Math.round(best.x * scaleX),
      y: Math.round(best.y * scaleY),
      width: Math.round(best.width * scaleX),
      height: Math.round(best.height * scaleY),
    };
  } catch (err) {
    console.warn("[detectFrameInset] Detection failed:", err);
    return null;
  }
}
