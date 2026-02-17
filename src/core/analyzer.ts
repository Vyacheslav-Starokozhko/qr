// src/core/analyzer.ts

// Import classes from our new file (not from node_modules!)
import { QrCode, QrSegment } from "./qr/qrcodegen";
import { QRMatrix, ModuleType } from "../types";

export class QRAnalyzer {
  private qr: QrCode;

  constructor(text: string, eccLevel: "L" | "M" | "Q" | "H" = "H") {
    // 1. Map your letters to Nayuki library Enum
    const eccMap = {
      L: QrCode.Ecc.LOW,
      M: QrCode.Ecc.MEDIUM,
      Q: QrCode.Ecc.QUARTILE,
      H: QrCode.Ecc.HIGH,
    };

    // 2. Generate QR code (this is a static method, unlike the old library)
    // encodeText automatically chooses the best mask and version
    this.qr = QrCode.encodeText(text, eccMap[eccLevel]);
  }

  public getMatrix(): QRMatrix {
    const size = this.qr.size; // In the new library it's 'size', not getModuleCount()
    const matrix: QRMatrix = [];

    for (let y = 0; y < size; y++) {
      const row: any[] = [];
      for (let x = 0; x < size; x++) {
        // 3. Get module color
        // getModule returns true (black) or false (white)
        const isDark = this.qr.getModule(x, y);

        // 4. Determine type (Eyes, Data, etc.)
        // Unfortunately, Nayuki doesn't provide a ready method like "isFinderPattern",
        // so we use our old coordinate logic.
        const type = this.identifyType(x, y, size);

        row.push({ x, y, isDark, type });
      }
      matrix.push(row);
    }
    return matrix;
  }

  private identifyType(x: number, y: number, size: number): ModuleType {
    // Logic remains the same as we wrote before

    // Top left (Finder Pattern)
    if (x < 7 && y < 7) return "pos-finder";
    // Top right
    if (x > size - 8 && y < 7) return "pos-finder";
    // Bottom left
    if (x < 7 && y > size - 8) return "pos-finder";

    // (Optional) Could add Alignment Patterns, but for MVP this is enough:
    return "data";
  }
}
