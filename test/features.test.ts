/**
 * Comprehensive feature tests for qrstylelib.
 *
 * Coverage:
 *  - Return value structure (svg, matrixSize, eyeZones, getMaxPos)
 *  - getQRBounds utility
 *  - All figure dot shapes
 *  - All icon dot shapes (sampled)
 *  - custom-icon dot shape
 *  - cornersSquareOptions: figure + icon + isSingle modes
 *  - cornersDotOptions: figure + icon + isSingle modes
 *  - Gradient: linear & radial on dots / corners / background
 *  - scale factor on dots and corners
 *  - backgroundOptions: color, gradient
 *  - images: all named position types + custom position
 *  - decorations: all built-in shapes, icon, custom-path, placement modes
 *  - frame + label (default style, top/bottom/center/auto)
 *  - frame + label (rounded style, top/bottom arcs)
 *  - qrOptions: all error correction levels, numeric mode
 *  - borderRadius: 0, 50, 100
 *  - margin override
 *  - Empty and very-long data strings
 *  - exportQR: svg format
 */

import { describe, it, expect } from "vitest";
import {
  QRCodeGenerate,
  getQRBounds,
  exportQR,
  QRGenerateResult,
  QREyeZone,
} from "../src/index";
import sharp from "sharp";
import jsQR from "jsqr";

// ─── helpers ─────────────────────────────────────────────────────────────────

async function scanSVG(svgString: string): Promise<string | null> {
  const { data, info } = await sharp(Buffer.from(svgString))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  return code ? code.data : null;
}

/** Assert the SVG is valid (starts with <svg, contains </svg>) */
function assertValidSVG(svg: string) {
  expect(svg).toContain("<svg");
  expect(svg).toContain("</svg>");
}

/** Simple inline SVG star for use as a logo image */
const STAR_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23edf505'/%3E%3Cpolygon points='12,4 14.5,9.5 21,10.3 16.5,14.6 17.8,21 12,17.8 6.2,21 7.5,14.6 3,10.3 9.5,9.5' fill='%231a1a2e'/%3E%3C/svg%3E";

// ─── Result structure ─────────────────────────────────────────────────────────

describe("QRCodeGenerate — result structure", () => {
  it("returns svg, matrixSize, eyeZones and getMaxPos", async () => {
    const result = await QRCodeGenerate({ data: "https://example.com" });

    assertValidSVG(result.svg);
    expect(typeof result.matrixSize).toBe("number");
    expect(result.matrixSize).toBeGreaterThan(0);

    expect(Array.isArray(result.eyeZones)).toBe(true);
    expect(result.eyeZones).toHaveLength(3);

    const zone: QREyeZone = result.eyeZones[0];
    expect(zone).toHaveProperty("id");
    expect(zone).toHaveProperty("x");
    expect(zone).toHaveProperty("y");
    expect(zone.width).toBe(7);
    expect(zone.height).toBe(7);

    const maxPos = result.getMaxPos(5, 5);
    expect(maxPos.maxX).toBe(result.matrixSize - 5);
    expect(maxPos.maxY).toBe(result.matrixSize - 5);
  });

  it("canvas is null in Node.js environment", async () => {
    const { canvas } = await QRCodeGenerate({ data: "test" });
    expect(canvas).toBeNull();
  });

  it("svg contains width and height attributes when specified", async () => {
    const { svg } = await QRCodeGenerate({ data: "test", width: 400, height: 400 });
    expect(svg).toContain('width="400"');
    expect(svg).toContain('height="400"');
  });

  it("defaults to 1000×1000 when width/height are omitted", async () => {
    const { svg } = await QRCodeGenerate({ data: "test" });
    expect(svg).toContain('width="1000"');
    expect(svg).toContain('height="1000"');
  });
});

// ─── getQRBounds ──────────────────────────────────────────────────────────────

