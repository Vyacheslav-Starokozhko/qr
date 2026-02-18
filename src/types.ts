import { shapes } from "./renderer/shapes";

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

export type AvailableShape = keyof typeof shapes | "custom-icon";

export type TypeNumber = number;

// Allowed shapes + custom-icon support
export type QRLayoutShape = AvailableShape | "custom-icon";

// QR Generation specific types (mapped to Nayuki's library later)
export type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";
export type Mode = "Numeric" | "Alphanumeric" | "Byte" | "Kanji";
export type Gradient = {
  type: "linear" | "radial";
  rotation?: number; // у градусах, для linear
  colorStops: {
    offset: string; // "0%", "100%"
    color: string;
  }[];
};
// Logo/Image configuration
export type QrImage = {
  source: string; // url or base64
  width: number; // size in modules (e.g., 0.5 or 1 or 5)
  height: number;
  x?: number; // Position in modules. If omitted, calculated automatically (center)
  y?: number;
  excludeDots?: boolean; // If true, we won't draw QR dots under this image
};

export type QrPart = {
  shape: QRLayoutShape;
  color: string;
  gradient?: Gradient;
  customIconPath?: string;
  customIconViewBox?: string;
  scale?: number; // 0.1 ... 1.0 (Density)
  isSingle?: boolean; // Тільки для innerEye/cornersDot: малювати один великий елемент замість 3х3
};

// The Main Config
export interface NewQRConfig {
  data: string;
  width?: number; // Output width in pixels (e.g. 1000)
  height?: number; // Output height in pixels
  padding?: number; // Padding in modules (default 4)
  borderRadius?: number; // Corner radius in pixels for the entire QR code

  background?: {
    color: string;
    gradient?: Gradient;
    image?: string; // URL for background image
  };

  images?: QrImage[]; // Logos (Array)

  qrOptions?: {
    typeNumber?: TypeNumber;
    mode?: Mode;
    errorCorrectionLevel?: ErrorCorrectionLevel;
  };

  // Granular styling
  dotsOptions: QrPart; // The main data
  cornersDotOptions: QrPart; // Inner Eye (Ball)
  cornersSquareOptions: QrPart; // Outer Eye (Frame)
}
