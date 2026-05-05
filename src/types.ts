import { shapes } from "./renderer/icons";

export type ModuleType =
  | "data"
  | "pos-finder"
  | "pos-separator"
  | "alignment"
  | "timing"
  | "dark-module"
  | "version";

export type QRCell = {
  x: number;
  y: number;
  isDark: boolean;
  type: ModuleType;
};

export type QRMatrix = QRCell[][];

export type TypeNumber = number;

// Allowed shapes + custom-icon support
export type QRShapesType = keyof typeof shapes | "custom-icon";

// QR Generation specific types (mapped to Nayuki's library later)
export type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";
export type Mode = "Numeric" | "Alphanumeric" | "Byte" | "Kanji";
export type Gradient = {
  type: "linear" | "radial";
  rotation?: number; // in degrees, for linear
  colorStops: {
    offset: string; // "0%", "100%"
    color: string;
  }[];
};

// Named auto-positions place the image in a predefined zone of the QR matrix.
// "extra-*" positions the image at the QR border in the strip between the
// finder-pattern (eye) zones. "custom" requires explicit x/y coordinates.
export type QrImagePosition =
  | {
      type?:
        | "center"
        | "top"
        | "right"
        | "bottom"
        | "left"
        | "extra-top"
        | "extra-bottom"
        | "extra-left"
        | "extra-right";
    }
  | { type: "custom"; x: number; y: number };

// Logo/Image configuration
export type QrImage = {
  source: string; // url or base64
  width: number; // size in modules (e.g., 0.5 or 1 or 5)
  height: number;
  position?: QrImagePosition; // defaults to { type: "center" }
  excludeDots?: boolean; // If true, we won't draw QR dots under this image
  margin?: number; // Outer margin in modules — expands the dot-clearing zone around the image
  opacity?: number; // 0.0 – 1.0 (default 1)
  preserveAspectRatio?: string; // SVG preserveAspectRatio attr (default "xMidYMid meet")
  name?: string; // Optional name for the image
};

export type ShapeType = "custom-icon" | "icon" | "figure";

export type FigureShape =
  | "square"
  | "dot"
  | "dots"
  | "extra-rounded"
  | "rounded"
  | "classy"
  | "classy-rounded";

export type DotFigure =
  | "square"
  | "dots"
  | "extra-rounded"
  | "rounded"
  | "classy"
  | "classy-rounded";

export type CornerSquareFigure =
  | "square"
  | "dot"
  | "dots"
  | "extra-rounded"
  | "rounded"
  | "classy"
  | "classy-rounded";

export type CornerDotFigure =
  | "square"
  | "dot"
  | "dots"
  | "extra-rounded"
  | "rounded"
  | "classy"
  | "classy-rounded";

export type QrShape = {
  type?: ShapeType;
  path?: QRShapesType | FigureShape;
  viewBox?: string;
};

/** Solid color or gradient fill for one overlay layer */
export type QrLayerFill =
  | { type: "color"; color: string }
  | { type: "gradient"; gradient: Gradient };

/** Geometric mask that shapes which areas of a layer's fill are visible */
export type QrOverlayMask =
  | { type: "stripe";  scale?: number; angle?: number }
  | { type: "zigzag";  scale?: number }
  | { type: "wave";    scale?: number }
  | { type: "checker"; scale?: number }
  | {
      type: "custom";
      /** SVG path data for one repeating tile */
      path: string;
      /** Tile width in module units (default: 10) */
      tileWidth?: number;
      /** Tile height in module units (default: 10) */
      tileHeight?: number;
    };

/**
 * A single fill layer rendered through a geometric mask on QR dots or eyes.
 * Stack multiple layers in `overlays[]` for compound visual effects —
 * index 0 = bottom, last index = top.
 */
export type QrOverlay = {
  /** Color or gradient fill for this layer */
  fill: QrLayerFill;
  /**
   * Geometric mask — determines which parts of the fill are visible.
   * Omit for full-coverage fill (base layer).
   */
  mask?: QrOverlayMask;
  /** 0–1, default 1 */
  opacity?: number;
};

export type QrPartOptions = {
  shape?: QrShape;
  color?: string;
  gradient?: Gradient;
  /**
   * Stacked fill layers, each with its own color/gradient and optional geometric mask.
   * Takes priority over `gradient` and `color` when set.
   * Index 0 = bottom layer, last = top.
   */
  overlays?: QrOverlay[];
  scale?: number; // 0.1 ... 1.0 (Density)
  isSingle?: boolean; // Only for innerEye/cornersDot: draw one large element instead of 3×3
};