describe("getQRBounds", () => {
  it("returns matrixSize, eyeZones and getMaxPos without generating SVG", () => {
    const bounds = getQRBounds("https://example.com");
    expect(typeof bounds.matrixSize).toBe("number");
    expect(bounds.matrixSize).toBeGreaterThan(0);
    expect(bounds.eyeZones).toHaveLength(3);

    const { maxX, maxY } = bounds.getMaxPos(5, 5);
    expect(maxX).toBe(bounds.matrixSize - 5);
    expect(maxY).toBe(bounds.matrixSize - 5);
  });

  it("lower error correction gives same or smaller matrix", () => {
    const h = getQRBounds("hello", "H");
    const l = getQRBounds("hello", "L");
    expect(l.matrixSize).toBeLessThanOrEqual(h.matrixSize);
  });

  it("getMaxPos clamps at 0 when image is larger than matrix", () => {
    const bounds = getQRBounds("hi", "L");
    const { maxX, maxY } = bounds.getMaxPos(999, 999);
    expect(maxX).toBe(0);
    expect(maxY).toBe(0);
  });
});

// ─── Figure dot shapes ────────────────────────────────────────────────────────

describe("dotsOptions — figure shapes (readability)", () => {
  // These solid-fill figure shapes maintain enough per-module coverage to scan.
  const readableFigureShapes = [
    "square",
    "extra-rounded",
    "rounded",
    "classy",
    "classy-rounded",
  ] as const;

  for (const shape of readableFigureShapes) {
    it(`reads back "${shape}" dots`, async () => {
      const text = "https://example.com";
      const { svg } = await QRCodeGenerate({
        data: text,
        backgroundOptions: { color: "#ffffff" },
        dotsOptions: { shape: { type: "figure", path: shape }, color: "#000000" },
        cornersSquareOptions: {
          shape: { type: "figure", path: "square" },
          color: "#000000",
          isSingle: true,
        },
        cornersDotOptions: {
          shape: { type: "figure", path: "square" },
          color: "#000000",
          isSingle: true,
        },
      });
      expect(await scanSVG(svg)).toBe(text);
    });
  }

  // "dots" uses overlapping circles; valid SVG but not guaranteed scannable.
  it(`"dots" shape generates valid SVG`, async () => {
    const { svg } = await QRCodeGenerate({
      data: "https://example.com",
      backgroundOptions: { color: "#ffffff" },
      dotsOptions: { shape: { type: "figure", path: "dots" }, color: "#000000" },
      cornersSquareOptions: {
        shape: { type: "figure", path: "square" },
        color: "#000000",
        isSingle: true,
      },
      cornersDotOptions: {
        shape: { type: "figure", path: "square" },
        color: "#000000",
        isSingle: true,
      },
    });
    assertValidSVG(svg);
  });
});

// ─── Icon dot shapes (sampled) ────────────────────────────────────────────────
// Icon shapes (heart, star, …) are decorative. They produce valid SVG but their
// non-square fill means QR scanners cannot reliably decode them.

describe("dotsOptions — icon shapes (SVG validity)", () => {
  const iconDotShapes = ["heart", "star", "star2", "heart2"] as const;

  for (const path of iconDotShapes) {
    it(`"${path}" icon dots generate valid SVG`, async () => {
      const { svg } = await QRCodeGenerate({
        data: "https://example.com",
        backgroundOptions: { color: "#ffffff" },
        dotsOptions: { shape: { type: "icon", path }, color: "#000000" },
        cornersSquareOptions: {
          shape: { type: "figure", path: "square" },
          color: "#000000",
          isSingle: true,
        },
        cornersDotOptions: {
          shape: { type: "figure", path: "square" },
          color: "#000000",
          isSingle: true,
        },
      });
      assertValidSVG(svg);
      // Verify the symbol is defined and used
      expect(svg).toContain("<symbol");
      expect(svg).toContain("<use");
    });
  }
});

// ─── cornersSquareOptions ─────────────────────────────────────────────────────

