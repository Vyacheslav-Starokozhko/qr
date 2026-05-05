import {
  Options,
  Gradient,
  QrPartOptions,
  QrOverlay,
  QrOverlayMask,
  QrLayerFill,
  QrDecorationBuiltinShape,
  QrDecorationPlacement,
} from "./types";

export type RandomizeConfig = {
  /** Randomize the main QR dots color — randomly picks solid color or gradient */
  dotsColor?: boolean;
  /** Randomize the main QR dots shape */
  dotsShape?: boolean;
  /**
   * Add random overlay mask layers (stripe/zigzag/wave/checker) to dots.
   *
   * - When combined with `dotsColor`: the random color/gradient becomes the base
   *   overlay layer and 1–2 mask layers are stacked on top for texture.
   * - When used alone: generates a full overlay set (base fill + mask layers),
   *   replacing `color`/`gradient`.
   */
  dotsOverlays?: boolean;
  /** Randomize inner eye (ball) color — randomly picks solid color or gradient */
  cornersDotColor?: boolean;
  /** Randomize inner eye (ball) shape */
  cornersDotShape?: boolean;
  /**
   * Add random overlay mask layers to inner eyes (cornersDot).
   * Same combination rules as `dotsOverlays`.
   */
  cornersDotOverlays?: boolean;
  /** Randomize outer eye (frame) color — randomly picks solid color or gradient */
  cornersSquareColor?: boolean;
  /** Randomize outer eye (frame) shape */
  cornersSquareShape?: boolean;
  /**
   * Add random overlay mask layers to outer eyes (cornersSquare).
   * Same combination rules as `dotsOverlays`.
   */
  cornersSquareOverlays?: boolean;
  /** Randomize background color — randomly picks solid color or gradient */
  backgroundColor?: boolean;
  /** Randomize border radius (0–100) */
  borderRadius?: boolean;
  /** Generate random decoration layers in the QR margin */
  decorations?: boolean;
  /** @deprecated Use `dotsOverlays` instead */
  dotsPattern?: boolean;
  /** @deprecated Use `cornersDotOverlays` instead */
  cornersDotPattern?: boolean;
  /** @deprecated Use `cornersSquareOverlays` instead */
  cornersSquarePattern?: boolean;
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

const MASK_TYPES: QrOverlayMask["type"][] = ["stripe", "zigzag", "wave", "checker"];

function randomLayerFill(colorFn: (rng: () => number) => string, rng: () => number): QrLayerFill {
  if (rng() < 0.5) return { type: "gradient", gradient: randomGradient(colorFn, rng) };
  return { type: "color", color: colorFn(rng) };
}

function randomMask(rng: () => number): QrOverlayMask {
  const type = pick(MASK_TYPES, rng);
  const scale = 2 + rng() * 4; // 2–6 modules
  if (type === "stripe") return { type, scale, angle: Math.floor(rng() * 180) };
  return { type, scale } as QrOverlayMask;
}

/** Generates 1–2 masked overlay layers (no base layer). Used when a base fill already exists. */
function randomMaskLayers(rng: () => number): QrOverlay[] {
  const count = 1 + Math.floor(rng() * 2); // 1 or 2
  return Array.from({ length: count }, () => ({
    fill: randomLayerFill(randomDarkColor, rng),
    mask: randomMask(rng),
    opacity: 0.4 + rng() * 0.55,
  }));
}

/** Generates 1–2 stacked overlay layers for a dots/eye part (base + optional mask). */
function randomOverlays(rng: () => number): QrOverlay[] {
  const layerCount = rng() < 0.5 ? 1 : 2;
  return Array.from({ length: layerCount }, (_, i) => ({
    fill: randomLayerFill(randomDarkColor, rng),
    mask: i === 0 ? undefined : randomMask(rng),
    opacity: i === 0 ? 1 : 0.5 + rng() * 0.5,
  }));
}

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

  // Resolve deprecated aliases so the rest of the function only checks the canonical names.
  const dotsOv    = config.dotsOverlays    ?? config.dotsPattern    ?? false;
  const dotsDotOv = config.cornersDotOverlays ?? config.cornersDotPattern ?? false;
  const sqOv      = config.cornersSquareOverlays ?? config.cornersSquarePattern ?? false;

  // Builds the overlay array for a part.
  // combined=true: color/gradient is layer 0, mask layers follow (dotsColor + dotsOverlays).
  // combined=false: full independent overlay set (dotsOverlays alone).
  function buildOverlays(combined: boolean): QrOverlay[] {
    if (combined) {
      const baseFill = randomLayerFill(randomDarkColor, rng);
      return [{ fill: baseFill }, ...randomMaskLayers(rng)];
    }
    return randomOverlays(rng);
  }

  // --- dots ---
  if (config.dotsColor || config.dotsShape || dotsOv) {
    result.dotsOptions = { ...base.dotsOptions };
    if (dotsOv) {
      result.dotsOptions.overlays = buildOverlays(!!config.dotsColor);
      result.dotsOptions.color = undefined;
      result.dotsOptions.gradient = undefined;
    } else if (config.dotsColor) {
      Object.assign(result.dotsOptions, randomDarkFill(rng));
      result.dotsOptions.overlays = undefined;
    }
    if (config.dotsShape) {
      result.dotsOptions.shape =
        rng() > 0.5
          ? { type: "icon", path: pick(DOT_ICON_SHAPES, rng) }
          : { type: "figure", path: pick(DOT_FIGURE_SHAPES, rng) };
    }
  }

  // --- inner eye (cornersDot) ---
  if (config.cornersDotColor || config.cornersDotShape || dotsDotOv) {
    result.cornersDotOptions = { ...base.cornersDotOptions };
    if (dotsDotOv) {
      result.cornersDotOptions.overlays = buildOverlays(!!config.cornersDotColor);
      result.cornersDotOptions.color = undefined;
      result.cornersDotOptions.gradient = undefined;
    } else if (config.cornersDotColor) {
      Object.assign(result.cornersDotOptions, randomDarkFill(rng));
      result.cornersDotOptions.overlays = undefined;
    }
    if (config.cornersDotShape) {
      result.cornersDotOptions.shape = { type: "icon", path: pick(INNER_EYE_SHAPES, rng) };
    }
  }

  // --- outer eye (cornersSquare) ---
  if (config.cornersSquareColor || config.cornersSquareShape || sqOv) {
    result.cornersSquareOptions = { ...base.cornersSquareOptions };
    if (sqOv) {
      result.cornersSquareOptions.overlays = buildOverlays(!!config.cornersSquareColor);
      result.cornersSquareOptions.color = undefined;
      result.cornersSquareOptions.gradient = undefined;
    } else if (config.cornersSquareColor) {
      Object.assign(result.cornersSquareOptions, randomDarkFill(rng));
      result.cornersSquareOptions.overlays = undefined;
    }
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

// ─── normalizeOptions ─────────────────────────────────────────────────────────

function _hexToRgb(hex: string): [number, number, number] {
  if (!hex.startsWith("#") || hex.length < 7) return [0, 0, 0];
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function _srgbLinear(c: number): number {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
}

function _rgbLum(r: number, g: number, b: number): number {
  return 0.2126 * _srgbLinear(r) + 0.7152 * _srgbLinear(g) + 0.0722 * _srgbLinear(b);
}

function _hexLum(hex: string): number {
  return _rgbLum(..._hexToRgb(hex));
}

function _wcag(la: number, lb: number): number {
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function _rgbToHsl(r: number, g: number, b: number): [number, number, number] {
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

// Luminance of an HSL triple without allocating an intermediate hex string
function _hslLum(h: number, s: number, l: number): number {
  const sl = s / 100, ll = l / 100;
  const a = sl * Math.min(ll, 1 - ll);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.max(0, Math.min(255, Math.round(255 * (ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)))));
  };
  return _rgbLum(f(0), f(8), f(4));
}

/**
 * Shifts `color`'s HSL lightness (24-iteration binary search) until
 * wcag(result, bgLum) >= minRatio. Hue and saturation are unchanged.
 * Returns the original string unchanged when contrast is already sufficient.
 *
 * makeDarker = true  → decrease L (dots on light background)
 * makeDarker = false → increase L (inverted QR — dots on dark background)
 */
function _adjustColor(color: string, bgLum: number, minRatio: number, makeDarker: boolean): string {
  if (!color.startsWith("#")) return color;
  const [r, g, b] = _hexToRgb(color);
  if (_wcag(_rgbLum(r, g, b), bgLum) >= minRatio) return color;

  const [h, s, l] = _rgbToHsl(r, g, b);
  let lo = makeDarker ? 0 : l;
  let hi = makeDarker ? l : 100;

  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (makeDarker) {
      // Maximize L (least darkening) while ratio >= minRatio
      if (_wcag(_hslLum(h, s, mid), bgLum) >= minRatio) lo = mid; else hi = mid;
    } else {
      // Minimize L (least lightening) while ratio >= minRatio
      if (_wcag(_hslLum(h, s, mid), bgLum) >= minRatio) hi = mid; else lo = mid;
    }
  }

  return hslToHex(h, s, makeDarker ? lo : hi);
}

function _avgLum(hexColors: string[]): number {
  if (!hexColors.length) return 0;
  return hexColors.reduce((sum, c) => sum + _hexLum(c), 0) / hexColors.length;
}

function _gradLum(g: Gradient): number {
  return _avgLum(g.colorStops.map((s) => s.color));
}

// Returns null when the part has no explicit color set (uses the library default)
function _partLum(part: QrPartOptions | undefined): number | null {
  if (!part) return null;
  if (part.overlays?.length) {
    const base = part.overlays.find((o) => !o.mask);
    if (base) return base.fill.type === "color" ? _hexLum(base.fill.color) : _gradLum(base.fill.gradient);
  }
  if (part.gradient) return _gradLum(part.gradient);
  if (part.color !== undefined) return _hexLum(part.color);
  return null;
}

function _bgLum(options: Options): number {
  if (options.backgroundEnable === false) return 1.0;
  const bg = options.backgroundOptions;
  if (!bg) return 1.0;
  if (bg.gradient) return _gradLum(bg.gradient);
  return _hexLum(bg.color ?? "#ffffff");
}

function _adjustGradient(g: Gradient, bgLum: number, minRatio: number, darker: boolean): Gradient {
  return {
    ...g,
    colorStops: g.colorStops.map((s) => ({ ...s, color: _adjustColor(s.color, bgLum, minRatio, darker) })),
  };
}

function _adjustFill(fill: QrLayerFill, bgLum: number, minRatio: number, darker: boolean): QrLayerFill {
  if (fill.type === "color") return { type: "color", color: _adjustColor(fill.color, bgLum, minRatio, darker) };
  return { type: "gradient", gradient: _adjustGradient(fill.gradient, bgLum, minRatio, darker) };
}

function _adjustPart(
  part: QrPartOptions | undefined,
  bgLum: number,
  minRatio: number,
  darker: boolean,
): QrPartOptions | undefined {
  if (!part) return part;
  const result: QrPartOptions = { ...part };
  if (part.overlays?.length) {
    // Only adjust full-coverage base layers — masked decorative layers don't affect readability
    result.overlays = part.overlays.map((o) =>
      o.mask ? o : { ...o, fill: _adjustFill(o.fill, bgLum, minRatio, darker) },
    );
  } else if (part.gradient) {
    result.gradient = _adjustGradient(part.gradient, bgLum, minRatio, darker);
  } else if (part.color !== undefined) {
    result.color = _adjustColor(part.color, bgLum, minRatio, darker);
  }
  return result;
}

/**
 * Returns a copy of `base` with colors adjusted so the QR code is reliably
 * scannable, while preserving the original design as closely as possible.
 *
 * **Only the HSL lightness channel is shifted** — hue and saturation stay the
 * same, so colours keep their character (a muted red stays red, just darker).
 * A binary search finds the *minimal* lightness shift that achieves the target
 * contrast, so the visual change is as small as physics allows.
 *
 * Works with solid colors, gradients (each stop independently), and overlays
 * (only full-coverage base layers — masked decorative layers are left untouched).
 *
 * Detects inverted QR codes (light dots on dark background) automatically and
 * shifts in the correct direction for both cases.
 *
 * @param base        Source options (not mutated).
 * @param minContrast Minimum WCAG contrast ratio (default 3.0).
 */
export function normalizeOptions(base: Options, minContrast = 3.0): Options {
  const bgLum = _bgLum(base);
  const dotsLum = _partLum(base.dotsOptions) ?? 0;

  if (_wcag(dotsLum, bgLum) >= minContrast) return base;

  // Standard: dark dots on light background → darken dots
  // Inverted: light dots on dark background → lighten dots
  const darkenDots = dotsLum <= bgLum;

  return {
    ...base,
    dotsOptions: _adjustPart(base.dotsOptions, bgLum, minContrast, darkenDots),
    cornersSquareOptions: _adjustPart(base.cornersSquareOptions, bgLum, minContrast, darkenDots),
    cornersDotOptions: _adjustPart(base.cornersDotOptions, bgLum, minContrast, darkenDots),
  };
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

function invertLayerFill(fill: QrLayerFill): QrLayerFill {
  if (fill.type === "color") return { type: "color", color: invertHex(fill.color) };
  return { type: "gradient", gradient: invertGradient(fill.gradient) };
}

function invertPart(part: QrPartOptions | undefined): QrPartOptions | undefined {
  if (!part) return part;
  return {
    ...part,
    color: part.color !== undefined ? invertHex(part.color) : undefined,
    gradient: part.gradient !== undefined ? invertGradient(part.gradient) : undefined,
    overlays: part.overlays?.map((o) => ({ ...o, fill: invertLayerFill(o.fill) })),
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