export type QrPart =
  | "dotsOptions"
  | "cornersDotOptions"
  | "cornersSquareOptions";

export type QrLabelPosition = "top" | "bottom" | "center" | "custom" | "auto";

export type QrLabel = {
  text?: string;
  /**
   * Visual style of the label.
   * - `"default"` (or omitted) — flat text on a rectangular background band
   *   (current behaviour).
   * - `"rounded"` — text curves along the circular arc of the QR background
   *   zone.  Uses SVG `<textPath>` so the glyphs follow the circle edge:
   *   concave-down at the top, concave-up at the bottom.  Works best with
   *   `borderRadius` near 100 (circular QR).  `fontBackgroundColor` /
   *   `fontBackgroundGradient` render as a thick stroked arc behind the text.
   */
  style?: "default" | "rounded";
  fontSize?: number; // px in frame coordinates; auto-computed from zone height when omitted
  fontWeight?: number;
  fontStyle?: string;
  fontFamily?: string;
  fontColor?: string;
  fontGradient?: Gradient;
  fontBackgroundColor?: string;
  fontBackgroundGradient?: Gradient;
  position?: QrLabelPosition;
  /**
   * Gap (in frame px) between the label and the adjacent QR edge.
   * - top/bottom: space between text rect and the nearest QR border
   * - center: inner padding from the inset edges
   * - auto: same as top/bottom, applied to the winning strip
   * Defaults to 8.
   */
  margin?: number;
  /** Explicit text width (frame px). When omitted the label fills the zone width. */
  width?: number;
  /** Center X for "custom" position (frame px). Defaults to frame horizontal center. */
  x?: number;
  /** Center Y for "custom" position (frame px). Defaults to below QR + margin. */
  y?: number;
};

// Frame: decorative image that wraps the QR code
export type QrFrame = {
  source: string; // URL or base64 of the frame image
  width: number; // Total frame width in output pixels
  height: number; // Total frame height in output pixels
  // Where the QR sits inside the frame (in output pixels).
  // If omitted entirely, QR is centered with 10% margin on each side.
  // If only width/height are given (no x/y), QR is auto-centered.
  inset?: {
    x?: number; // Left edge of QR area (auto-centered if omitted)
    y?: number; // Top edge of QR area (auto-centered if omitted)
    width: number; // Width of QR area inside frame
    height: number; // Height of QR area inside frame
  };
  /** Single label (kept for backward compatibility). */
  label?: QrLabel;
  /**
   * Multiple labels rendered in order.
   * Use this to add both a top and a bottom arc label on a circular frame:
   * ```
   * labels: [
   *   { text: "SEE WHY IT'S SUPER", style: "rounded" },          // top arc
   *   { text: "SCAN ME", style: "rounded", position: "bottom" },  // bottom arc
   * ]
   * ```
   * When both `label` and `labels` are provided, `label` is rendered first.
   */
  labels?: QrLabel[];
};

/**
 * Fine-grained tuning for {@link validateQR} and {@link QRGenerateResult.validate}.
 * Every field is optional — omitted values fall back to the built-in defaults.
 */
export type ValidatorTuning = {
  /** Minimum WCAG contrast ratio between mean dark and light module luminance.
   *  Default 2.0. QR scanners reliably read at 2:1; raise for stricter checking. */
  minContrast?: number;
  /** Maximum fraction (0–1) of finder-pattern modules allowed to render as the
   *  wrong color before flagging. Default 0.25. Custom eye shapes (circle, star,
   *  heart) leave corner/edge modules as background — 0.25 accepts all standard
   *  decorative shapes while still catching truly broken patterns. */
  finderDegradedThreshold?: number;
  /** Inner sampling inset as fraction of module width/height (0–0.49).
   *  Larger values sample only the center, reducing anti-aliasing noise.
   *  Default 0.2 (middle 60 % of each module). */
  samplePad?: number;
  /** Deadband around the adaptive threshold as fraction of the full luminance
   *  range. Modules within this zone are treated as correct, preventing false
   *  positives from partially-filled custom shapes. Default 0.2. */
  deadbandFraction?: number;
};

/**
 * Result of pixel-based QR validation via {@link QRGenerateResult.validate}.
 * Validates by sampling the rendered canvas against the known source matrix —
 * works correctly with all dot shapes, gradients, and inverted color schemes.
 */
