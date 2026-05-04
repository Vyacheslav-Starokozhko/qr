import {
  Options,
  Gradient,
  QrPartOptions,
  QrDecorationBuiltinShape,
  QrDecorationPlacement,
} from "./types";

export type RandomizeConfig = {
  /** Randomize the main QR dots color — randomly picks solid color or gradient */
  dotsColor?: boolean;
  /** Randomize the main QR dots shape */
  dotsShape?: boolean;
  /** Randomize inner eye (ball) color — randomly picks solid color or gradient */
  cornersDotColor?: boolean;
  /** Randomize inner eye (ball) shape */
  cornersDotShape?: boolean;
  /** Randomize outer eye (frame) color — randomly picks solid color or gradient */
  cornersSquareColor?: boolean;
  /** Randomize outer eye (frame) shape */
  cornersSquareShape?: boolean;
  /** Randomize background color — randomly picks solid color or gradient */
  backgroundColor?: boolean;
  /** Randomize border radius (0–100) */
  borderRadius?: boolean;
  /** Generate random decoration layers in the QR margin */
  decorations?: boolean;
};

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

// L 15–38 %, S 85–100 % — vibrant saturated colors that are still dark enough
// for acceptable contrast against a light background in most hue combinations.
function randomDarkColor(rng: () => number): string {
  return hslToHex(
    Math.floor(rng() * 360),
    85 + Math.floor(rng() * 15),
    15 + Math.floor(rng() * 24),
  );
}

// L 72–93 %, S 30–75 % — genuinely colorful backgrounds, not near-white.
function randomLightColor(rng: () => number): string {
  return hslToHex(
    Math.floor(rng() * 360),
    30 + Math.floor(rng() * 45),
    72 + Math.floor(rng() * 22),
  );
}

function randomGradient(colorFn: (rng: () => number) => string, rng: () => number): Gradient {
  const linear = rng() < 0.5;
  return {
    type: linear ? "linear" : "radial",
    ...(linear ? { rotation: Math.floor(rng() * 360) } : {}),
    colorStops: [
      { offset: "0%", color: colorFn(rng) },
      { offset: "100%", color: colorFn(rng) },
    ],
  };
}

function randomDarkGradient(rng: () => number): Gradient {
  return randomGradient(randomDarkColor, rng);
}

function randomLightGradient(rng: () => number): Gradient {
  return randomGradient(randomLightColor, rng);
}

// Randomly picks solid color or gradient (~40 % chance of gradient).
function randomDarkFill(rng: () => number): Pick<QrPartOptions, "color" | "gradient"> {
  if (rng() < 0.4) return { gradient: randomDarkGradient(rng), color: undefined };
  return { color: randomDarkColor(rng), gradient: undefined };
}

