import {
  Options,
  Gradient,
  QrPartOptions,
  QrOverlay,
  QrOverlayMask,
  QrLayerFill,
  QrShape,
  QrDecorationBuiltinShape,
  QrDecorationPlacement,
  QrEffect,
  QrAnimation,
} from "./types";

/**
 * Fine-grained tuning for {@link randomizeOptions}.
 * Every field is optional — omitted values fall back to the built-in defaults.
 */
export type RandomizeTuning = {
  /** 0–1 probability of a dark-background theme when `backgroundColor` is randomised. Default 0.45 */
  darkThemeChance?: number;
  /** 0–1 probability of gradient vs solid color for any fill. Default 0.60 */
  gradientChance?: number;
  /** 0–1 probability of a 3-stop gradient over a 2-stop one. Default 0.45 */
  threeStopChance?: number;

  /** HSL color ranges — each entry is [min, max] (inclusive, same units as CSS HSL). */
  colors?: {
    /** Lightness for dots/eyes on a light background.  Default [10, 32] */
    darkLightness?: [number, number];
    /** Saturation for dots/eyes on a light background. Default [85, 100] */
    darkSaturation?: [number, number];
    /** Lightness for dots/eyes on a dark background.  Default [62, 88] */
    vividLightness?: [number, number];
    /** Saturation for dots/eyes on a dark background. Default [80, 100] */
    vividSaturation?: [number, number];
    /** Background lightness — light theme.  Default [92, 98] */
    lightBgLightness?: [number, number];
    /** Background saturation — light theme. Default [10, 45] */
    lightBgSaturation?: [number, number];
    /** Background lightness — dark theme.  Default [4, 14] */
    darkBgLightness?: [number, number];
    /** Background saturation — dark theme. Default [40, 85] */
    darkBgSaturation?: [number, number];
    /** Shimmer overlay lightness  (accent on dark surfaces). Default [88, 98] */
    shimmerLightness?: [number, number];
    /** Shimmer overlay saturation (accent on dark surfaces). Default [0, 20] */
    shimmerSaturation?: [number, number];
  };

  /** Overlay mask tuning. */
  overlays?: {
    /** [min, max] tile scale in modules. Default [0.7, 2.5] */
    scaleRange?: [number, number];
    /** [min, max] number of mask layers added on top of the base. Default [1, 2] */
    layerCountRange?: [number, number];
    /** [min, max] mask opacity on a dark background. Default [0.12, 0.40] */
    opacityDark?: [number, number];
    /** [min, max] mask opacity on a light background. Default [0.35, 0.85] */
    opacityLight?: [number, number];
    /** Mask shape types to draw from. Default: all four */
    maskTypes?: Array<"stripe" | "zigzag" | "wave" | "checker">;
    /** Allowed stripe angles in degrees. Default [0, 30, 45, 60, 90, 120, 135, 150] */
    stripeAngles?: number[];
  };

  /** Effect generation tuning. */
  effects?: {
    /** Chance of adding a drop-shadow (0–1, default 0.25) */
    dropShadowChance?: number;
    /** Chance of adding a neon-glow (0–1, default 0.20) */
    neonGlowChance?: number;
    /** Chance of adding a morphology dilate/erode (0–1, default 0.20) */
    morphologyChance?: number;
    /** Chance of adding a liquid/metaball effect (0–1, default 0.15) */
    liquidChance?: number;
    /** Chance of adding a blend-mode overlay (0–1, default 0.20) */
    blendChance?: number;
    /** Chance of adding a grain/noise texture (0–1, default 0.25) */
    noiseChance?: number;
    /** Chance of applying a duotone color remap (0–1, default 0.15) */
    duotoneChance?: number;
    /** Chance of adding a specular emboss highlight (0–1, default 0.20) */
    embossChance?: number;
    /** Chance of adding RGB chromatic aberration (0–1, default 0.18) */
    colorSplitChance?: number;
    /** Max total effects to stack (default 3) */
    maxEffects?: number;
  };

  /** Animation generation tuning. */
  animations?: {
    /** Chance of generating a pulse animation (0–1, default 0.30) */
    pulseChance?: number;
    /** Chance of generating a shimmer animation (0–1, default 0.30) */
    shimmerChance?: number;
    /** Chance of generating a draw animation (0–1, default 0.20) */
    drawChance?: number;
    /** Chance of generating a glow animation (0–1, default 0.20) */
    glowChance?: number;
    /** Chance of generating a hue-cycle animation (0–1, default 0.25) */
    colorCycleChance?: number;
    /** Chance of generating expanding ripple rings (0–1, default 0.30) */
    rippleChance?: number;
    /** Chance of generating a moving spotlight (0–1, default 0.25) */
    spotlightChance?: number;
    /** Chance of generating a float/bob animation (0–1, default 0.20) */
    floatChance?: number;
    /** Max total animations to stack (default 3) */
    maxAnimations?: number;
    /** Duration range [min, max] seconds. Default [1.5, 4] */
    durationRange?: [number, number];
  };

  /** Shape pools — restrict which shapes each part can pick. */
  shapes?: {
    /** Figure shapes for dots. Default: all figure shapes */
    dotFigures?: string[];
    /** Icon shapes for dots. Default: all dot icon shapes */
    dotIcons?: string[];
    /** 0–1 chance of picking an icon shape vs a figure shape for dots. Default 0.5 */
    dotIconChance?: number;
    /** Inner eye (cornersDot) shapes. Default: all inner eye shapes */
    innerEye?: string[];
    /** Outer eye (cornersSquare) shapes. Default: all outer eye shapes */
    outerEye?: string[];
  };
};

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
  /** Randomize SVG filter effects (drop-shadow, neon-glow, morphology, liquid, blend) */
  effects?: boolean;
  /** Randomize SVG animations (pulse, shimmer, draw, glow) */
  animation?: boolean;

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