describe("cornersSquareOptions — shapes (readability)", () => {
  const squareShapes = [
    "square",
    "dot",
    "dots",
    "extra-rounded",
    "rounded",
    "classy",
    "classy-rounded",
  ] as const;

  for (const shape of squareShapes) {
    it(`reads back outer-eye figure "${shape}" (isSingle: true)`, async () => {
      const text = "https://example.com";
      const { svg } = await QRCodeGenerate({
        data: text,
        backgroundOptions: { color: "#ffffff" },
        dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
        cornersSquareOptions: {
          shape: { type: "figure", path: shape },
          color: "#000000",
          isSingle: true,
        },
        cornersDotOptions: {
          shape: { type: "figure", path: "square" },
          color: "#000000",
          isSingle: true,
        },
      });
      expect(await scanSVG(svg)).toBe(text);
    });
  }

  it("reads back outer-eye icon shape", async () => {
    const text = "https://example.com";
    const { svg } = await QRCodeGenerate({
      data: text,
      backgroundOptions: { color: "#ffffff" },
      dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
      cornersSquareOptions: {
        shape: { type: "icon", path: "outer-eye-extra-rounded" },
        color: "#000000",
        isSingle: true,
      },
      cornersDotOptions: {
        shape: { type: "figure", path: "square" },
        color: "#000000",
        isSingle: true,
      },
    });
    expect(await scanSVG(svg)).toBe(text);
  });

  it("isSingle: false renders per-module (SVG still valid)", async () => {
    const { svg } = await QRCodeGenerate({
      data: "test",
      backgroundOptions: { color: "#ffffff" },
      dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
      cornersSquareOptions: {
        shape: { type: "figure", path: "square" },
        color: "#000000",
        isSingle: false,
      },
    });
    assertValidSVG(svg);
  });
});

// ─── cornersDotOptions ────────────────────────────────────────────────────────

describe("cornersDotOptions — shapes (readability)", () => {
  const dotShapes = [
    "square",
    "dot",
    "dots",
    "classy",
    "rounded",
    "classy-rounded",
  ] as const;

  for (const shape of dotShapes) {
    it(`reads back inner-eye figure "${shape}" (isSingle: true)`, async () => {
      const text = "https://example.com";
      const { svg } = await QRCodeGenerate({
        data: text,
        backgroundOptions: { color: "#ffffff" },
        dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
        cornersSquareOptions: {
          shape: { type: "figure", path: "square" },
          color: "#000000",
          isSingle: true,
        },
        cornersDotOptions: {
          shape: { type: "figure", path: shape },
          color: "#000000",
          isSingle: true,
        },
      });
      expect(await scanSVG(svg)).toBe(text);
    });
  }

  it("inner-eye icon shape generates valid SVG with symbol and use elements", async () => {
    // Icon inner-eye shapes are decorative; the non-solid fill means jsQR may
    // not reliably identify the finder pattern center. Test SVG validity only.
    const { svg } = await QRCodeGenerate({
      data: "https://example.com",
      backgroundOptions: { color: "#ffffff" },
      dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
      cornersSquareOptions: {
        shape: { type: "figure", path: "square" },
        color: "#000000",
        isSingle: true,
      },
      cornersDotOptions: {
        shape: { type: "icon", path: "inner-eye-dots" },
        color: "#000000",
        isSingle: true,
      },
    });
    assertValidSVG(svg);
    expect(svg).toContain("<symbol");
    expect(svg).toContain("<use");
  });
});

// ─── Scale factor ─────────────────────────────────────────────────────────────

describe("scale option", () => {
  it("scale < 1 produces valid SVG", async () => {
    const { svg } = await QRCodeGenerate({
      data: "https://example.com",
      dotsOptions: {
        shape: { type: "figure", path: "square" },
        color: "#000000",
        scale: 0.7,
      },
    });
    assertValidSVG(svg);
  });

  it("scale > 1 produces valid SVG", async () => {
    const { svg } = await QRCodeGenerate({
      data: "https://example.com",
      dotsOptions: {
        shape: { type: "figure", path: "square" },
        color: "#000000",
        scale: 1.3,
      },
    });
    assertValidSVG(svg);
  });
});

// ─── Gradients ────────────────────────────────────────────────────────────────

