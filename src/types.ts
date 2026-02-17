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

export type AvailableShape = keyof typeof shapes;
