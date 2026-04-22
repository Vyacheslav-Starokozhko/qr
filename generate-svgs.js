/**
 * generate-svgs.js
 *
 * Generates 111 SVG files into ./svg-output/, one per test configuration.
 * Named as [feature_name].svg or [combine_name].svg.
 *
 * Run: node generate-svgs.js
 */

import { QRCodeGenerate } from "./dist/index.js";
import fs from "fs";
import path from "path";

const OUT = "./svg-output";
fs.mkdirSync(OUT, { recursive: true });

// ─── shared assets ───────────────────────────────────────────────────────────

function fileToDataURI(rel) {
  const abs = path.resolve(rel);
  const ext = path.extname(abs).slice(1).toLowerCase();
  const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml" };
  const data = fs.readFileSync(abs).toString("base64");
  return `data:${mime[ext] || "application/octet-stream"};base64,${data}`;
}

const FRAME = fileToDataURI("assets/frames/frame.png");

const STAR_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23edf505'/%3E%3Cpolygon points='12,4 14.5,9.5 21,10.3 16.5,14.6 17.8,21 12,17.8 6.2,21 7.5,14.6 3,10.3 9.5,9.5' fill='%231a1a2e'/%3E%3C/svg%3E";

const WIFI_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%2316213e'/%3E%3Cpath d='M12 15.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm0-4a5.5 5.5 0 0 1 4.95 3.07l-1.6 1.6A3.5 3.5 0 0 0 12 14a3.5 3.5 0 0 0-3.35 2.17l-1.6-1.6A5.5 5.5 0 0 1 12 11.5zm0-4a9.5 9.5 0 0 1 8.49 5.24l-1.6 1.6A7.5 7.5 0 0 0 12 10a7.5 7.5 0 0 0-6.89 4.34l-1.6-1.6A9.5 9.5 0 0 1 12 7.5z' fill='%2300d4ff'/%3E%3C/svg%3E";

const W_LOGO =
  "M15.029 34.623c.521.266.399 1.034-.178 1.143a12.592 12.592 0 0 1-6.551-.472C3.466 33.608 0 29.065 0 23.719V13.291c0-1.482 1.012-2.783 2.466-3.17l5.055-1.336a.623.623 0 0 1 .785.592v14.335c0 4.742 2.73 8.86 6.729 10.905l-.006.006ZM24.905 35.295a12.52 12.52 0 0 0 4.153-2.431c2.546-2.244 4.147-5.516 4.147-9.152V4.521c0-1.488 1.012-2.782 2.466-3.17l5.054-1.33a.623.623 0 0 1 .786.593v23.104c0 5.347-3.466 9.89-8.3 11.577-1.3.454-2.693.702-4.153.702-1.46 0-2.852-.248-4.147-.696l-.006-.006Z" +
  " " +
  "M24.906 35.295a12.548 12.548 0 0 1-4.153-2.425c-2.545-2.244-4.152-5.517-4.152-9.152V8.906c0-1.482 1.012-2.782 2.466-3.17L24.12 4.4a.623.623 0 0 1 .785.592v18.72c0 3.635 1.608 6.901 4.153 9.152a12.564 12.564 0 0 1-4.153 2.431Z";

const TRANSPARENT_FRAME =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// ─── helpers ──────────────────────────────────────────────────────────────────

async function save(name, options) {
  const { svg } = await QRCodeGenerate(options);
  fs.writeFileSync(path.join(OUT, name + ".svg"), svg);
  console.log(`  ✓ ${name}.svg`);
  return svg;
}

function squareBase(extra = {}) {
  return {
    width: 500,
    height: 500,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
    ...extra,
  };
}

// ─── GENERATION ───────────────────────────────────────────────────────────────

let count = 0;

