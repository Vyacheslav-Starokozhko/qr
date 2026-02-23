import { QRShapes, shapes } from "./renderer/icons";

export type QRErrorCorrectionLevel = "L" | "M" | "Q" | "H";

export type ModuleType =
  | "data"
  | "pos-finder"
  | "pos-separator"
  | "alignment"
  | "timing"
  | "dark-module"
  | "version";

export interface QRCell {
  x: number;
  y: number;
  isDark: boolean;
  type: ModuleType;
}

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
  | "classy"
  | "rounded"
  | "classy-rounded";

export type QrShape = {
  type?: ShapeType;
  path?: QRShapesType | FigureShape; // icon key or figure name
  viewBox?: string; // auto-detected for icon shapes
  customPath?: string; // only for "custom-icon"
  customViewBox?: string; // only for "custom-icon"
};

export type QrPartOptions = {
  shape?: QrShape;
  color?: string;
  gradient?: Gradient;
  scale?: number; // 0.1 ... 1.0 (Density)
  isSingle?: boolean; // Only for innerEye/cornersDot: draw one large element instead of 3×3
};

export type QrPart =
  | "dotsOptions"
  | "cornersDotOptions"
  | "cornersSquareOptions";

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
};

// QR Scan result returned by the scan() method on QRGenerateResult
export interface QRScanState {
  /** Whether the scan operation is still in progress */
  inProgress: boolean;
  /** true when a QR code was successfully decoded */
  result: boolean;
  /** Non-empty string when an error occurred */
  error: string;
  /** The decoded QR data string, or null if scan failed */
  data: string | null;
}

// The Main Config
export interface Options {
  data?: string;
  width?: number; // Output width in pixels (e.g. 1000)
  height?: number; // Output height in pixels
  margin?: number; // Padding in modules (default 4)
  borderRadius?: number; // Corner radius as a percentage (0–100). 100 = fully rounded (circle). Scale-independent.

  backgroundOptions?: {
    color?: string;
    gradient?: Gradient;
    image?: string; // URL for background image
  };

  images?: QrImage[]; // Logos (Array)
  frame?: QrFrame; // Decorative frame around the QR code

  qrOptions?: {
    typeNumber?: TypeNumber;
    mode?: Mode;
    errorCorrectionLevel?: ErrorCorrectionLevel;
  };

  // Granular styling
  dotsOptions?: QrPartOptions; // The main data
  cornersDotOptions?: QrPartOptions; // Inner Eye (Ball)
  cornersSquareOptions?: QrPartOptions; // Outer Eye (Frame)
}