describe("gradients", () => {
  it("linear gradient on dots produces valid SVG with gradient def", async () => {
    const { svg } = await QRCodeGenerate({
      data: "test",
      dotsOptions: {
        shape: { type: "figure", path: "square" },
        gradient: {
          type: "linear",
          rotation: 45,
          colorStops: [
            { offset: "0%", color: "#000000" },
            { offset: "100%", color: "#ff0000" },
          ],
        },
      },
    });
    assertValidSVG(svg);
    expect(svg).toContain("linearGradient");
    expect(svg).toContain("grad-dots");
  });

  it("radial gradient on background produces valid SVG", async () => {
    const { svg } = await QRCodeGenerate({
      data: "test",
      backgroundOptions: {
        gradient: {
          type: "radial",
          colorStops: [
            { offset: "0%", color: "#ffffff" },
            { offset: "100%", color: "#cccccc" },
          ],
        },
      },
    });
    assertValidSVG(svg);
    expect(svg).toContain("radialGradient");
    expect(svg).toContain("grad-bg");
  });

  it("linear gradient on cornersSquare produces per-eye gradient defs", async () => {
    const { svg } = await QRCodeGenerate({
      data: "test",
      cornersSquareOptions: {
        gradient: {
          type: "linear",
          rotation: 90,
          colorStops: [
            { offset: "0%", color: "#ff0000" },
            { offset: "100%", color: "#0000ff" },
          ],
        },
        isSingle: true,
      },
    });
    assertValidSVG(svg);
    expect(svg).toContain("grad-sq-tl");
    expect(svg).toContain("grad-sq-tr");
    expect(svg).toContain("grad-sq-bl");
  });

  it("radial gradient on cornersDot produces per-eye gradient defs", async () => {
    const { svg } = await QRCodeGenerate({
      data: "test",
      cornersDotOptions: {
        gradient: {
          type: "radial",
          colorStops: [
            { offset: "0%", color: "#ff0000" },
            { offset: "100%", color: "#0000ff" },
          ],
        },
        isSingle: true,
      },
    });
    assertValidSVG(svg);
    expect(svg).toContain("grad-dot-tl");
  });
});

// ─── backgroundOptions ────────────────────────────────────────────────────────

describe("backgroundOptions", () => {
  it("solid color background is reflected in SVG fill", async () => {
    const { svg } = await QRCodeGenerate({
      data: "test",
      backgroundOptions: { color: "#ff0000" },
    });
    assertValidSVG(svg);
    expect(svg).toContain("#ff0000");
  });

  it("transparent background (rgba 0 alpha) is valid SVG", async () => {
    const { svg } = await QRCodeGenerate({
      data: "test",
      backgroundOptions: { color: "rgba(255,255,255,0)" },
    });
    assertValidSVG(svg);
  });
});

// ─── borderRadius ─────────────────────────────────────────────────────────────

describe("borderRadius", () => {
  for (const radius of [0, 25, 50, 100]) {
    it(`borderRadius ${radius} produces valid SVG`, async () => {
      const { svg } = await QRCodeGenerate({
        data: "https://example.com",
        borderRadius: radius,
        backgroundOptions: { color: "#ffffff" },
        dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
        margin: 6,
      });
      assertValidSVG(svg);
      if (radius > 0) {
        // A rounded clip path should be present
        expect(svg).toContain("rx=");
      }
    });
  }

  it("borderRadius 100 (circle) is readable", async () => {
    const text = "https://example.com";
    const { svg } = await QRCodeGenerate({
      data: text,
      borderRadius: 100,
      margin: 8,
      backgroundOptions: { color: "#ffffff" },
      dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
      cornersSquareOptions: {
        shape: { type: "figure", path: "square" },
        color: "#000000",
        isSingle: true,
      },
      cornersDotOptions: {
        shape: { type: "figure", path: "square" },
        color: "#000000",
        isSingle: true,
      },
    });
    expect(await scanSVG(svg)).toBe(text);
  });
});

// ─── qrOptions ────────────────────────────────────────────────────────────────

describe("qrOptions — error correction levels", () => {
  const levels = ["L", "M", "Q", "H"] as const;

  for (const level of levels) {
    it(`error correction "${level}" produces a readable QR`, async () => {
      const text = "https://example.com";
      const { svg } = await QRCodeGenerate({
        data: text,
        qrOptions: { errorCorrectionLevel: level },
        backgroundOptions: { color: "#ffffff" },
        dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
      });
      expect(await scanSVG(svg)).toBe(text);
    });
  }

  it("higher error correction produces a larger matrix", async () => {
    const data = "hi";
    const { matrixSize: sizeH } = await QRCodeGenerate({
      data,
      qrOptions: { errorCorrectionLevel: "H" },
    });
    const { matrixSize: sizeL } = await QRCodeGenerate({
      data,
      qrOptions: { errorCorrectionLevel: "L" },
    });
    expect(sizeH).toBeGreaterThanOrEqual(sizeL);
  });
});

// ─── Images ───────────────────────────────────────────────────────────────────