(async () => {

  // ── 1. Result structure (4) ──────────────────────────────────────────────────
  console.log("\n[1/20] Result structure");

  await save("result-structure__basic", {
    data: "https://example.com",
    width: 500, height: 500,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
  }); count++;

  await save("result-structure__canvas-null-nodejs", {
    data: "https://example.com/canvas-null",
    width: 500, height: 500,
    backgroundOptions: { color: "#f0f4ff" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#2d3436" },
  }); count++;

  await save("result-structure__width-height-400", {
    data: "https://example.com",
    width: 400, height: 400,
    backgroundOptions: { color: "#fff8f0" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#333333" },
  }); count++;

  await save("result-structure__defaults-1000x1000", {
    data: "https://example.com/defaults",
    backgroundOptions: { color: "#f9f9f9" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#111111" },
  }); count++;

  // ── 2. getQRBounds (3) ───────────────────────────────────────────────────────
  console.log("\n[2/20] getQRBounds");

  await save("getqrbounds__matrixSize-eyeZones-getMaxPos", {
    data: "https://example.com",
    width: 500, height: 500,
    backgroundOptions: { color: "#eaf4fb" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#2980b9" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#1a5276", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#1a5276", isSingle: true },
  }); count++;

  await save("getqrbounds__error-correction-L-vs-H", {
    data: "hi",
    width: 500, height: 500,
    qrOptions: { errorCorrectionLevel: "L" },
    backgroundOptions: { color: "#fef9e7" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#f39c12" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#e67e22", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#e67e22", isSingle: true },
  }); count++;

  await save("getqrbounds__getMaxPos-clamp-zero", {
    data: "hi",
    width: 500, height: 500,
    qrOptions: { errorCorrectionLevel: "L" },
    backgroundOptions: { color: "#f9f3ff" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#8e44ad" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#6c3483", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#6c3483", isSingle: true },
  }); count++;

  // ── 3. Figure dot shapes (6) ─────────────────────────────────────────────────
  console.log("\n[3/20] Figure dot shapes");

  for (const shape of ["square", "extra-rounded", "rounded", "classy", "classy-rounded", "dots"]) {
    await save(`figure-dot__${shape}`, squareBase({
      data: "https://example.com",
      dotsOptions: { shape: { type: "figure", path: shape }, color: "#000000" },
    })); count++;
  }

  // ── 4. Icon dot shapes (4) ───────────────────────────────────────────────────
  console.log("\n[4/20] Icon dot shapes");

  for (const icon of ["heart", "star", "star2", "heart2"]) {
    await save(`icon-dot__${icon}`, squareBase({
      data: "https://example.com",
      dotsOptions: { shape: { type: "icon", path: icon }, color: "#c0392b" },
    })); count++;
  }

  // ── 5. cornersSquareOptions — all 7 figures + icon + isSingle:false (9) ──────
  console.log("\n[5/20] cornersSquareOptions");

  for (const shape of ["square", "dot", "dots", "extra-rounded", "rounded", "classy", "classy-rounded"]) {
    await save(`corners-square__${shape}`, {
      data: "https://example.com",
      width: 500, height: 500,
      backgroundOptions: { color: "#ffffff" },
      dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
      cornersSquareOptions: { shape: { type: "figure", path: shape }, color: "#e74c3c", isSingle: true },
      cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#c0392b", isSingle: true },
    }); count++;
  }

  await save("corners-square__icon-outer-eye-extra-rounded", {
    data: "https://example.com",
    width: 500, height: 500,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
    cornersSquareOptions: { shape: { type: "icon", path: "outer-eye-extra-rounded" }, color: "#e74c3c", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#c0392b", isSingle: true },
  }); count++;

  await save("corners-square__isSingle-false-per-module", {
    data: "https://example.com",
    width: 500, height: 500,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#27ae60", isSingle: false },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#1e8449", isSingle: false },
  }); count++;

  // ── 6. cornersDotOptions — all 6 figures + icon (7) ─────────────────────────
  console.log("\n[6/20] cornersDotOptions");

  for (const shape of ["square", "dot", "dots", "classy", "rounded", "classy-rounded"]) {
    await save(`corners-dot__${shape}`, {
      data: "https://example.com",
      width: 500, height: 500,
      backgroundOptions: { color: "#ffffff" },
      dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
      cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
      cornersDotOptions: { shape: { type: "figure", path: shape }, color: "#3498db", isSingle: true },
    }); count++;
  }

  await save("corners-dot__icon-inner-eye-dots", {
    data: "https://example.com",
    width: 500, height: 500,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
    cornersDotOptions: { shape: { type: "icon", path: "inner-eye-dots" }, color: "#2980b9", isSingle: true },
  }); count++;

  // ── 7. Scale (2) ─────────────────────────────────────────────────────────────
  console.log("\n[7/20] Scale");

  await save("scale__0.7-sparse", {
    data: "https://example.com",
    width: 500, height: 500,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000", scale: 0.7 },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true, scale: 0.7 },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true, scale: 0.7 },
  }); count++;

  await save("scale__1.3-dense", {
    data: "https://example.com",
    width: 500, height: 500,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000", scale: 1.3 },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true, scale: 1.3 },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true, scale: 1.3 },
  }); count++;

  // ── 8. Gradients (4) ─────────────────────────────────────────────────────────
  console.log("\n[8/20] Gradients");

  await save("gradient__linear-dots-black-to-red", {
    data: "https://example.com",
    width: 500, height: 500,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: {
      shape: { type: "figure", path: "square" },
      gradient: { type: "linear", rotation: 45, colorStops: [{ offset: "0%", color: "#000000" }, { offset: "100%", color: "#e74c3c" }] },
    },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
  }); count++;

  await save("gradient__radial-background-orange-blue", {
    data: "https://example.com",
    width: 500, height: 500,
    backgroundOptions: {
      gradient: { type: "radial", colorStops: [{ offset: "0%", color: "#ffa500" }, { offset: "100%", color: "#3498db" }] },
    },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#ffffff" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#ffffff", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#ffffff", isSingle: true },
  }); count++;

  await save("gradient__linear-corners-square-per-eye", {
    data: "https://example.com",
    width: 500, height: 500,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
    cornersSquareOptions: {
      shape: { type: "figure", path: "square" },
      gradient: { type: "linear", rotation: 90, colorStops: [{ offset: "0%", color: "#e74c3c" }, { offset: "100%", color: "#3498db" }] },
      isSingle: true,
    },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#9b59b6", isSingle: true },
  }); count++;

  await save("gradient__radial-corners-dot-per-eye", {
    data: "https://example.com",
    width: 500, height: 500,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#2c3e50", isSingle: true },
    cornersDotOptions: {
      shape: { type: "figure", path: "square" },
      gradient: { type: "radial", colorStops: [{ offset: "0%", color: "#f39c12" }, { offset: "100%", color: "#e74c3c" }] },
      isSingle: true,
    },
  }); count++;

  // ── 9. backgroundOptions (2) ─────────────────────────────────────────────────
  console.log("\n[9/20] backgroundOptions");

  await save("background__solid-color-red", {
    data: "https://example.com",
    width: 500, height: 500,
    backgroundOptions: { color: "#ff0000" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#ffffff" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#ffffff", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#ffffff", isSingle: true },
  }); count++;

  await save("background__transparent-rgba-zero-alpha", {
    data: "https://example.com",
    width: 500, height: 500,
    backgroundOptions: { color: "rgba(255,255,255,0)" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
  }); count++;

  // ── 10. borderRadius (5) ─────────────────────────────────────────────────────
  console.log("\n[10/20] borderRadius");

  for (const [radius, color] of [[0, "#2c3e50"], [25, "#16a085"], [50, "#8e44ad"], [100, "#c0392b"]]) {
    await save(`border-radius__${radius}`, {
      data: "https://example.com",
      width: 500, height: 500,
      borderRadius: radius,
      margin: 6,
      backgroundOptions: { color: "#ffffff" },
      dotsOptions: { shape: { type: "figure", path: "square" }, color },
      cornersSquareOptions: { shape: { type: "figure", path: "square" }, color, isSingle: true },
      cornersDotOptions: { shape: { type: "figure", path: "square" }, color, isSingle: true },
    }); count++;
  }

  await save("border-radius__100-circle-readable", {
    data: "https://example.com",
    width: 500, height: 500,
    borderRadius: 100,
    margin: 8,
    backgroundOptions: { color: "#1a1a2e" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#ffffff" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#00d4ff", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#00d4ff", isSingle: true },
  }); count++;

  // ── 11. qrOptions error correction (5) ───────────────────────────────────────
  console.log("\n[11/20] qrOptions");

  for (const [level, color] of [["L", "#27ae60"], ["M", "#2980b9"], ["Q", "#8e44ad"], ["H", "#c0392b"]]) {
    await save(`qr-error-correction__${level}`, {
      data: "https://example.com",
      width: 500, height: 500,
      qrOptions: { errorCorrectionLevel: level },
      backgroundOptions: { color: "#ffffff" },
      dotsOptions: { shape: { type: "figure", path: "square" }, color },
      cornersSquareOptions: { shape: { type: "figure", path: "square" }, color, isSingle: true },
      cornersDotOptions: { shape: { type: "figure", path: "square" }, color, isSingle: true },
    }); count++;
  }

  await save("qr-error-correction__matrix-size-comparison", {
    data: "hi",
    width: 500, height: 500,
    qrOptions: { errorCorrectionLevel: "H" },
    backgroundOptions: { color: "#fdfefe" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#17202a" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#17202a", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#17202a", isSingle: true },
  }); count++;

  // ── 12. Images — all 9 named positions + custom + opacity + excludeDots (12) ─
  console.log("\n[12/20] Images");

  for (const pos of ["center", "top", "bottom", "left", "right", "extra-top", "extra-bottom", "extra-left", "extra-right"]) {
    await save(`image-position__${pos}`, {
      data: "https://example.com",
      width: 500, height: 500,
      backgroundOptions: { color: "#ffffff" },
      dotsOptions: { shape: { type: "figure", path: "square" }, color: "#2c3e50" },
      cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#2c3e50", isSingle: true },
      cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#2c3e50", isSingle: true },
      images: [{ source: STAR_SVG, width: 3, height: 3, excludeDots: true, position: { type: pos } }],
    }); count++;
  }

  await save("image-position__custom-x10-y10", {
    data: "https://example.com",
    width: 500, height: 500,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#2c3e50" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#2c3e50", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#2c3e50", isSingle: true },
    images: [{ source: STAR_SVG, width: 3, height: 3, excludeDots: false, position: { type: "custom", x: 10, y: 10 } }],
  }); count++;

  await save("image__opacity-0.5", {
    data: "https://example.com",
    width: 500, height: 500,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#2c3e50" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#2c3e50", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#2c3e50", isSingle: true },
    images: [{ source: WIFI_SVG, width: 5, height: 5, opacity: 0.5, position: { type: "center" } }],
  }); count++;

  await save("image__excludeDots-true-vs-false", {
    data: "https://example.com",
    width: 500, height: 500,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#2c3e50" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#2c3e50", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#2c3e50", isSingle: true },
    images: [
      { source: WIFI_SVG, width: 5, height: 5, excludeDots: true, position: { type: "center" } },
      { source: STAR_SVG, width: 3, height: 3, excludeDots: false, position: { type: "top" } },
    ],
  }); count++;

  // ── 13. Decorations — built-in shapes (8) ────────────────────────────────────
  console.log("\n[13/20] Decorations built-in");

  const decColors = {
    dot: "#e74c3c", ring: "#3498db", square: "#2ecc71", diamond: "#9b59b6",
    star: "#f39c12", star4: "#1abc9c", cross: "#e67e22", triangle: "#e91e63",
  };

  for (const shape of ["dot", "ring", "square", "diamond", "star", "star4", "cross", "triangle"]) {
    await save(`decoration-builtin__${shape}`, {
      data: "https://example.com",
      width: 500, height: 500,
      margin: 6,
      backgroundOptions: { color: "#ffffff" },
      dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
      cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
      cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
      decorations: [{ shape, color: decColors[shape], size: 0.7, opacity: 0.9, placement: "scatter", seed: 1 }],
    }); count++;
  }

  // ── 14. Decorations — placement modes (7) ────────────────────────────────────
  console.log("\n[14/20] Decorations placement modes");

  for (const [placement, color] of [
    ["scatter", "#e74c3c"], ["corners", "#3498db"], ["top", "#27ae60"],
    ["bottom", "#8e44ad"], ["left", "#f39c12"], ["right", "#1abc9c"], ["edges", "#e91e63"],
  ]) {
    await save(`decoration-placement__${placement}`, {
      data: "https://example.com",
      width: 500, height: 500,
      margin: 6,
      backgroundOptions: { color: "#ffffff" },
      dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
      cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
      cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
      decorations: [{ shape: "dot", color, size: 0.6, placement, seed: 42 }],
    }); count++;
  }

  // ── 15. Decorations — icon / custom-path / image / layers / seed (5) ─────────
  console.log("\n[15/20] Decorations icon/custom-path");

  await save("decoration__icon-heart", {
    data: "https://example.com",
    width: 500, height: 500,
    margin: 6,
    backgroundOptions: { color: "#fff0f3" },
    dotsOptions: { shape: { type: "figure", path: "dots" }, color: "#c0392b" },
    cornersSquareOptions: { shape: { type: "figure", path: "extra-rounded" }, color: "#c0392b", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "dot" }, color: "#c0392b", isSingle: true },
    decorations: [{ shape: { type: "icon", path: "heart" }, color: "#e74c3c", size: 1.0, opacity: 0.7, placement: "scatter", seed: 3 }],
  }); count++;

  await save("decoration__custom-path-chevron", {
    data: "https://example.com",
    width: 500, height: 500,
    margin: 6,
    backgroundOptions: { color: "#f0f4ff" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#2d3436" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#0984e3", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#0984e3", isSingle: true },
    decorations: [{
      shape: { type: "custom-path", path: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5", viewBox: "0 0 24 24" },
      color: "#0984e3", size: 0.8, opacity: 0.6, placement: "scatter", seed: 21,
    }],
  }); count++;

  await save("decoration__image-star", {
    data: "https://example.com",
    width: 500, height: 500,
    margin: 6,
    backgroundOptions: { color: "#fef9e7" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#2c3e50" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#2c3e50", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#2c3e50", isSingle: true },
    decorations: [{ shape: { type: "image", source: STAR_SVG }, size: 0.8, opacity: 0.8, placement: "corners", seed: 5 }],
  }); count++;

  await save("decoration__multi-layer-stars-rings", {
    data: "https://example.com",
    width: 500, height: 500,
    margin: 8,
    borderRadius: 100,
    backgroundOptions: { color: "#1a1a2e" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#ffffff" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#00d4ff", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#00d4ff", isSingle: true },
    decorations: [
      { shape: "star", color: "#ffd700", size: 0.9, opacity: 0.85, placement: "scatter", seed: 7 },
      { shape: "ring", color: "#00d4ff", size: 0.55, opacity: 0.5, placement: "scatter", seed: 99 },
    ],
  }); count++;

  await save("decoration__seed-deterministic", {
    data: "https://example.com",
    width: 500, height: 500,
    margin: 6,
    backgroundOptions: { color: "#f9f3ff" },
    dotsOptions: { shape: { type: "figure", path: "rounded" }, color: "#6c3483" },
    cornersSquareOptions: { shape: { type: "figure", path: "extra-rounded" }, color: "#6c3483", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "dot" }, color: "#6c3483", isSingle: true },
    decorations: [{ shape: "dot", color: "#9b59b6", size: 0.5, seed: 123, placement: "scatter" }],
  }); count++;

  // ── 16. Frame + label default style (7) ──────────────────────────────────────
  console.log("\n[16/20] Frame + label default style");

  await save("frame-label__no-label", {
    data: "https://example.com",
    width: 500, height: 500,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
    frame: { source: FRAME, width: 1000, height: 1000, inset: { width: 500, height: 500 } },
  }); count++;

  for (const [position, bg, fg] of [
    ["top",    "#1a1a2e", "#ffffff"],
    ["bottom", "#0d6efd", "#ffffff"],
    ["center", "#27ae60", "#ffffff"],
    ["auto",   "#c0392b", "#ffffff"],
    ["custom", "#8e44ad", "#ffffff"],
  ]) {
    const extra = position === "custom" ? { x: 500, y: 920 } : {};
    await save(`frame-label__position-${position}`, {
      data: "https://example.com",
      width: 500, height: 500,
      backgroundOptions: { color: "#f8f9fa" },
      dotsOptions: { shape: { type: "figure", path: "square" }, color: "#212529" },
      cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#212529", isSingle: true },
      cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#212529", isSingle: true },
      frame: {
        source: FRAME,
        width: 1000, height: 1000,
        inset: { width: 500, height: 500 },
        label: { text: "SCAN ME", position, fontFamily: "Arial, sans-serif", fontWeight: 700, fontColor: fg, fontBackgroundColor: bg, margin: 12, ...extra },
      },
    }); count++;
  }

  await save("frame-label__labels-array-top-bottom", {
    data: "https://example.com",
    width: 500, height: 500,
    backgroundOptions: { color: "#f8f9fa" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#212529" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#212529", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#212529", isSingle: true },
    frame: {
      source: FRAME,
      width: 1000, height: 1000,
      inset: { width: 500, height: 500 },
      labels: [
        { text: "TOP LABEL",    position: "top",    fontColor: "#ffffff", fontBackgroundColor: "#1a1a2e", margin: 10 },
        { text: "BOTTOM LABEL", position: "bottom", fontColor: "#ffffff", fontBackgroundColor: "#c0392b", margin: 10 },
      ],
    },
  }); count++;

  // ── 17. Frame + label rounded arc style (4) ───────────────────────────────────
  console.log("\n[17/20] Frame + label rounded arc");

  await save("frame-label-arc__top", {
    data: "https://example.com",
    width: 500, height: 500,
    borderRadius: 100,
    margin: 15,
    backgroundOptions: { color: "#1a1a2e" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#ffffff" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#00d4ff", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#00d4ff", isSingle: true },
    frame: {
      source: FRAME, width: 1000, height: 1000, inset: { width: 500, height: 500 },
      label: { text: "SEE WHY IT'S SUPER", style: "rounded", fontFamily: "Arial, sans-serif", fontWeight: 700, fontColor: "#ffffff", margin: 20 },
    },
  }); count++;

  await save("frame-label-arc__bottom", {
    data: "https://example.com",
    width: 500, height: 500,
    borderRadius: 100,
    margin: 15,
    backgroundOptions: { color: "#1a1a2e" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#ffffff" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#00d4ff", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#00d4ff", isSingle: true },
    frame: {
      source: FRAME, width: 1000, height: 1000, inset: { width: 500, height: 500 },
      label: { text: "SCAN ME", style: "rounded", position: "bottom", fontColor: "#ffffff", margin: 20 },
    },
  }); count++;

  await save("frame-label-arc__top-and-bottom", {
    data: "https://example.com",
    width: 500, height: 500,
    borderRadius: 100,
    margin: 18,
    backgroundOptions: { color: "#1a1a2e" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#ffffff" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#6c5ce7", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#6c5ce7", isSingle: true },
    frame: {
      source: FRAME, width: 1000, height: 1000, inset: { width: 500, height: 500 },
      labels: [
        { text: "TURN YOUR CODE", style: "rounded", fontColor: "#ffffff", margin: 20 },
        { text: "INTO REVENUE",   style: "rounded", position: "bottom", fontColor: "#ffffff", margin: 20 },
      ],
    },
  }); count++;

  await save("frame-label-arc__gradient-background", {
    data: "https://example.com",
    width: 500, height: 500,
    borderRadius: 100,
    margin: 18,
    backgroundOptions: { color: "#1a1a2e" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#ffffff" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#6c5ce7", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#6c5ce7", isSingle: true },
    frame: {
      source: FRAME, width: 1000, height: 1000, inset: { width: 500, height: 500 },
      label: {
        text: "GRADIENT ARC",
        style: "rounded",
        fontColor: "#ffffff",
        fontBackgroundGradient: {
          type: "linear", rotation: 90,
          colorStops: [{ offset: "0%", color: "#6c5ce7" }, { offset: "100%", color: "#00d4ff" }],
        },
        margin: 20,
      },
    },
  }); count++;

  // ── 18. exportQR (6) ─────────────────────────────────────────────────────────
  // All saved as .svg since this is an SVG output dir; the test also checks binary formats.
  console.log("\n[18/20] exportQR");

  await save("exportqr__svg-format", squareBase({ data: "https://example.com/export-svg", width: 400, height: 400 })); count++;
  await save("exportqr__png-format", squareBase({ data: "https://example.com/export-png", width: 400, height: 400, backgroundOptions: { color: "#e8f8f5" }, dotsOptions: { shape: { type: "figure", path: "square" }, color: "#1e8449" } })); count++;
  await save("exportqr__jpeg-format", squareBase({ data: "https://example.com/export-jpeg", width: 400, height: 400, backgroundOptions: { color: "#fef9e7" }, dotsOptions: { shape: { type: "figure", path: "square" }, color: "#b7950b" } })); count++;
  await save("exportqr__webp-format", squareBase({ data: "https://example.com/export-webp", width: 400, height: 400, backgroundOptions: { color: "#f9f3ff" }, dotsOptions: { shape: { type: "figure", path: "square" }, color: "#6c3483" } })); count++;
  await save("exportqr__png-resized-300x300", squareBase({ data: "https://example.com/export-resized", width: 1000, height: 1000 })); count++;
  await save("exportqr__unsupported-format-error", squareBase({ data: "https://example.com/export-error", backgroundOptions: { color: "#fdecea" }, dotsOptions: { shape: { type: "figure", path: "square" }, color: "#c0392b" } })); count++;

  // ── 19. Edge cases (7) ───────────────────────────────────────────────────────
  console.log("\n[19/20] Edge cases");

  await save("edge-case__empty-data", {
    data: "",
    width: 500, height: 500,
    backgroundOptions: { color: "#fdfefe" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#566573" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#566573", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#566573", isSingle: true },
  }); count++;

  await save("edge-case__data-undefined-fallback", {
    width: 500, height: 500,
    backgroundOptions: { color: "#f0f3f4" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#717d7e" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#717d7e", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#717d7e", isSingle: true },
  }); count++;

  await save("edge-case__very-long-url", {
    data: "https://example.com/path/to/some/very/long/resource?query=value&another=thing&more=stuff&extra=param&foo=bar&baz=qux&" + "x=".repeat(40) + "end",
    width: 500, height: 500,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#1a252f" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#1a252f", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#1a252f", isSingle: true },
  }); count++;

  await save("edge-case__numeric-mode", {
    data: "1234567890",
    width: 500, height: 500,
    qrOptions: { mode: "Numeric", errorCorrectionLevel: "M" },
    backgroundOptions: { color: "#eafaf1" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#1e8449" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#1e8449", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#1e8449", isSingle: true },
  }); count++;

  await save("edge-case__margin-zero", {
    data: "https://example.com",
    width: 500, height: 500,
    margin: 0,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
  }); count++;

  await save("edge-case__margin-large-20", {
    data: "https://example.com",
    width: 500, height: 500,
    margin: 20,
    backgroundOptions: { color: "#fdfefe" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#2c3e50" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#2c3e50", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#2c3e50", isSingle: true },
  }); count++;

  await save("edge-case__custom-icon-no-viewBox-fallback", {
    data: "https://example.com",
    width: 500, height: 500,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: {
      shape: { type: "custom-icon", path: "M12 2L2 7l10 5 10-5-10-5z" },
      color: "#000000",
    },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
  }); count++;

  // ── 20. Readability (4) ───────────────────────────────────────────────────────
  console.log("\n[20/20] Readability");

  await save("readability__basic-square-dot", {
    data: "https://github.com/my-lib",
    width: 500, height: 500,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#000000" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
  }); count++;

  await save("readability__icon-heart-dots", {
    data: "https://github.com/my-lib",
    width: 500, height: 500,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { shape: { type: "icon", path: "heart" }, color: "#c0392b" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
  }); count++;

  await save("readability__custom-icon-w-logo", {
    data: "https://wiki.org",
    width: 500, height: 500,
    qrOptions: { errorCorrectionLevel: "H" },
    margin: 2,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { shape: { type: "custom-icon", path: W_LOGO, viewBox: "0 0 41 36" }, color: "#000000" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#000000", isSingle: true },
  }); count++;

  await save("readability__low-contrast-white-on-white", {
    data: "fail",
    width: 500, height: 500,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#ffffff" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#ffffff", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#ffffff", isSingle: true },
  }); count++;

  // ─────────────────────────────────────────────────────────────────────────────
  console.log(`\n✅  Done — generated ${count} SVG files in ${OUT}/`);
  if (count !== 111) {
    console.warn(`⚠️  Expected 111 but got ${count}`);
  }
})();
