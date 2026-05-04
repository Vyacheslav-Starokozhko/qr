import { Options, Gradient } from "./types";

export type RandomizeConfig = {
  /** Randomize the main QR dots solid color (clears gradient) */
  dotsColor?: boolean;
  /** Randomize the main QR dots as a linear gradient (clears solid color) */
  dotsGradient?: boolean;
  /** Randomize the main QR dots shape */
  dotsShape?: boolean;
  /** Randomize inner eye (ball) solid color (clears gradient) */
  cornersDotColor?: boolean;
  /** Randomize inner eye (ball) as a linear gradient (clears solid color) */
  cornersDotGradient?: boolean;
  /** Randomize inner eye (ball) shape */
  cornersDotShape?: boolean;
  /** Randomize outer eye (frame) solid color (clears gradient) */
  cornersSquareColor?: boolean;
  /** Randomize outer eye (frame) as a linear gradient (clears solid color) */
  cornersSquareGradient?: boolean;
  /** Randomize outer eye (frame) shape */
  cornersSquareShape?: boolean;
  /** Randomize background solid color (clears gradient) */
  backgroundColor?: boolean;
  /** Randomize background as a linear gradient (clears solid color) */
  backgroundGradient?: boolean;
  /** Randomize border radius (0–100) */
  borderRadius?: boolean;
};

// Seeded PRNG — identical implementation to the one used for decorations
function mulberry32(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function hslToHex(h: number, s: number, l: number): string {
  const sl = s / 100;
  const ll = l / 100;
  const a = sl * Math.min(ll, 1 - ll);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function randomColor(rng: () => number): string {
  const h = Math.floor(rng() * 360);
  const s = 60 + Math.floor(rng() * 40); // 60–100 %
  const l = 15 + Math.floor(rng() * 40); // 15–55 %
  return hslToHex(h, s, l);
}

function randomGradient(rng: () => number): Gradient {
  return {
    type: "linear",
    rotation: Math.floor(rng() * 360),
    colorStops: [
      { offset: "0%", color: randomColor(rng) },
      { offset: "100%", color: randomColor(rng) },
    ],
  };
}

const DOT_ICON_SHAPES = [
  "dots-square",
  "dots-rounded",
  "dots-classy",
  "dots-classy-rounded",
  "dots-extra-rounded",
] as const;

const DOT_FIGURE_SHAPES = [
  "square",
  "dots",
  "extra-rounded",
  "rounded",
  "classy",
  "classy-rounded",
] as const;

const INNER_EYE_SHAPES = [
  "inner-eye-square",
  "inner-eye-dot",
  "inner-eye-dots",
  "inner-eye-rounded",
  "inner-eye-classy",
  "inner-eye-extra-rounded",
  "inner-eye-extra-classy",
  "inner-eye-star",
] as const;

const OUTER_EYE_SHAPES = [
  "outer-eye-square",
  "outer-eye-dot",
  "outer-eye-dots",
  "outer-eye-rounded",
  "outer-eye-classy",
  "outer-eye-extra-rounded",
  "outer-eye-extra-classy",
  "outer-eye-heart",
  "outer-eye-star",
] as const;

/**
 * Returns a new `Options` object with selected fields replaced by random values.
 *
 * @param base    — Starting options; untouched fields are preserved as-is.
 * @param config  — Flags that control which fields are randomised.
 * @param seed    — Optional integer seed for reproducible results.
 *                  When omitted, a random seed based on `Date.now()` is used.
 */
export function randomizeOptions(
  base: Options,
  config: RandomizeConfig,
  seed?: number,
): Options {
  const rng = mulberry32(seed ?? (Date.now() & 0xffffffff));
  const result: Options = { ...base };

  // --- dots ---
  if (config.dotsColor || config.dotsGradient || config.dotsShape) {
    result.dotsOptions = { ...base.dotsOptions };
    if (config.dotsGradient) {
      result.dotsOptions.gradient = randomGradient(rng);
      result.dotsOptions.color = undefined;
    } else if (config.dotsColor) {
      result.dotsOptions.color = randomColor(rng);
      result.dotsOptions.gradient = undefined;
    }
    if (config.dotsShape) {
      result.dotsOptions.shape =
        rng() > 0.5
          ? { type: "icon", path: pick(DOT_ICON_SHAPES, rng) }
          : { type: "figure", path: pick(DOT_FIGURE_SHAPES, rng) };
    }
  }

  // --- inner eye (cornersDot) ---
  if (config.cornersDotColor || config.cornersDotGradient || config.cornersDotShape) {
    result.cornersDotOptions = { ...base.cornersDotOptions };
    if (config.cornersDotGradient) {
      result.cornersDotOptions.gradient = randomGradient(rng);
      result.cornersDotOptions.color = undefined;
    } else if (config.cornersDotColor) {
      result.cornersDotOptions.color = randomColor(rng);
      result.cornersDotOptions.gradient = undefined;
    }
    if (config.cornersDotShape) {
      result.cornersDotOptions.shape = {
        type: "icon",
        path: pick(INNER_EYE_SHAPES, rng),
      };
    }
  }

  // --- outer eye (cornersSquare) ---
  if (config.cornersSquareColor || config.cornersSquareGradient || config.cornersSquareShape) {
    result.cornersSquareOptions = { ...base.cornersSquareOptions };
    if (config.cornersSquareGradient) {
      result.cornersSquareOptions.gradient = randomGradient(rng);
      result.cornersSquareOptions.color = undefined;
    } else if (config.cornersSquareColor) {
      result.cornersSquareOptions.color = randomColor(rng);
      result.cornersSquareOptions.gradient = undefined;
    }
    if (config.cornersSquareShape) {
      result.cornersSquareOptions.shape = {
        type: "icon",
        path: pick(OUTER_EYE_SHAPES, rng),
      };
    }
  }

  // --- background ---
  if (config.backgroundColor || config.backgroundGradient) {
    result.backgroundOptions = { ...base.backgroundOptions };
    if (config.backgroundGradient) {
      result.backgroundOptions.gradient = randomGradient(rng);
      result.backgroundOptions.color = undefined;
    } else if (config.backgroundColor) {
      result.backgroundOptions.color = randomColor(rng);
      result.backgroundOptions.gradient = undefined;
    }
  }

  // --- borderRadius ---
  if (config.borderRadius) {
    result.borderRadius = Math.floor(rng() * 101); // 0–100
  }

  return result;
}