export type QRValidateResult = {
  /** true when all structural zones are intact and contrast is sufficient */
  valid: boolean;
  /** WCAG relative contrast ratio between mean dark and mean light module luminance */
  contrastRatio: number;
  /** Total number of modules that rendered with the wrong luminance */
  degradedModules: number;
  /** Total modules sampled (finder + timing + data) */
  totalModules: number;
  /** Whether all 3 finder patterns (eyes) are fully intact */
  finderPatternsOk: boolean;
  /** Whether timing patterns (row 6 / col 6) are fully intact */
  timingPatternsOk: boolean;
  /**
   * Remaining ECC capacity as a fraction 0–1.
   * 1 = no degraded data modules; 0 = ECC tolerance exhausted.
   */
  eccHeadroom: number;
  /** Human-readable list of detected issues; empty when valid */
  issues: string[];
};

// Built-in geometric decoration shapes
export type QrDecorationBuiltinShape =
  | "dot"
  | "ring"
  | "square"
  | "diamond"
  | "star"
  | "star4"
  | "cross"
  | "triangle";

/**
 * Shape of a decoration element.
 *
 * - String shortcuts: "dot" | "ring" | "square" | "diamond" | "star" | "star4" | "cross" | "triangle"
 * - `{ type: "icon"; path }` — one of the built-in icon shapes (same keys used for QR dots)
 * - `{ type: "custom-path"; d; viewBox? }` — your own SVG path data
 * - `{ type: "image"; source }` — any image URL or base64 data-URI (PNG, SVG, …)
 */
export type QrDecorationShape =
  | QrDecorationBuiltinShape
  | { type: "icon"; path: QRShapesType }
  | { type: "custom-path"; path: string; viewBox?: string }
  | { type: "image"; source: string };

// Where decorations are placed within the margin zone
export type QrDecorationPlacement =
  | "scatter" // random spread across all margin areas (default)
  | "corners" // only the 4 corner regions
  | "top" // top margin band only
  | "bottom" // bottom margin band only
  | "left" // left margin band only
  | "right" // right margin band only
  | "edges"; // all 4 edge bands

/**
 * A single decoration layer rendered in the empty margin space around the QR
 * matrix (but still clipped to the QR background zone).
 * Stack multiple layers for richer effects.
 */
export type QrDecoration = {
  shape?: QrDecorationShape; // default "dot"
  color?: string; // fill color / stroke color (default "#000000")
  gradient?: Gradient; // gradient fill (overrides color when set)
  size?: number; // size in modules (default 0.6)
  count?: number; // number of elements to place (default: auto-computed)
  seed?: number; // PRNG seed for reproducible random placement (default 42)
  opacity?: number; // 0–1 (default 1)
  placement?: QrDecorationPlacement; // default "scatter"
};

/**
 * Built-in shapes for the QR wrapper (clip mask applied to the whole QR).
 * - "circle"   – inscribed circle (same as borderRadius: 100)
 * - "square"   – plain square (no clip, useful with stroke only)
 * - "triangle" – upward equilateral triangle
 * - "diamond"  – square rotated 45°
 * - "pentagon" – regular 5-sided polygon
 * - "hexagon"  – regular 6-sided polygon (flat-top)
 * - "octagon"  – regular 8-sided polygon
 * - "star"     – 5-pointed star
 * - "star4"    – 4-pointed star
 */
export type QrWrapperShape =
  | "circle"
  | "square"
  | "triangle"
  | "diamond"
  | "pentagon"
  | "hexagon"
  | "octagon"
  | "star"
  | "star4";

/**
 * Clips the entire QR (background + dots) to a geometric shape and renders a
 * filled border ring as a proper design element outside the clipped area.
 *
 * The ring is a filled donut between the clip boundary and the outer shape
 * edge — not a simple SVG stroke. This means it can carry its own solid color
 * or gradient independent of the QR content.
 *
 * @example Circle with green gradient ring (like the reference image)
 * ```ts
 * wrapper: {
 *   shape: "circle",
 *   strokeWidth: 40,
 *   strokeGradient: {
 *     type: "linear",
 *     rotation: 135,
 *     colorStops: [{ offset: "0%", color: "#166534" }, { offset: "100%", color: "#4ade80" }],
 *   },
 * }
 * ```
 *
 * @example Hexagon with solid border
 * ```ts
 * wrapper: { shape: "hexagon", stroke: "#0ea5e9", strokeWidth: 20 }
 * ```
 *
 * @example Custom SVG path (normalized to 0 0 100 100 space)
 * ```ts
 * wrapper: { path: "M50 0 L100 100 L0 100 Z", viewBox: "0 0 100 100", stroke: "#000", strokeWidth: 10 }
 * ```
 */
