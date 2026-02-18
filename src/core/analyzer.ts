import { QrCode, QrSegment } from "./qr/qrcodegen";
import { QRMatrix, ModuleType } from "../types";

export class QRAnalyzer {
  private qr: QrCode;

  constructor(
    text: string,
    ecc: "L" | "M" | "Q" | "H" = "H",
    minVersion: number = 1,
    maxVersion: number = 40,
    mask: number = -1,
  ) {
    const eccMap = {
      L: QrCode.Ecc.LOW,
      M: QrCode.Ecc.MEDIUM,
      Q: QrCode.Ecc.QUARTILE,
      H: QrCode.Ecc.HIGH,
    };

    // encodeSegments allows more control than encodeText
    const segs = QrSegment.makeSegments(text);
    this.qr = QrCode.encodeSegments(
      segs,
      eccMap[ecc],
      minVersion,
      maxVersion,
      mask,
      true,
    );
  }

  public getMatrix(): QRMatrix {
    const size = this.qr.size;
    const matrix: QRMatrix = [];

    for (let y = 0; y < size; y++) {
      const row: any[] = [];
      for (let x = 0; x < size; x++) {
        const isDark = this.qr.getModule(x, y);
        const type = this.identifyType(x, y, size);
        row.push({ x, y, isDark, type });
      }
      matrix.push(row);
    }
    return matrix;
  }

  private identifyType(x: number, y: number, size: number): ModuleType {
    if (x < 7 && y < 7) return "pos-finder";
    if (x > size - 8 && y < 7) return "pos-finder";
    if (x < 7 && y > size - 8) return "pos-finder";
    return "data";
  }
}
