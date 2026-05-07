declare module "gif-encoder-2" {
  class GifEncoder {
    out: { getData(): Uint8Array };
    constructor(width: number, height: number, algorithm?: string, useOptimizer?: boolean);
    setDelay(ms: number): void;
    setRepeat(times: number): void;
    setQuality(quality: number): void;
    start(): void;
    addFrame(imageData: Buffer | Uint8Array | Uint8ClampedArray): void;
    finish(): void;
  }
  export = GifEncoder;
}