// ── Shape pools (default values referenced by resolveT) ──────────────────────

const DOT_ICON_SHAPES = [
  "dots-square", "dots-rounded", "dots-classy", "dots-classy-rounded", "dots-extra-rounded",
] as const;

const DOT_FIGURE_SHAPES = [
  "square", "dots", "extra-rounded", "rounded", "classy", "classy-rounded",
] as const;

const INNER_EYE_SHAPES = [
  "inner-eye-square", "inner-eye-dot", "inner-eye-dots", "inner-eye-rounded",
  "inner-eye-classy", "inner-eye-extra-rounded", "inner-eye-extra-classy", "inner-eye-star",
] as const;

const OUTER_EYE_SHAPES = [
  "outer-eye-square", "outer-eye-dot", "outer-eye-dots", "outer-eye-rounded",
  "outer-eye-classy", "outer-eye-extra-rounded", "outer-eye-extra-classy",
  "outer-eye-heart", "outer-eye-star",
] as const;

// ── Tuning resolver ───────────────────────────────────────────────────────────

type RT = {
  darkThemeChance: number; gradientChance: number; threeStopChance: number;
  darkL: [number,number]; darkS: [number,number];
  vividL: [number,number]; vividS: [number,number];
  lightBgL: [number,number]; lightBgS: [number,number];
  darkBgL: [number,number]; darkBgS: [number,number];
  shimmerL: [number,number]; shimmerS: [number,number];
  scaleRange: [number,number]; layerRange: [number,number];
  opDark: [number,number]; opLight: [number,number];
  maskTypes: QrOverlayMask["type"][]; stripeAngles: number[];
  dotFigures: string[]; dotIcons: string[]; dotIconChance: number;
  innerEye: string[]; outerEye: string[];
  // effects
  fxDropShadow: number; fxNeonGlow: number; fxMorphology: number;
  fxLiquid: number; fxBlend: number; fxMax: number;
  fxNoise: number; fxDuotone: number; fxEmboss: number; fxColorSplit: number;
  // animations
  anPulse: number; anShimmer: number; anDraw: number; anGlow: number;
  anMax: number; anDurRange: [number,number];
  anColorCycle: number; anRipple: number; anSpotlight: number; anFloat: number;
};