function randomLightFill(
  rng: () => number,
): Pick<Required<Options>["backgroundOptions"], "color" | "gradient"> {
  if (rng() < 0.4) return { gradient: randomLightGradient(rng), color: undefined };
  return { color: randomLightColor(rng), gradient: undefined };
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

const DECORATION_SHAPES: QrDecorationBuiltinShape[] = [
  "dot",
  "ring",
  "square",
  "diamond",
  "star",
  "star4",
  "cross",
  "triangle",
];

const DECORATION_PLACEMENTS: QrDecorationPlacement[] = [
  "scatter",
  "corners",
  "edges",
  "top",
  "bottom",
  "left",
  "right",
];

/**
 * Returns a new `Options` object with selected fields replaced by random values.
 *
 * Color flags (`dotsColor`, `backgroundColor`, …) randomly produce either a
 * solid color **or** a linear gradient (~40 % chance) — no separate flag needed.
 *
 * All generated colors are contrast-aware by design: dot/eye colors are dark
 * (L 8–15 %), background colors are light (L 85–97 %), guaranteeing a WCAG
 * contrast ratio ≥ 7:1 so every result is scannable without a validation loop.
 *
 * @param base   — Starting options; untouched fields are preserved as-is.
 * @param config — Flags that control which fields are randomised.
 * @param seed   — Optional integer seed for reproducible results.
 *                 When omitted, a random seed based on `Date.now()` is used.
 */
export function randomizeOptions(
  base: Options,
  config: RandomizeConfig,
  seed?: number,
): Options {
  const rng = mulberry32(seed ?? (Date.now() & 0xffffffff));
  const result: Options = { ...base };

  // --- dots ---
  if (config.dotsColor || config.dotsShape) {
    result.dotsOptions = { ...base.dotsOptions };
    if (config.dotsColor) Object.assign(result.dotsOptions, randomDarkFill(rng));
    if (config.dotsShape) {
      result.dotsOptions.shape =
        rng() > 0.5
          ? { type: "icon", path: pick(DOT_ICON_SHAPES, rng) }
          : { type: "figure", path: pick(DOT_FIGURE_SHAPES, rng) };
    }
  }

  // --- inner eye (cornersDot) ---
  if (config.cornersDotColor || config.cornersDotShape) {
    result.cornersDotOptions = { ...base.cornersDotOptions };
    if (config.cornersDotColor) Object.assign(result.cornersDotOptions, randomDarkFill(rng));
    if (config.cornersDotShape) {
      result.cornersDotOptions.shape = { type: "icon", path: pick(INNER_EYE_SHAPES, rng) };
    }
  }

  // --- outer eye (cornersSquare) ---
  if (config.cornersSquareColor || config.cornersSquareShape) {
    result.cornersSquareOptions = { ...base.cornersSquareOptions };
    if (config.cornersSquareColor) Object.assign(result.cornersSquareOptions, randomDarkFill(rng));
    if (config.cornersSquareShape) {
      result.cornersSquareOptions.shape = { type: "icon", path: pick(OUTER_EYE_SHAPES, rng) };
    }
  }

  // --- background ---
  if (config.backgroundColor) {
    result.backgroundOptions = {
      ...base.backgroundOptions,
      ...randomLightFill(rng),
    };
  }

  // --- borderRadius ---
  if (config.borderRadius) {
    result.borderRadius = Math.floor(rng() * 101);
  }

  // --- decorations ---
  if (config.decorations) {
    const layerCount = 1 + Math.floor(rng() * 2); // 1 or 2 layers
    result.decorations = Array.from({ length: layerCount }, (_, i) => ({
      shape: pick(DECORATION_SHAPES, rng),
      color: randomDarkColor(rng),
      placement: pick(DECORATION_PLACEMENTS, rng),
      size: 0.3 + rng() * 0.5,            // 0.3–0.8 modules
      opacity: 0.3 + rng() * 0.6,         // 0.3–0.9
      seed: Math.floor(rng() * 0xffff) ^ (i * 0x9e3779b9),
    }));
  }

  return result;
}

// ─── invertOptions ────────────────────────────────────────────────────────────

function invertHex(color: string): string {
  if (!color.startsWith("#") || color.length < 7) return color;
  const n = parseInt(color.slice(1, 7), 16);
  return "#" + (0xffffff ^ n).toString(16).padStart(6, "0");
}

function invertGradient(g: Gradient): Gradient {
  return {
    ...g,
    colorStops: g.colorStops.map((s) => ({ ...s, color: invertHex(s.color) })),
  };
}

function invertPart(part: QrPartOptions | undefined): QrPartOptions | undefined {
  if (!part) return part;
  return {
    ...part,
    color: part.color !== undefined ? invertHex(part.color) : undefined,
    gradient: part.gradient !== undefined ? invertGradient(part.gradient) : undefined,
  };
}

/**
 * Returns a new `Options` object with every colour mathematically inverted
 * (each channel: 255 − value). Swaps dark dots ↔ light background, turning a
 * standard QR into an inverted one and vice-versa.
 */
export function invertOptions(options: Options): Options {
  const result: Options = { ...options };

  result.dotsOptions = invertPart(options.dotsOptions);
  result.cornersDotOptions = invertPart(options.cornersDotOptions);
  result.cornersSquareOptions = invertPart(options.cornersSquareOptions);

  if (options.backgroundOptions) {
    result.backgroundOptions = {
      ...options.backgroundOptions,
      color:
        options.backgroundOptions.color !== undefined
          ? invertHex(options.backgroundOptions.color)
          : undefined,
      gradient:
        options.backgroundOptions.gradient !== undefined
          ? invertGradient(options.backgroundOptions.gradient)
          : undefined,
    };
  }

  return result;
}
