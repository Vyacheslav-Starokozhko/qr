declare module "gifenc" {
  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array | Uint8ClampedArray,
      width: number,
      height: number,
      opts?: {
        palette?: number[][];
        delay?: number;
        repeat?: number;
        transparent?: boolean;
        transparentIndex?: number;
        colorDepth?: number;
        dispose?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
  };

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: { format?: string; oneBitAlpha?: boolean },
  ): number[][];

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: string,
  ): Uint8Array;

  export function nearestColorIndex(palette: number[][], r: number, g: number, b: number, a?: number): number;
  export function nearestColor(palette: number[][], r: number, g: number, b: number, a?: number): number[];
  export function snapColorsToPalette(rgba: Uint8Array | Uint8ClampedArray, palette: number[][]): void;
}