function resolveT(t?: RandomizeTuning): RT {
  const c = t?.colors; const o = t?.overlays; const s = t?.shapes;
  const e = t?.effects; const a = t?.animations;
  return {
    darkThemeChance:  t?.darkThemeChance    ?? 0.45,
    gradientChance:   t?.gradientChance     ?? 0.60,
    threeStopChance:  t?.threeStopChance    ?? 0.45,
    darkL:    c?.darkLightness     ?? [10, 32],
    darkS:    c?.darkSaturation    ?? [85, 100],
    vividL:   c?.vividLightness    ?? [62, 88],
    vividS:   c?.vividSaturation   ?? [80, 100],
    lightBgL: c?.lightBgLightness  ?? [92, 98],
    lightBgS: c?.lightBgSaturation ?? [10, 45],
    darkBgL:  c?.darkBgLightness   ?? [4, 14],
    darkBgS:  c?.darkBgSaturation  ?? [40, 85],
    shimmerL: c?.shimmerLightness  ?? [88, 98],
    shimmerS: c?.shimmerSaturation ?? [0, 20],
    scaleRange:  o?.scaleRange      ?? [0.7, 2.5],
    layerRange:  o?.layerCountRange ?? [1, 2],
    opDark:   o?.opacityDark       ?? [0.12, 0.40],
    opLight:  o?.opacityLight      ?? [0.35, 0.85],
    maskTypes:    (o?.maskTypes    ?? ["stripe", "zigzag", "wave", "checker"]) as QrOverlayMask["type"][],
    stripeAngles:  o?.stripeAngles ?? [0, 30, 45, 60, 90, 120, 135, 150],
    dotFigures: s?.dotFigures  ?? [...DOT_FIGURE_SHAPES],
    dotIcons:   s?.dotIcons    ?? [...DOT_ICON_SHAPES],
    dotIconChance: s?.dotIconChance ?? 0.5,
    innerEye: s?.innerEye ?? [...INNER_EYE_SHAPES],
    outerEye: s?.outerEye ?? [...OUTER_EYE_SHAPES],
    fxDropShadow: e?.dropShadowChance  ?? 0.25,
    fxNeonGlow:   e?.neonGlowChance    ?? 0.20,
    fxMorphology: e?.morphologyChance  ?? 0.20,
    fxLiquid:     e?.liquidChance      ?? 0.15,
    fxBlend:      e?.blendChance       ?? 0.20,
    fxMax:        e?.maxEffects        ?? 3,
    fxNoise:      e?.noiseChance       ?? 0.25,
    fxDuotone:    e?.duotoneChance     ?? 0.15,
    fxEmboss:     e?.embossChance      ?? 0.20,
    fxColorSplit: e?.colorSplitChance  ?? 0.18,
    anPulse:      a?.pulseChance       ?? 0.30,
    anShimmer:    a?.shimmerChance     ?? 0.30,
    anDraw:       a?.drawChance        ?? 0.20,
    anGlow:       a?.glowChance        ?? 0.20,
    anMax:        a?.maxAnimations     ?? 3,
    anDurRange:   a?.durationRange     ?? [1.5, 4],
    anColorCycle: a?.colorCycleChance  ?? 0.25,
    anRipple:     a?.rippleChance      ?? 0.30,
    anSpotlight:  a?.spotlightChance   ?? 0.25,
    anFloat:      a?.floatChance       ?? 0.20,
  };
}

// ── Generator factory — all random functions bound to a resolved tuning ───────

const GRAD_ROTATIONS = [0, 45, 90, 135, 180, 225, 270, 315] as const;