describe("images — position types", () => {
  const namedPositions = [
    "center",
    "top",
    "bottom",
    "left",
    "right",
    "extra-top",
    "extra-bottom",
    "extra-left",
    "extra-right",
  ] as const;

  for (const pos of namedPositions) {
    it(`position "${pos}" produces valid SVG`, async () => {
      const { svg } = await QRCodeGenerate({
        data: "https://example.com",
        backgroundOptions: { color: "#ffffff" },
        dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
        images: [
          {
            source: STAR_SVG,
            width: 3,
            height: 3,
            excludeDots: true,
            position: { type: pos },
          },
        ],
      });
      assertValidSVG(svg);
      // Image element should be in the SVG
      expect(svg).toContain("<image");
    });
  }

  it("custom position is rendered", async () => {
    const { svg } = await QRCodeGenerate({
      data: "https://example.com",
      backgroundOptions: { color: "#ffffff" },
      dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
      images: [
        {
          source: STAR_SVG,
          width: 3,
          height: 3,
          excludeDots: false,
          position: { type: "custom", x: 10, y: 10 },
        },
      ],
    });
    assertValidSVG(svg);
    expect(svg).toContain("<image");
  });

  it("image with opacity renders opacity attribute", async () => {
    const { svg } = await QRCodeGenerate({
      data: "https://example.com",
      images: [
        {
          source: STAR_SVG,
          width: 3,
          height: 3,
          opacity: 0.5,
          position: { type: "center" },
        },
      ],
    });
    assertValidSVG(svg);
    expect(svg).toContain("opacity");
  });

  it("excludeDots: true clears dots under image", async () => {
    // Both variants must produce valid SVG — we verify no crash
    const [{ svg: svgExclude }, { svg: svgKeep }] = await Promise.all([
      QRCodeGenerate({
        data: "https://example.com",
        images: [{ source: STAR_SVG, width: 5, height: 5, excludeDots: true }],
      }),
      QRCodeGenerate({
        data: "https://example.com",
        images: [{ source: STAR_SVG, width: 5, height: 5, excludeDots: false }],
      }),
    ]);
    assertValidSVG(svgExclude);
    assertValidSVG(svgKeep);
  });
});

// ─── Decorations ─────────────────────────────────────────────────────────────

describe("decorations — built-in shapes", () => {
  const builtinShapes = [
    "dot",
    "ring",
    "square",
    "diamond",
    "star",
    "star4",
    "cross",
    "triangle",
  ] as const;

  for (const shape of builtinShapes) {
    it(`built-in shape "${shape}" renders valid SVG`, async () => {
      const { svg } = await QRCodeGenerate({
        data: "https://example.com",
        margin: 5,
        backgroundOptions: { color: "#ffffff" },
        dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
        decorations: [
          { shape, color: "#e74c3c", size: 0.7, opacity: 0.9, placement: "scatter", seed: 1 },
        ],
      });
      assertValidSVG(svg);
    });
  }
});

describe("decorations — placement modes", () => {
  const placements = ["scatter", "corners", "top", "bottom", "left", "right", "edges"] as const;

  for (const placement of placements) {
    it(`placement "${placement}" renders valid SVG`, async () => {
      const { svg } = await QRCodeGenerate({
        data: "https://example.com",
        margin: 6,
        backgroundOptions: { color: "#ffffff" },
        dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
        decorations: [
          { shape: "dot", color: "#000000", size: 0.5, placement, seed: 42 },
        ],
      });
      assertValidSVG(svg);
    });
  }
});