export type QrWrapper = {
  /** Predefined shape. Ignored when `path` is provided. Default: "circle". */
  shape?: QrWrapperShape;
  /**
   * Custom SVG path data used instead of a predefined shape.
   * The path should fill the coordinate space defined by `viewBox`.
   */
  path?: string;
  /** SVG viewBox for the custom path (e.g. "0 0 100 100"). Default: "0 0 1 1". */
  viewBox?: string;
  /**
   * Solid fill color for the border ring.
   * Ignored when `strokeGradient` is set.
   */
  stroke?: string;
  /**
   * Gradient fill for the border ring. Takes priority over `stroke`.
   */
  strokeGradient?: Gradient;
  /**
   * Ring thickness in SVG output units (same unit as `width`/`height`).
   * The QR content is clipped to a shape inset by this amount, and the ring
   * fills the gap between the inset clip and the outer shape edge.
   * Default: 0 (no ring).
   */
  strokeWidth?: number;
  /**
   * When `true` (default), the margin area around the QR matrix is filled with
   * decorative dots that share the same shape, color and gradient as `dotsOptions`.
   * This creates an integrated design element — the shape is not just a clip/frame
   * on top of the QR code, but a fully filled pattern.
   * Set to `false` to use the wrapper as a plain clip with no margin fill.
   */
  fillMargin?: boolean;
};

// The Main Config
export type Options = {
  data?: string;
  width?: number; // Output width in pixels (e.g. 1000)
  height?: number; // Output height in pixels
  margin?: number; // Padding in modules (default 4)
  borderRadius?: number; // Corner radius as a percentage (0–100). 100 = fully rounded (circle). Scale-independent.

  backgroundEnable?: boolean; // If false, background is transparent; if true, backgroundOptions is used

  imageEnable?: boolean; // If false, images[] are not rendered (and dots are not excluded)

  backgroundOptions?: {
    color?: string;
    gradient?: Gradient;
    image?: string; // URL for background image
  };

  images?: QrImage[]; // Logos (Array)
  decorations?: QrDecoration[]; // Decorative shapes in the empty margin space around the QR
  frame?: QrFrame; // Decorative frame around the QR code
  /**
   * Clips the QR output to a geometric shape (circle, triangle, hexagon, …)
   * and optionally draws a stroke border around it.
   * When set, `borderRadius` is ignored for clipping purposes.
   */
  wrapper?: QrWrapper;

  qrOptions?: {
    typeNumber?: TypeNumber;
    mode?: Mode;
    errorCorrectionLevel?: ErrorCorrectionLevel;
  };

  // Granular styling
  dotsOptions?: QrPartOptions; // The main data
  cornersDotOptions?: QrPartOptions; // Inner Eye (Ball)
  cornersSquareOptions?: QrPartOptions; // Outer Eye (Frame)
};

export enum EShapeType {
  ICON = "icon",
  FIGURE = "figure",
  CUSTOM_ICON = "custom-icon",
}

export enum EQrPart {
  DOTS = "dotsOptions",
  CORNERS_DOT = "cornersDotOptions",
  CORNERS_SQUARE = "cornersSquareOptions",
}

export enum EFigureShape {
  SQUARE = "square",
  DOT = "dot",
  DOTS = "dots",
  EXTRA_ROUNDED = "extra-rounded",
  ROUNDED = "rounded",
  CLASSY = "classy",
  CLASSY_ROUNDED = "classy-rounded",
}

export enum EDotFigure {
  SQUARE = "square",
  DOTS = "dots",
  EXTRA_ROUNDED = "extra-rounded",
  ROUNDED = "rounded",
  CLASSY = "classy",
  CLASSY_ROUNDED = "classy-rounded",
}

export enum ECornerSquareFigure {
  SQUARE = "square",
  DOT = "dot",
  DOTS = "dots",
  EXTRA_ROUNDED = "extra-rounded",
  ROUNDED = "rounded",
  CLASSY = "classy",
  CLASSY_ROUNDED = "classy-rounded",
}

export enum ECornerDotFigure {
  SQUARE = "square",
  DOT = "dot",
  DOTS = "dots",
  EXTRA_ROUNDED = "extra-rounded",
  ROUNDED = "rounded",
  CLASSY = "classy",
  CLASSY_ROUNDED = "classy-rounded",
}

export enum EQrImagePosition {
  CENTER = "center",
  TOP = "top",
  RIGHT = "right",
  BOTTOM = "bottom",
  LEFT = "left",
  EXTRA_TOP = "extra-top",
  EXTRA_BOTTOM = "extra-bottom",
  EXTRA_LEFT = "extra-left",
  EXTRA_RIGHT = "extra-right",
  CUSTOM = "custom",
}

export enum EQrLabelPosition {
  TOP = "top",
  BOTTOM = "bottom",
  CENTER = "center",
  CUSTOM = "custom",
  AUTO = "auto",
}