function makeGen(tc: RT) {
  const ri = (lo: number, hi: number, rng: () => number) =>
    lo + Math.floor(rng() * (hi - lo + 1));

  // Returns a color-generator function for the given HSL [L, S] ranges
  const mkC =
    ([lLo, lHi]: [number, number], [sLo, sHi]: [number, number]) =>
    (rng: () => number) =>
      hslToHex(Math.floor(rng() * 360), ri(sLo, sHi, rng), ri(lLo, lHi, rng));

  const darkC   = mkC(tc.darkL,    tc.darkS);
  const vividC  = mkC(tc.vividL,   tc.vividS);
  const pastelC = mkC(tc.lightBgL, tc.lightBgS);
  const deepC   = mkC(tc.darkBgL,  tc.darkBgS);
  const shimC   = mkC(tc.shimmerL, tc.shimmerS);

  function grad(colorFn: (rng: () => number) => string, rng: () => number): Gradient {
    const isLinear = rng() < 0.55;
    const stops = rng() < tc.threeStopChance
      ? [
          { offset: "0%",   color: colorFn(rng) },
          { offset: "50%",  color: colorFn(rng) },
          { offset: "100%", color: colorFn(rng) },
        ]
      : [
          { offset: "0%",   color: colorFn(rng) },
          { offset: "100%", color: colorFn(rng) },
        ];
    return {
      type: isLinear ? "linear" : "radial",
      ...(isLinear ? { rotation: pick(GRAD_ROTATIONS, rng) } : {}),
      colorStops: stops,
    };
  }

  function layerFill(colorFn: (rng: () => number) => string, rng: () => number): QrLayerFill {
    if (rng() < tc.gradientChance) return { type: "gradient", gradient: grad(colorFn, rng) };
    return { type: "color", color: colorFn(rng) };
  }

  // Solid-or-gradient fill for a QR part (dots / eyes)
  function partFill(isDark: boolean, rng: () => number): Pick<QrPartOptions, "color" | "gradient"> {
    const colorFn = isDark ? vividC : darkC;
    if (rng() < tc.gradientChance) return { gradient: grad(colorFn, rng), color: undefined };
    return { color: colorFn(rng), gradient: undefined };
  }

  // Solid-or-gradient fill for the background
  function bgFill(isDark: boolean, rng: () => number): Pick<Required<Options>["backgroundOptions"], "color" | "gradient"> {
    const colorFn = isDark ? deepC : pastelC;
    if (rng() < 0.55) return { gradient: grad(colorFn, rng), color: undefined };
    return { color: colorFn(rng), gradient: undefined };
  }

  function mask(rng: () => number): QrOverlayMask {
    const type = pick(tc.maskTypes, rng);
    const [scMin, scMax] = tc.scaleRange;
    const scale = scMin + rng() * (scMax - scMin);
    const angles = tc.stripeAngles as number[];
    if (type === "stripe") return { type, scale, angle: pick(angles, rng) };
    return { type, scale } as QrOverlayMask;
  }

  // Mask accent layers — shimmer on dark base, dark texture on light base
  function maskLayers(isDark: boolean, rng: () => number): QrOverlay[] {
    const [lcMin, lcMax] = tc.layerRange;
    const count = lcMin + Math.floor(rng() * (lcMax - lcMin + 1));
    const [opMin, opMax] = isDark ? tc.opDark : tc.opLight;
    return Array.from({ length: count }, () => ({
      fill: isDark
        ? { type: "color" as const, color: shimC(rng) }
        : layerFill(darkC, rng),
      mask: mask(rng),
      opacity: opMin + rng() * (opMax - opMin),
    }));
  }

  // Complete overlay set: base fill + optional mask layer
  function overlays(isDark: boolean, rng: () => number): QrOverlay[] {
    const layerCount = rng() < 0.5 ? 1 : 2;
    const colorFn = isDark ? vividC : darkC;
    return Array.from({ length: layerCount }, (_, i) => ({
      fill: layerFill(colorFn, rng),
      mask: i === 0 ? undefined : mask(rng),
      opacity: i === 0 ? 1 : (isDark ? 0.18 + rng() * 0.32 : 0.4 + rng() * 0.5),
    }));
  }

  const BLEND_MODES = [
    "screen", "multiply", "overlay", "darken", "lighten",
    "hard-light", "soft-light", "color-dodge", "color-burn", "difference", "exclusion",
  ] as const;
  const EFFECT_TARGETS = ["dots", "eyes", "all"] as const;
  const ANIM_TARGETS_PULSE = ["dots", "eyes", "all"] as const;
  const ANIM_TARGETS_SHIMMER = ["dots", "eyes"] as const;
  const DRAW_DIRS = ["ltr", "ttb", "rtl", "btt"] as const;

  function randomColor(rng: () => number): string {
    return hslToHex(Math.floor(rng() * 360), 70 + Math.floor(rng() * 30), 50 + Math.floor(rng() * 20));
  }

  // Blend modes safe for each theme.
  // Light bg (dark dots): avoid screen/lighten/color-dodge which wash out dark modules.
  // Dark  bg (light dots): avoid multiply/darken/color-burn which kill light modules.
  const SAFE_BLEND_LIGHT = ["multiply", "darken", "soft-light", "overlay"] as const;
  const SAFE_BLEND_DARK  = ["screen", "lighten", "soft-light", "overlay"] as const;

  function randomEffects(rng: () => number, isDark: boolean): QrEffect[] {
    const out: QrEffect[] = [];
    const dur = (lo: number, hi: number) => lo + rng() * (hi - lo);

    if (rng() < tc.fxDropShadow && out.length < tc.fxMax) {
      out.push({
        type: "drop-shadow",
        target: pick(EFFECT_TARGETS, rng),
        dx: (rng() * 2 - 1),
        dy: (rng() * 2 - 1),
        blur: dur(0.3, 1.5),
        color: randomColor(rng),
        opacity: 0.3 + rng() * 0.35,
      });
    }
    if (rng() < tc.fxNeonGlow && out.length < tc.fxMax) {
      out.push({
        type: "neon-glow",
        target: pick(EFFECT_TARGETS, rng),
        color: randomColor(rng),
        // Keep spread/intensity small — SVG units = module units; large values
        // bleed across adjacent modules and corrupt timing patterns.
        spread: dur(0.2, 0.8),
        intensity: dur(0.4, 1.2),
      });
    }
    if (rng() < tc.fxMorphology && out.length < tc.fxMax) {
      // "dilate" expands dots in module-unit space. Adjacent timing-pattern modules
      // are 1 module apart; dilate > 0.1 bridges the gap and corrupts the pattern.
      // Use "erode" (shrinks dots, always safe) or a very small dilate.
      const operator = rng() < 0.7 ? "erode" : "dilate";
      out.push({
        type: "morphology",
        target: rng() < 0.7 ? "dots" : "eyes",
        operator,
        radius: operator === "dilate" ? dur(0.02, 0.07) : dur(0.04, 0.15),
      });
    }
    if (rng() < tc.fxLiquid && out.length < tc.fxMax) {
      // blur is in module units. blur > ~0.35 modules merges adjacent timing-pattern
      // dots and threshold > ~0.15 makes the alpha cutoff too aggressive.
      out.push({
        type: "liquid",
        target: "dots",
        blur: dur(0.15, 0.30),
        threshold: 0.05 + rng() * 0.10,
      });
    }
    if (rng() < tc.fxBlend && out.length < tc.fxMax) {
      out.push({
        type: "blend",
        target: pick(EFFECT_TARGETS, rng),
        mode: pick(isDark ? SAFE_BLEND_DARK : SAFE_BLEND_LIGHT, rng),
        color: randomColor(rng),
        // Cap opacity low: high-opacity blend + screen/multiply dramatically reduces
        // effective contrast even when dot colors pass the normalizer.
        opacity: 0.10 + rng() * 0.20,
      });
    }
    if (rng() < tc.fxNoise && out.length < tc.fxMax) {
      out.push({
        type: "noise",
        target: pick(EFFECT_TARGETS, rng),
        frequency: 0.4 + rng() * 0.6,
        octaves: 3 + Math.floor(rng() * 3),
        opacity: 0.08 + rng() * 0.14,
        seed: Math.floor(rng() * 100),
      });
    }
    if (rng() < tc.fxDuotone && out.length < tc.fxMax) {
      // Duotone: pick a saturated hue; map dark→dark-hue, light→light-hue.
      // The contrast between them is always high because we use extreme lightness.
      const h = Math.floor(rng() * 360);
      const colorDark  = isDark ? hslToHex(h, 70, 75) : hslToHex(h, 80, 15);
      const colorLight = isDark ? hslToHex(h, 30, 12) : hslToHex(h, 20, 92);
      out.push({ type: "duotone", target: pick(EFFECT_TARGETS, rng), colorDark, colorLight });
    }
    if (rng() < tc.fxEmboss && out.length < tc.fxMax) {
      const DIRS = ["ne", "se", "sw", "nw"] as const;
      out.push({
        type: "emboss",
        target: pick(EFFECT_TARGETS, rng),
        direction: pick(DIRS, rng),
        strength: 0.35 + rng() * 0.45,
        surfaceScale: 3 + rng() * 3,
      });
    }
    if (rng() < tc.fxColorSplit && out.length < tc.fxMax) {
      out.push({
        type: "color-split",
        target: pick(EFFECT_TARGETS, rng),
        offset: 0.20 + rng() * 0.30,
        direction: rng() < 0.5 ? "horizontal" : "vertical",
      });
    }
    return out;
  }

  function randomAnimations(rng: () => number): QrAnimation[] {
    const out: QrAnimation[] = [];
    const [durMin, durMax] = tc.anDurRange;
    const dur = () => +(durMin + rng() * (durMax - durMin)).toFixed(2);
    const delay = () => rng() < 0.4 ? +(rng() * 0.5).toFixed(2) : 0;

    if (rng() < tc.anPulse && out.length < tc.anMax) {
      out.push({ type: "pulse", target: pick(ANIM_TARGETS_PULSE, rng), duration: dur(), delay: delay() });
    }
    if (rng() < tc.anShimmer && out.length < tc.anMax) {
      out.push({
        type: "shimmer",
        color: randomColor(rng),
        opacity: 0.2 + rng() * 0.5,
        duration: dur(),
        delay: delay(),
        direction: rng() < 0.5 ? "ltr" : "ttb",
      });
    }
    if (rng() < tc.anDraw && out.length < tc.anMax) {
      out.push({ type: "draw", direction: pick(DRAW_DIRS, rng), duration: dur(), delay: delay() });
    }
    if (rng() < tc.anGlow && out.length < tc.anMax) {
      out.push({
        type: "glow",
        color: randomColor(rng),
        intensity: 1 + rng() * 3,
        duration: dur(),
        delay: delay(),
      });
    }
    if (rng() < tc.anColorCycle && out.length < tc.anMax) {
      out.push({
        type: "color-cycle",
        target: pick(["dots", "eyes", "all"] as const, rng),
        duration: 3 + rng() * 4,
        delay: delay(),
      });
    }
    if (rng() < tc.anRipple && out.length < tc.anMax) {
      out.push({
        type: "ripple",
        color: randomColor(rng),
        opacity: 0.35 + rng() * 0.35,
        count: 1 + Math.floor(rng() * 2),
        strokeWidth: 0.25 + rng() * 0.4,
        duration: dur(),
        delay: delay(),
      });
    }
    if (rng() < tc.anSpotlight && out.length < tc.anMax) {
      out.push({
        type: "spotlight",
        color: randomColor(rng),
        opacity: 0.20 + rng() * 0.25,
        radius: 30 + rng() * 20,
        duration: dur(),
        delay: delay(),
      });
    }
    if (rng() < tc.anFloat && out.length < tc.anMax) {
      out.push({
        type: "float",
        amplitude: 0.6 + rng() * 1.0,
        direction: rng() < 0.7 ? "vertical" : "horizontal",
        duration: 2.5 + rng() * 2,
        delay: delay(),
      });
    }
    return out;
  }

  return {
    darkC,
    vividC,
    partFill,
    bgFill,
    layerFill,
    maskLayers,
    overlays,
    randomEffects: (rng: () => number, isDark: boolean) => randomEffects(rng, isDark),
    randomAnimations,
    dotShape: (rng: () => number) =>
      rng() < tc.dotIconChance
        ? { type: "icon" as const, path: pick(tc.dotIcons, rng) as string }
        : { type: "figure" as const, path: pick(tc.dotFigures, rng) as string },
    innerEyeShape: (rng: () => number) => ({ type: "icon" as const, path: pick(tc.innerEye, rng) as string }),
    outerEyeShape: (rng: () => number) => ({ type: "icon" as const, path: pick(tc.outerEye, rng) as string }),
  };
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
 * solid color **or** a gradient (~60 % chance, including 3-stop variants) —
 * no separate flag needed.
 *
 * When `backgroundColor` is included in `config`, the generator picks a
 * light or dark theme (~45 % dark). Dark themes pair a deep rich background
 * with vivid bright dots; light themes pair a pastel background with deep
 * saturated dots. All combinations are contrast-aware and scannable.
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
  tuning?: RandomizeTuning,
): Options {
  const rng = mulberry32(seed ?? (Date.now() & 0xffffffff));
  const result: Options = { ...base };
  const tc = resolveT(tuning);
  const gen = makeGen(tc);

  const isDark = !!config.backgroundColor && rng() < tc.darkThemeChance;

  // Resolve deprecated aliases so the rest of the function only checks the canonical names.
  const dotsOv    = config.dotsOverlays       ?? config.dotsPattern        ?? false;
  const dotsDotOv = config.cornersDotOverlays ?? config.cornersDotPattern   ?? false;
  const sqOv      = config.cornersSquareOverlays ?? config.cornersSquarePattern ?? false;

  // combined=true: base fill becomes overlay layer 0, mask layers stack on top.
  // combined=false: full independent overlay set (base + optional mask).
  function buildOverlays(combined: boolean): QrOverlay[] {
    if (combined) {
      const colorFn = isDark ? gen.vividC : gen.darkC;
      return [{ fill: gen.layerFill(colorFn, rng) }, ...gen.maskLayers(isDark, rng)];
    }
    return gen.overlays(isDark, rng);
  }

  // --- dots ---
  if (config.dotsColor || config.dotsShape || dotsOv) {
    result.dotsOptions = { ...base.dotsOptions };
    if (dotsOv) {
      result.dotsOptions.overlays = buildOverlays(!!config.dotsColor);
      result.dotsOptions.color = undefined;
      result.dotsOptions.gradient = undefined;
    } else if (config.dotsColor) {
      Object.assign(result.dotsOptions, gen.partFill(isDark, rng));
      result.dotsOptions.overlays = undefined;
    }
    if (config.dotsShape) {
      result.dotsOptions.shape = gen.dotShape(rng) as QrShape;
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
      Object.assign(result.cornersDotOptions, gen.partFill(isDark, rng));
      result.cornersDotOptions.overlays = undefined;
    }
    if (config.cornersDotShape) {
      result.cornersDotOptions.shape = gen.innerEyeShape(rng) as QrShape;
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
      Object.assign(result.cornersSquareOptions, gen.partFill(isDark, rng));
      result.cornersSquareOptions.overlays = undefined;
    }
    if (config.cornersSquareShape) {
      result.cornersSquareOptions.shape = gen.outerEyeShape(rng) as QrShape;
    }
  }

  // --- background ---
  if (config.backgroundColor) {
    result.backgroundOptions = {
      ...base.backgroundOptions,
      ...gen.bgFill(isDark, rng),
    };
  }

  // --- borderRadius ---
  if (config.borderRadius) {
    result.borderRadius = Math.floor(rng() * 101);
  }

  // --- decorations ---
  if (config.decorations) {
    const layerCount = 1 + Math.floor(rng() * 2);
    result.decorations = Array.from({ length: layerCount }, (_, i) => ({
      shape: pick(DECORATION_SHAPES, rng),
      color: gen.darkC(rng),
      placement: pick(DECORATION_PLACEMENTS, rng),
      size: 0.3 + rng() * 0.5,
      opacity: 0.3 + rng() * 0.6,
      seed: Math.floor(rng() * 0xffff) ^ (i * 0x9e3779b9),
    }));
  }

  // --- effects ---
  if (config.effects) {
    const fx = gen.randomEffects(rng, isDark);
    if (fx.length > 0) result.effects = fx;
  }

  // --- animation ---
  if (config.animation) {
    const anims = gen.randomAnimations(rng);
    if (anims.length > 0) result.animation = anims;
  }

  // --- background guarantee ---
  // Animations and effects need a solid background:
  //   • GIF export corrupts without one (no true alpha in GIF format)
  //   • Visual effects (neon-glow, blend, liquid) look broken on transparent
  // If the user didn't request backgroundColor randomisation but did request
  // effects/animation, silently add a background that fits the theme.
  if (result.effects || result.animation) {
    const hasBg = !!(result.backgroundOptions?.color || result.backgroundOptions?.gradient);
    if (!hasBg) {
      const fill = gen.bgFill(isDark, rng);
      result.backgroundOptions = { ...result.backgroundOptions, ...fill };
      result.backgroundEnable = true;
    }
  }

  return normalizeOptions(result);
}