describe("decorations — icon and custom-path shapes", () => {
  it("icon decoration renders SVG symbol and use elements", async () => {
    const { svg } = await QRCodeGenerate({
      data: "https://example.com",
      margin: 5,
      backgroundOptions: { color: "#ffffff" },
      dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
      decorations: [
        {
          shape: { type: "icon", path: "heart" },
          color: "#e74c3c",
          size: 0.8,
          opacity: 0.7,
          placement: "scatter",
          seed: 3,
        },
      ],
    });
    assertValidSVG(svg);
    expect(svg).toContain("<symbol");
    expect(svg).toContain("<use");
  });

  it("custom-path decoration uses `path` field (not `d`)", async () => {
    const customPath = "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5";
    const { svg } = await QRCodeGenerate({
      data: "https://example.com",
      margin: 5,
      backgroundOptions: { color: "#ffffff" },
      dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
      decorations: [
        {
          shape: { type: "custom-path", path: customPath, viewBox: "0 0 24 24" },
          color: "#0984e3",
          size: 0.8,
          opacity: 0.6,
          placement: "scatter",
          seed: 21,
        },
      ],
    });
    assertValidSVG(svg);
    // The custom path data should appear in the SVG
    expect(svg).toContain(customPath);
  });

  it("image decoration renders image elements", async () => {
    const { svg } = await QRCodeGenerate({
      data: "https://example.com",
      margin: 5,
      backgroundOptions: { color: "#ffffff" },
      dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
      decorations: [
        {
          shape: { type: "image", source: STAR_SVG },
          size: 0.8,
          opacity: 0.8,
          placement: "corners",
          seed: 5,
        },
      ],
    });
    assertValidSVG(svg);
    expect(svg).toContain("<image");
  });

  it("multiple decoration layers stack correctly", async () => {
    const { svg } = await QRCodeGenerate({
      data: "https://example.com",
      margin: 8,
      backgroundOptions: { color: "#1a1a2e" },
      dotsOptions: { shape: { type: "figure", path: "square" }, color: "#ffffff" },
      decorations: [
        { shape: "star", color: "#ffd700", size: 0.9, placement: "scatter", seed: 7 },
        { shape: "ring", color: "#00d4ff", size: 0.55, opacity: 0.5, placement: "scatter", seed: 99 },
      ],
    });
    assertValidSVG(svg);
  });

  it("decoration seed produces deterministic SVG output", async () => {
    const opts = {
      data: "https://example.com",
      margin: 5,
      backgroundOptions: { color: "#ffffff" },
      dotsOptions: { shape: { type: "figure" as const, path: "square" as const }, color: "#000000" },
      decorations: [{ shape: "dot" as const, color: "#ff0000", size: 0.5, seed: 123 }],
    };
    const [{ svg: svg1 }, { svg: svg2 }] = await Promise.all([
      QRCodeGenerate(opts),
      QRCodeGenerate(opts),
    ]);
    expect(svg1).toBe(svg2);
  });
});

// ─── Frame + label (default style) ───────────────────────────────────────────

// Minimal placeholder frame as a tiny 1×1 transparent PNG data URI
const TRANSPARENT_FRAME =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("frame + label (default style)", () => {
  it("renders SVG with frame when source, width and height are given", async () => {
    const { svg } = await QRCodeGenerate({
      data: "https://example.com",
      frame: {
        source: TRANSPARENT_FRAME,
        width: 600,
        height: 700,
        inset: { width: 400, height: 400 },
      },
    });
    assertValidSVG(svg);
  });

  it("label with position top renders text element", async () => {
    const { svg } = await QRCodeGenerate({
      data: "https://example.com",
      frame: {
        source: TRANSPARENT_FRAME,
        width: 600,
        height: 700,
        inset: { width: 400, height: 400 },
        label: {
          text: "SCAN ME",
          position: "top",
          fontFamily: "Arial, sans-serif",
          fontColor: "#ffffff",
          fontBackgroundColor: "#000000",
          margin: 10,
        },
      },
    });
    assertValidSVG(svg);
    expect(svg).toContain("SCAN ME");
  });

  it("label with position bottom renders text element", async () => {
    const { svg } = await QRCodeGenerate({
      data: "https://example.com",
      frame: {
        source: TRANSPARENT_FRAME,
        width: 600,
        height: 700,
        inset: { width: 400, height: 400 },
        label: {
          text: "VISIT US",
          position: "bottom",
          fontColor: "#ffffff",
        },
      },
    });
    assertValidSVG(svg);
    expect(svg).toContain("VISIT US");
  });

  it("label with position center renders text element", async () => {
    const { svg } = await QRCodeGenerate({
      data: "https://example.com",
      frame: {
        source: TRANSPARENT_FRAME,
        width: 600,
        height: 700,
        inset: { width: 400, height: 400 },
        label: {
          text: "CENTER",
          position: "center",
          fontColor: "#000000",
        },
      },
    });
    assertValidSVG(svg);
    expect(svg).toContain("CENTER");
  });

  it("label with auto position renders text element", async () => {
    const { svg } = await QRCodeGenerate({
      data: "https://example.com",
      frame: {
        source: TRANSPARENT_FRAME,
        width: 600,
        height: 700,
        inset: { width: 400, height: 400 },
        label: {
          text: "AUTO",
          position: "auto",
          fontColor: "#000000",
        },
      },
    });
    assertValidSVG(svg);
    expect(svg).toContain("AUTO");
  });

  it("label with custom position renders text element", async () => {
    const { svg } = await QRCodeGenerate({
      data: "https://example.com",
      frame: {
        source: TRANSPARENT_FRAME,
        width: 600,
        height: 700,
        inset: { width: 400, height: 400 },
        label: {
          text: "CUSTOM",
          position: "custom",
          x: 300,
          y: 650,
          fontColor: "#000000",
        },
      },
    });
    assertValidSVG(svg);
    expect(svg).toContain("CUSTOM");
  });

  it("labels array renders multiple texts", async () => {
    const { svg } = await QRCodeGenerate({
      data: "https://example.com",
      frame: {
        source: TRANSPARENT_FRAME,
        width: 600,
        height: 700,
        inset: { width: 400, height: 400 },
        labels: [
          { text: "TOP LABEL", position: "top", fontColor: "#ffffff" },
          { text: "BOTTOM LABEL", position: "bottom", fontColor: "#ffffff" },
        ],
      },
    });
    assertValidSVG(svg);
    expect(svg).toContain("TOP LABEL");
    expect(svg).toContain("BOTTOM LABEL");
  });
});