// ─── normalizeOptions ─────────────────────────────────────────────────────────

function _hexToRgb(color: string): [number, number, number] {
  if (color.startsWith("#") && color.length >= 7) {
    const n = parseInt(color.slice(1, 7), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  }
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
  return [0, 0, 0];
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
    if (base) return base.fill.type === "color" ? _hexLum(base.fill.color) : base.fill.type === "gradient" ? _gradLum(base.fill.gradient) : 1;
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
  if (fill.type === "gradient") return { type: "gradient", gradient: _adjustGradient(fill.gradient, bgLum, minRatio, darker) };
  return fill; // image fills are not adjusted
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
    result.overlays = part.overlays.map((o) => {
      if (!o.mask) {
        return { ...o, fill: _adjustFill(o.fill, bgLum, minRatio, darker) };
      }
      // High-opacity masked layers can fully obscure the base in their pattern area.
      // If their color blends into the background, those dot regions become invisible to scanners.
      const opacity = o.opacity ?? 1;
      if (opacity >= 0.35) {
        const lum = o.fill.type === "color" ? _hexLum(o.fill.color) : o.fill.type === "gradient" ? _gradLum(o.fill.gradient) : 1;
        if (_wcag(lum, bgLum) < minRatio) {
          return { ...o, fill: _adjustFill(o.fill, bgLum, minRatio, darker) };
        }
      }
      return o;
    });
  } else if (part.gradient) {
    result.gradient = _adjustGradient(part.gradient, bgLum, minRatio, darker);
  } else if (part.color !== undefined) {
    result.color = _adjustColor(part.color, bgLum, minRatio, darker);
  }
  return result;
}

function _hasProblematicMaskedLayer(part: QrPartOptions | undefined, bgLum: number, minRatio: number): boolean {
  if (!part?.overlays?.length) return false;
  return part.overlays.some((o) => {
    if (!o.mask) return false;
    const opacity = o.opacity ?? 1;
    if (opacity < 0.35) return false;
    const lum = o.fill.type === "color" ? _hexLum(o.fill.color) : o.fill.type === "gradient" ? _gradLum(o.fill.gradient) : 1;
    return _wcag(lum, bgLum) < minRatio;
  });
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
  // Boost the required base contrast to compensate for SVG effects that reduce
  // perceived contrast after rendering (blend, neon-glow, liquid all attenuate
  // the luminance difference between dark modules and light background/gaps).
  let effectiveMin = minContrast;
  for (const fx of (base.effects as any[] | undefined) ?? []) {
    if      (fx.type === "blend")       effectiveMin = Math.max(effectiveMin, minContrast + 2.5);
    else if (fx.type === "neon-glow")   effectiveMin = Math.max(effectiveMin, minContrast + 2.0);
    else if (fx.type === "liquid")      effectiveMin = Math.max(effectiveMin, minContrast + 1.5);
    else if (fx.type === "morphology")  effectiveMin = Math.max(effectiveMin, minContrast + 1.0);
    else if (fx.type === "drop-shadow") effectiveMin = Math.max(effectiveMin, minContrast + 0.5);
    // New effects — all are luminance-safe but require extra headroom for safety
    else if (fx.type === "noise")       effectiveMin = Math.max(effectiveMin, minContrast + 0.5);
    else if (fx.type === "emboss")      effectiveMin = Math.max(effectiveMin, minContrast + 0.5);
    // duotone replaces all colors — normalizer can't help, contrast is set by the duotone colors themselves
    // color-split, noise: no effective contrast reduction on pure-black dots
  }
  const minContrast_ = effectiveMin;

  const bgLum = _bgLum(base);
  const dotsLum = _partLum(base.dotsOptions) ?? 0;
  const csLum   = _partLum(base.cornersSquareOptions);
  const cdLum   = _partLum(base.cornersDotOptions);
  const darkenDots = dotsLum <= bgLum;

  const ok = (lum: number | null) =>
    lum === null || _wcag(lum, bgLum) >= minContrast_;

  if (
    ok(dotsLum) && ok(csLum) && ok(cdLum) &&
    !_hasProblematicMaskedLayer(base.dotsOptions, bgLum, minContrast_) &&
    !_hasProblematicMaskedLayer(base.cornersSquareOptions, bgLum, minContrast_) &&
    !_hasProblematicMaskedLayer(base.cornersDotOptions, bgLum, minContrast_)
  ) return base;

  return {
    ...base,
    dotsOptions: _adjustPart(base.dotsOptions, bgLum, minContrast_, darkenDots),
    cornersSquareOptions: _adjustPart(base.cornersSquareOptions, bgLum, minContrast_, darkenDots),
    cornersDotOptions: _adjustPart(base.cornersDotOptions, bgLum, minContrast_, darkenDots),
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
  if (fill.type === "gradient") return { type: "gradient", gradient: invertGradient(fill.gradient) };
  return fill; // image fills are not inverted
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