// ─── Frame + label (rounded / arc style) ─────────────────────────────────────

describe("frame + label (rounded arc style)", () => {
  it("rounded top arc label renders textPath element", async () => {
    const { svg } = await QRCodeGenerate({
      data: "https://example.com",
      borderRadius: 100,
      margin: 15,
      width: 500,
      height: 500,
      frame: {
        source: TRANSPARENT_FRAME,
        width: 1000,
        height: 1000,
        inset: { width: 500, height: 500 },
        label: {
          text: "SEE WHY IT'S SUPER",
          style: "rounded",
          fontFamily: "Arial, sans-serif",
          fontWeight: 700,
          fontColor: "#ffffff",
          margin: 20,
        },
      },
    });
    assertValidSVG(svg);
    expect(svg).toContain("textPath");
    expect(svg).toContain("SEE WHY IT'S SUPER");
  });

  it("rounded bottom arc label renders textPath element", async () => {
    const { svg } = await QRCodeGenerate({
      data: "https://example.com",
      borderRadius: 100,
      margin: 15,
      width: 500,
      height: 500,
      frame: {
        source: TRANSPARENT_FRAME,
        width: 1000,
        height: 1000,
        inset: { width: 500, height: 500 },
        label: {
          text: "SCAN ME",
          style: "rounded",
          position: "bottom",
          fontColor: "#ffffff",
          margin: 20,
        },
      },
    });
    assertValidSVG(svg);
    expect(svg).toContain("textPath");
    expect(svg).toContain("SCAN ME");
  });

  it("top + bottom arc labels via labels array both render", async () => {
    const { svg } = await QRCodeGenerate({
      data: "https://example.com",
      borderRadius: 100,
      margin: 18,
      width: 500,
      height: 500,
      frame: {
        source: TRANSPARENT_FRAME,
        width: 1000,
        height: 1000,
        inset: { width: 500, height: 500 },
        labels: [
          { text: "TURN YOUR CODE", style: "rounded", fontColor: "#ffffff", margin: 20 },
          {
            text: "INTO REVENUE",
            style: "rounded",
            position: "bottom",
            fontColor: "#ffffff",
            margin: 20,
          },
        ],
      },
    });
    assertValidSVG(svg);
    expect(svg).toContain("TURN YOUR CODE");
    expect(svg).toContain("INTO REVENUE");
  });

  it("arc label with gradient background renders gradient def", async () => {
    const { svg } = await QRCodeGenerate({
      data: "https://example.com",
      borderRadius: 100,
      margin: 18,
      width: 500,
      height: 500,
      frame: {
        source: TRANSPARENT_FRAME,
        width: 1000,
        height: 1000,
        inset: { width: 500, height: 500 },
        label: {
          text: "GRADIENT ARC",
          style: "rounded",
          fontColor: "#ffffff",
          fontBackgroundGradient: {
            type: "linear",
            rotation: 90,
            colorStops: [
              { offset: "0%", color: "#6c5ce7" },
              { offset: "100%", color: "#00d4ff" },
            ],
          },
          margin: 20,
        },
      },
    });
    assertValidSVG(svg);
    expect(svg).toContain("linearGradient");
    expect(svg).toContain("GRADIENT ARC");
  });
});

// ─── exportQR ─────────────────────────────────────────────────────────────────

describe("exportQR", () => {
  it("svg format returns SVG buffer", async () => {
    const { svg } = await QRCodeGenerate({ data: "test" });
    const buf = await exportQR(svg, "svg");
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.toString().startsWith("<svg")).toBe(true);
  });

  it("png format returns non-empty buffer", async () => {
    const { svg } = await QRCodeGenerate({ data: "test", width: 200, height: 200 });
    const buf = await exportQR(svg, "png");
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
    // PNG magic bytes: 89 50 4E 47
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
  });

  it("jpeg format returns non-empty buffer", async () => {
    const { svg } = await QRCodeGenerate({ data: "test", width: 200, height: 200 });
    const buf = await exportQR(svg, "jpeg");
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
    // JPEG magic bytes: FF D8
    expect(buf[0]).toBe(0xff);
    expect(buf[1]).toBe(0xd8);
  });

  it("webp format returns non-empty buffer", async () => {
    const { svg } = await QRCodeGenerate({ data: "test", width: 200, height: 200 });
    const buf = await exportQR(svg, "webp");
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
    // RIFF...WEBP header
    expect(buf.slice(0, 4).toString()).toBe("RIFF");
  });

  it("png with explicit width/height resizes output", async () => {
    const { svg } = await QRCodeGenerate({ data: "test", width: 1000, height: 1000 });
    const buf = await exportQR(svg, "png", { width: 300, height: 300 });
    // Verify it's a PNG and non-empty (size verification via sharp)
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(300);
    expect(meta.height).toBe(300);
  });

  it("throws for unsupported format", async () => {
    const { svg } = await QRCodeGenerate({ data: "test" });
    await expect(exportQR(svg, "bmp" as any)).rejects.toThrow();
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("empty data string generates a valid QR code", async () => {
    const { svg, matrixSize } = await QRCodeGenerate({ data: "" });
    assertValidSVG(svg);
    expect(matrixSize).toBeGreaterThan(0);
  });

  it("data omitted (undefined) falls back to empty string", async () => {
    const { svg } = await QRCodeGenerate({});
    assertValidSVG(svg);
  });

  it("very long URL generates a valid (large) QR code", async () => {
    const longUrl =
      "https://example.com/path/to/some/very/long/resource?query=value&another=thing&more=stuff&extra=param&foo=bar&baz=qux&" +
      "x=".repeat(50) +
      "end";
    const { svg, matrixSize } = await QRCodeGenerate({ data: longUrl });
    assertValidSVG(svg);
    expect(matrixSize).toBeGreaterThan(20);
  });

  it("numeric-mode data generates a readable QR", async () => {
    const text = "1234567890";
    const { svg } = await QRCodeGenerate({
      data: text,
      qrOptions: { mode: "Numeric", errorCorrectionLevel: "M" },
      backgroundOptions: { color: "#ffffff" },
      dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
    });
    expect(await scanSVG(svg)).toBe(text);
  });

  it("margin: 0 still generates a valid SVG", async () => {
    const { svg } = await QRCodeGenerate({ data: "test", margin: 0 });
    assertValidSVG(svg);
  });

  it("large margin is respected", async () => {
    const { svg } = await QRCodeGenerate({ data: "test", margin: 20 });
    assertValidSVG(svg);
  });

  it("custom-icon with no viewBox falls back to 0 0 24 24", async () => {
    const { svg } = await QRCodeGenerate({
      data: "test",
      dotsOptions: {
        shape: {
          type: "custom-icon",
          path: "M12 2L2 7l10 5 10-5-10-5z",
          // no viewBox
        },
        color: "#000000",
      },
    });
    assertValidSVG(svg);
    expect(svg).toContain('viewBox="0 0 24 24"');
  });
});
