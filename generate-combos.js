/**
 * generate-combos.js
 *
 * Generates rich combination SVG examples into ./svg-output/.
 * Each file mixes 3–5 features to showcase how they compose together.
 *
 * Run: node generate-combos.js
 */

import { QRCodeGenerate } from "./dist/index.js";
import fs from "fs";
import path from "path";

const OUT = "./svg-output";
fs.mkdirSync(OUT, { recursive: true });

// ─── shared assets ────────────────────────────────────────────────────────────

function fileToDataURI(rel) {
  const abs = path.resolve(rel);
  const ext = path.extname(abs).slice(1).toLowerCase();
  const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml" };
  return `data:${mime[ext] || "application/octet-stream"};base64,${fs.readFileSync(abs).toString("base64")}`;
}

const FRAME = fileToDataURI("assets/frames/frame.png");

const WIFI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%2316213e'/%3E%3Cpath d='M12 15.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm0-4a5.5 5.5 0 0 1 4.95 3.07l-1.6 1.6A3.5 3.5 0 0 0 12 14a3.5 3.5 0 0 0-3.35 2.17l-1.6-1.6A5.5 5.5 0 0 1 12 11.5zm0-4a9.5 9.5 0 0 1 8.49 5.24l-1.6 1.6A7.5 7.5 0 0 0 12 10a7.5 7.5 0 0 0-6.89 4.34l-1.6-1.6A9.5 9.5 0 0 1 12 7.5z' fill='%2300d4ff'/%3E%3C/svg%3E";

const STAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23edf505'/%3E%3Cpolygon points='12,4 14.5,9.5 21,10.3 16.5,14.6 17.8,21 12,17.8 6.2,21 7.5,14.6 3,10.3 9.5,9.5' fill='%231a1a2e'/%3E%3C/svg%3E";

const HEART_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23e74c3c'/%3E%3Cpath d='M12 20s-8-4.5-8-10a5 5 0 0 1 10 0 5 5 0 0 1 10 0c0 5.5-8 10-8 10z' fill='%23ffffff'/%3E%3C/svg%3E";

const W_LOGO =
  "M15.029 34.623c.521.266.399 1.034-.178 1.143a12.592 12.592 0 0 1-6.551-.472C3.466 33.608 0 29.065 0 23.719V13.291c0-1.482 1.012-2.783 2.466-3.17l5.055-1.336a.623.623 0 0 1 .785.592v14.335c0 4.742 2.73 8.86 6.729 10.905l-.006.006ZM24.905 35.295a12.52 12.52 0 0 0 4.153-2.431c2.546-2.244 4.147-5.516 4.147-9.152V4.521c0-1.488 1.012-2.782 2.466-3.17l5.054-1.33a.623.623 0 0 1 .786.593v23.104c0 5.347-3.466 9.89-8.3 11.577-1.3.454-2.693.702-4.153.702-1.46 0-2.852-.248-4.147-.696l-.006-.006Z M24.906 35.295a12.548 12.548 0 0 1-4.153-2.425c-2.545-2.244-4.152-5.517-4.152-9.152V8.906c0-1.482 1.012-2.782 2.466-3.17L24.12 4.4a.623.623 0 0 1 .785.592v18.72c0 3.635 1.608 6.901 4.153 9.152a12.564 12.564 0 0 1-4.153 2.431Z";

// ─── helpers ──────────────────────────────────────────────────────────────────

let total = 0;

async function save(name, opts) {
  const { svg } = await QRCodeGenerate(opts);
  fs.writeFileSync(path.join(OUT, name + ".svg"), svg);
  console.log(`  ✓ ${name}.svg`);
  total++;
}

// ─────────────────────────────────────────────────────────────────────────────

(async () => {

  // ── DARK SPACE THEME ─────────────────────────────────────────────────────────

  // borderRadius:100 + star/ring decorations + arc top label
  await save("combine__dark-space-circle-arc-label", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 100, margin: 15,
    backgroundOptions: { color: "#0d0d1a" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#e0e0ff" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#7c83fd", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#7c83fd", isSingle: true },
    decorations: [
      { shape: "star",  color: "#ffd700", size: 0.85, opacity: 0.9,  placement: "scatter", seed: 7  },
      { shape: "ring",  color: "#7c83fd", size: 0.5,  opacity: 0.45, placement: "scatter", seed: 33 },
    ],
    frame: {
      source: FRAME, width: 1000, height: 1000, inset: { width: 500, height: 500 },
      label: { text: "EXPLORE THE UNIVERSE", style: "rounded", fontColor: "#ffd700", fontWeight: 700, margin: 18 },
    },
  });

  // neon glow: radial bg + gradient dots + gradient corners + neon decorations
  await save("combine__neon-glow-radial-gradient", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 50, margin: 6,
    backgroundOptions: {
      gradient: { type: "radial", colorStops: [{ offset: "0%", color: "#1a003a" }, { offset: "100%", color: "#000000" }] },
    },
    dotsOptions: {
      shape: { type: "figure", path: "square" },
      gradient: { type: "linear", rotation: 135, colorStops: [{ offset: "0%", color: "#ff00ff" }, { offset: "100%", color: "#00ffff" }] },
    },
    cornersSquareOptions: {
      shape: { type: "figure", path: "extra-rounded" },
      gradient: { type: "linear", rotation: 90, colorStops: [{ offset: "0%", color: "#ff00ff" }, { offset: "100%", color: "#00ffff" }] },
      isSingle: true,
    },
    cornersDotOptions: {
      shape: { type: "figure", path: "dot" },
      gradient: { type: "radial", colorStops: [{ offset: "0%", color: "#ffffff" }, { offset: "100%", color: "#ff00ff" }] },
      isSingle: true,
    },
    decorations: [{ shape: "dot", color: "#ff00ff", size: 0.4, opacity: 0.6, placement: "scatter", seed: 11 }],
  });

  // dark matrix: very dark bg + green dots + custom circuit path decoration
  await save("combine__matrix-dark-green-circuit", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 8, margin: 6,
    backgroundOptions: { color: "#030f03" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#00ff41" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#00cc33", isSingle: true },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#00cc33", isSingle: true },
    decorations: [{
      shape: { type: "custom-path", path: "M2 12h4M18 12h4M12 2v4M12 18v4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8", viewBox: "0 0 24 24" },
      color: "#005500", size: 0.8, opacity: 0.5, placement: "scatter", seed: 42,
    }],
  });

  // ── GRADIENT COMBOS ───────────────────────────────────────────────────────────

  // rainbow linear gradient on dots + radial bg + rounded borders
  await save("combine__rainbow-gradient-dots-radial-bg", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 30, margin: 6,
    backgroundOptions: {
      gradient: { type: "radial", colorStops: [{ offset: "0%", color: "#fffef0" }, { offset: "100%", color: "#e8e0ff" }] },
    },
    dotsOptions: {
      shape: { type: "figure", path: "rounded" },
      gradient: { type: "linear", rotation: 45, colorStops: [
        { offset: "0%",   color: "#ff595e" },
        { offset: "33%",  color: "#ffca3a" },
        { offset: "66%",  color: "#6a4c93" },
        { offset: "100%", color: "#1982c4" },
      ]},
    },
    cornersSquareOptions: { shape: { type: "figure", path: "extra-rounded" }, color: "#6a4c93", isSingle: true },
    cornersDotOptions:    { shape: { type: "figure", path: "dot" },           color: "#ff595e", isSingle: true },
  });

  // sunset gradient: linear bg + gradient corners + extra-rounded dots
  await save("combine__sunset-gradient-bg-gradient-corners", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 20, margin: 5,
    backgroundOptions: {
      gradient: { type: "linear", rotation: 160, colorStops: [
        { offset: "0%",   color: "#f7971e" },
        { offset: "50%",  color: "#fd5959" },
        { offset: "100%", color: "#4b134f" },
      ]},
    },
    dotsOptions: { shape: { type: "figure", path: "extra-rounded" }, color: "#ffffff" },
    cornersSquareOptions: {
      shape: { type: "figure", path: "extra-rounded" },
      gradient: { type: "linear", rotation: 90, colorStops: [{ offset: "0%", color: "#ffe259" }, { offset: "100%", color: "#ffa751" }] },
      isSingle: true,
    },
    cornersDotOptions: { shape: { type: "figure", path: "dot" }, color: "#ffe259", isSingle: true },
    decorations: [{ shape: "star4", color: "#ffe259", size: 0.6, opacity: 0.6, placement: "scatter", seed: 19 }],
  });

  // ocean: blue radial bg + wave custom path deco + white dots + rounded
  await save("combine__ocean-radial-bg-custom-wave-deco", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 100, margin: 10,
    backgroundOptions: {
      gradient: { type: "radial", colorStops: [{ offset: "0%", color: "#1a6b9a" }, { offset: "100%", color: "#0a2342" }] },
    },
    dotsOptions: { shape: { type: "figure", path: "dots" }, color: "#e8f4fd" },
    cornersSquareOptions: { shape: { type: "figure", path: "extra-rounded" }, color: "#5dade2", isSingle: true },
    cornersDotOptions:    { shape: { type: "figure", path: "dot" },           color: "#aed6f1", isSingle: true },
    decorations: [
      {
        shape: { type: "custom-path", path: "M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0", viewBox: "0 0 24 24" },
        color: "#5dade2", size: 0.7, opacity: 0.4, placement: "scatter", seed: 55,
      },
      { shape: "ring", color: "#aed6f1", size: 0.45, opacity: 0.35, placement: "scatter", seed: 88 },
    ],
  });

  // fire: warm gradient dots + gradient bg + spark decorations
  await save("combine__fire-gradient-dots-spark-deco", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 15, margin: 6,
    backgroundOptions: {
      gradient: { type: "linear", rotation: 180, colorStops: [{ offset: "0%", color: "#1a0000" }, { offset: "100%", color: "#3d0000" }] },
    },
    dotsOptions: {
      shape: { type: "figure", path: "classy-rounded" },
      gradient: { type: "linear", rotation: 90, colorStops: [
        { offset: "0%",   color: "#ff9a00" },
        { offset: "50%",  color: "#ff4e00" },
        { offset: "100%", color: "#ff0000" },
      ]},
    },
    cornersSquareOptions: {
      shape: { type: "figure", path: "classy" },
      gradient: { type: "linear", rotation: 45, colorStops: [{ offset: "0%", color: "#ffcf00" }, { offset: "100%", color: "#ff4e00" }] },
      isSingle: true,
    },
    cornersDotOptions: { shape: { type: "figure", path: "dot" }, color: "#ffcf00", isSingle: true },
    decorations: [
      { shape: "triangle", color: "#ff9a00", size: 0.65, opacity: 0.7, placement: "scatter", seed: 14 },
      { shape: "dot",      color: "#ffcf00", size: 0.3,  opacity: 0.5, placement: "scatter", seed: 71 },
    ],
  });

  // ── LIGHT / PASTEL THEMES ─────────────────────────────────────────────────────

  // rose gold: linear gradient dots + ring decorations + arc label
  await save("combine__rose-gold-arc-label-ring-deco", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 100, margin: 16,
    backgroundOptions: { color: "#fdf0f0" },
    dotsOptions: {
      shape: { type: "figure", path: "rounded" },
      gradient: { type: "linear", rotation: 135, colorStops: [{ offset: "0%", color: "#b76e79" }, { offset: "100%", color: "#e8a0a8" }] },
    },
    cornersSquareOptions: {
      shape: { type: "figure", path: "extra-rounded" },
      gradient: { type: "linear", rotation: 135, colorStops: [{ offset: "0%", color: "#b76e79" }, { offset: "100%", color: "#e8a0a8" }] },
      isSingle: true,
    },
    cornersDotOptions: { shape: { type: "figure", path: "dot" }, color: "#b76e79", isSingle: true },
    decorations: [{ shape: "ring", color: "#b76e79", size: 0.55, opacity: 0.4, placement: "scatter", seed: 6 }],
    frame: {
      source: FRAME, width: 1000, height: 1000, inset: { width: 500, height: 500 },
      label: { text: "WITH LOVE", style: "rounded", fontColor: "#b76e79", fontWeight: 700, margin: 18 },
    },
  });

  // minimal pastel: light bg + extra-rounded + gradient corners + no deco
  await save("combine__pastel-minimal-gradient-corners", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 40, margin: 6,
    backgroundOptions: { color: "#f0f9ff" },
    dotsOptions: { shape: { type: "figure", path: "extra-rounded" }, color: "#2563eb" },
    cornersSquareOptions: {
      shape: { type: "figure", path: "extra-rounded" },
      gradient: { type: "linear", rotation: 45, colorStops: [{ offset: "0%", color: "#7c3aed" }, { offset: "100%", color: "#2563eb" }] },
      isSingle: true,
    },
    cornersDotOptions: { shape: { type: "figure", path: "dot" }, color: "#7c3aed", isSingle: true },
  });

  // spring: green bg + dots shape + flower icon decorations + star corners
  await save("combine__spring-green-flower-deco", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 60, margin: 8,
    backgroundOptions: { color: "#f0fff4" },
    dotsOptions: { shape: { type: "figure", path: "dots" }, color: "#276749" },
    cornersSquareOptions: { shape: { type: "figure", path: "extra-rounded" }, color: "#276749", isSingle: true },
    cornersDotOptions:    { shape: { type: "figure", path: "dot" },           color: "#48bb78", isSingle: true },
    decorations: [
      { shape: { type: "icon", path: "heart" }, color: "#f687b3", size: 0.9, opacity: 0.6, placement: "scatter", seed: 22 },
      { shape: "dot",                            color: "#48bb78", size: 0.35, opacity: 0.5, placement: "scatter", seed: 77 },
    ],
  });

  // gold luxury: gold gradient bg + dark dots + star decorations + frame label
  await save("combine__gold-luxury-frame-bottom-label", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 10, margin: 5,
    backgroundOptions: {
      gradient: { type: "linear", rotation: 135, colorStops: [
        { offset: "0%",  color: "#f6d365" },
        { offset: "50%", color: "#fda085" },
        { offset: "100%",color: "#f6d365" },
      ]},
    },
    dotsOptions: { shape: { type: "figure", path: "classy-rounded" }, color: "#1a0a00" },
    cornersSquareOptions: { shape: { type: "figure", path: "classy" }, color: "#1a0a00", isSingle: true },
    cornersDotOptions:    { shape: { type: "figure", path: "dot" },    color: "#1a0a00", isSingle: true },
    decorations: [{ shape: "star4", color: "#1a0a00", size: 0.65, opacity: 0.35, placement: "scatter", seed: 9 }],
    frame: {
      source: FRAME, width: 1000, height: 1000, inset: { width: 500, height: 500 },
      label: { text: "PREMIUM ACCESS", position: "bottom", fontColor: "#1a0a00", fontWeight: 700, fontBackgroundColor: "#f6d365", margin: 12 },
    },
  });

  // ── ICON DOT COMBOS ───────────────────────────────────────────────────────────

  // heart dots + ring decorations + gradient bg
  await save("combine__heart-dots-ring-deco-gradient-bg", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 25, margin: 8,
    backgroundOptions: {
      gradient: { type: "radial", colorStops: [{ offset: "0%", color: "#fff0f3" }, { offset: "100%", color: "#ffe0e6" }] },
    },
    dotsOptions: { shape: { type: "icon", path: "heart" }, color: "#e74c3c" },
    cornersSquareOptions: { shape: { type: "figure", path: "extra-rounded" }, color: "#c0392b", isSingle: true },
    cornersDotOptions:    { shape: { type: "figure", path: "dot" },           color: "#c0392b", isSingle: true },
    decorations: [
      { shape: "ring",  color: "#e74c3c", size: 0.6,  opacity: 0.4, placement: "scatter", seed: 5 },
      { shape: { type: "icon", path: "heart" }, color: "#ff6b81", size: 0.5, opacity: 0.3, placement: "corners", seed: 55 },
    ],
  });

  // star2 dots + diamond decorations + dark bg
  await save("combine__star2-dots-diamond-deco-dark", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 15, margin: 7,
    backgroundOptions: { color: "#1c1c2e" },
    dotsOptions: { shape: { type: "icon", path: "star2" }, color: "#ffd700" },
    cornersSquareOptions: { shape: { type: "figure", path: "extra-rounded" }, color: "#ffd700", isSingle: true },
    cornersDotOptions:    { shape: { type: "figure", path: "dot" },           color: "#ffd700", isSingle: true },
    decorations: [
      { shape: "diamond", color: "#ffd700", size: 0.7,  opacity: 0.6, placement: "scatter", seed: 13 },
      { shape: "dot",     color: "#fffacd", size: 0.25, opacity: 0.4, placement: "scatter", seed: 66 },
    ],
  });

  // heart2 dots + gradient corners + scattered stars + frame arc
  await save("combine__heart2-dots-gradient-corners-arc", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 100, margin: 16,
    backgroundOptions: { color: "#fff5f7" },
    dotsOptions: { shape: { type: "icon", path: "heart2" }, color: "#e91e8c" },
    cornersSquareOptions: {
      shape: { type: "figure", path: "extra-rounded" },
      gradient: { type: "linear", rotation: 90, colorStops: [{ offset: "0%", color: "#e91e8c" }, { offset: "100%", color: "#ff6b9d" }] },
      isSingle: true,
    },
    cornersDotOptions: { shape: { type: "figure", path: "dot" }, color: "#e91e8c", isSingle: true },
    decorations: [{ shape: "star4", color: "#ff6b9d", size: 0.6, opacity: 0.5, placement: "scatter", seed: 31 }],
    frame: {
      source: FRAME, width: 1000, height: 1000, inset: { width: 500, height: 500 },
      labels: [
        { text: "FOLLOW US",  style: "rounded",             fontColor: "#e91e8c", fontWeight: 700, margin: 16 },
        { text: "SCAN & LIKE", style: "rounded", position: "bottom", fontColor: "#e91e8c", fontWeight: 700, margin: 16 },
      ],
    },
  });

  // ── LOGO / IMAGE COMBOS ───────────────────────────────────────────────────────

  // center logo + multiple edge images + classy dots
  await save("combine__logo-center-edge-images-classy", {
    data: "https://example.com", width: 500, height: 500,
    margin: 4,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { shape: { type: "figure", path: "classy-rounded" }, color: "#1a1a2e" },
    cornersSquareOptions: { shape: { type: "figure", path: "classy" },           color: "#16213e", isSingle: true },
    cornersDotOptions:    { shape: { type: "figure", path: "dot" },              color: "#16213e", isSingle: true },
    images: [
      { source: WIFI,  width: 5, height: 5, excludeDots: true, position: { type: "center" } },
      { source: STAR,  width: 2, height: 2, excludeDots: true, position: { type: "extra-top" } },
      { source: STAR,  width: 2, height: 2, excludeDots: true, position: { type: "extra-bottom" } },
    ],
  });

  // center logo + gradient dots + decorations
  await save("combine__wifi-logo-gradient-dots-deco", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 30, margin: 7,
    backgroundOptions: { color: "#0f0c29" },
    dotsOptions: {
      shape: { type: "figure", path: "square" },
      gradient: { type: "linear", rotation: 90, colorStops: [{ offset: "0%", color: "#302b63" }, { offset: "100%", color: "#24c6dc" }] },
    },
    cornersSquareOptions: {
      shape: { type: "figure", path: "extra-rounded" },
      gradient: { type: "linear", rotation: 90, colorStops: [{ offset: "0%", color: "#24c6dc" }, { offset: "100%", color: "#514a9d" }] },
      isSingle: true,
    },
    cornersDotOptions: { shape: { type: "figure", path: "dot" }, color: "#24c6dc", isSingle: true },
    images: [{ source: WIFI, width: 5, height: 5, excludeDots: true, position: { type: "center" } }],
    decorations: [
      { shape: "ring", color: "#24c6dc", size: 0.5, opacity: 0.4, placement: "scatter", seed: 4 },
      { shape: "dot",  color: "#514a9d", size: 0.3, opacity: 0.3, placement: "scatter", seed: 80 },
    ],
  });

  // heart logo + heart deco + gradient bg + arc label
  await save("combine__heart-logo-heart-deco-arc", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 100, margin: 14,
    backgroundOptions: {
      gradient: { type: "radial", colorStops: [{ offset: "0%", color: "#ffb3c1" }, { offset: "100%", color: "#ff4d6d" }] },
    },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#ffffff" },
    cornersSquareOptions: { shape: { type: "figure", path: "extra-rounded" }, color: "#ffffff", isSingle: true },
    cornersDotOptions:    { shape: { type: "figure", path: "dot" },           color: "#ffffff", isSingle: true },
    images: [{ source: HEART_ICON, width: 5, height: 5, excludeDots: true, position: { type: "center" } }],
    decorations: [
      { shape: { type: "icon", path: "heart" }, color: "#ffffff", size: 0.7, opacity: 0.25, placement: "scatter", seed: 2 },
    ],
    frame: {
      source: FRAME, width: 1000, height: 1000, inset: { width: 500, height: 500 },
      label: { text: "SPREAD THE LOVE", style: "rounded", fontColor: "#ffffff", fontWeight: 700, margin: 18 },
    },
  });

  // ── FRAME COMBOS ─────────────────────────────────────────────────────────────

  // frame + top/bottom arcs + gradient dots + circle QR
  await save("combine__frame-both-arcs-gradient-dots-circle", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 100, margin: 18,
    backgroundOptions: { color: "#1a1a2e" },
    dotsOptions: {
      shape: { type: "figure", path: "square" },
      gradient: { type: "linear", rotation: 90, colorStops: [{ offset: "0%", color: "#ffffff" }, { offset: "100%", color: "#a0a0ff" }] },
    },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#6c5ce7", isSingle: true },
    cornersDotOptions:    { shape: { type: "figure", path: "square" }, color: "#00cec9", isSingle: true },
    frame: {
      source: FRAME, width: 1000, height: 1000, inset: { width: 500, height: 500 },
      labels: [
        { text: "CONNECT WITH US",  style: "rounded",             fontColor: "#a0a0ff", fontWeight: 700, margin: 20 },
        { text: "SCAN TO JOIN",     style: "rounded", position: "bottom", fontColor: "#00cec9", fontWeight: 700, margin: 20 },
      ],
    },
  });

  // frame + bottom arc + gradient arc bg + wifi logo + decorations
  await save("combine__frame-arc-wifi-logo-deco", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 100, margin: 16,
    backgroundOptions: { color: "#001233" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#e0fbfc" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#48cae4", isSingle: true },
    cornersDotOptions:    { shape: { type: "figure", path: "square" }, color: "#90e0ef", isSingle: true },
    images: [{ source: WIFI, width: 5, height: 5, excludeDots: true, position: { type: "center" } }],
    decorations: [{ shape: "ring", color: "#48cae4", size: 0.45, opacity: 0.35, placement: "scatter", seed: 17 }],
    frame: {
      source: FRAME, width: 1000, height: 1000, inset: { width: 500, height: 500 },
      label: {
        text: "FREE WIFI",
        style: "rounded", position: "bottom",
        fontColor: "#e0fbfc", fontWeight: 800,
        fontBackgroundGradient: {
          type: "linear", rotation: 90,
          colorStops: [{ offset: "0%", color: "#023e8a" }, { offset: "100%", color: "#0077b6" }],
        },
        margin: 20,
      },
    },
  });

  // frame + default top label + gradient bg + custom-icon W logo
  await save("combine__frame-top-label-custom-icon-gradient", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 15, margin: 5,
    backgroundOptions: {
      gradient: { type: "linear", rotation: 135, colorStops: [{ offset: "0%", color: "#f8f9fa" }, { offset: "100%", color: "#e9ecef" }] },
    },
    dotsOptions: { shape: { type: "custom-icon", path: W_LOGO, viewBox: "0 0 41 36" }, color: "#212529" },
    cornersSquareOptions: { shape: { type: "figure", path: "square" }, color: "#212529", isSingle: true },
    cornersDotOptions:    { shape: { type: "figure", path: "square" }, color: "#212529", isSingle: true },
    frame: {
      source: FRAME, width: 1000, height: 1000, inset: { width: 500, height: 500 },
      label: { text: "SCAN ME", position: "top", fontColor: "#ffffff", fontBackgroundColor: "#212529", fontWeight: 700, margin: 12 },
    },
  });

  // ── MIXED ADVANCED COMBOS ─────────────────────────────────────────────────────

  // per-module corners + scale 0.8 + radial bg + image center
  await save("combine__per-module-corners-scale-logo", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 20, margin: 6,
    backgroundOptions: {
      gradient: { type: "radial", colorStops: [{ offset: "0%", color: "#f8f9fa" }, { offset: "100%", color: "#dee2e6" }] },
    },
    dotsOptions: { shape: { type: "figure", path: "rounded" }, color: "#343a40", scale: 0.85 },
    cornersSquareOptions: { shape: { type: "figure", path: "extra-rounded" }, color: "#495057", isSingle: false, scale: 0.85 },
    cornersDotOptions:    { shape: { type: "figure", path: "dot" },           color: "#212529", isSingle: false, scale: 0.85 },
    images: [{ source: STAR, width: 4, height: 4, excludeDots: true, position: { type: "center" } }],
  });

  // all error correction visible: 4 images in corners + H level + decorations
  await save("combine__4-corner-images-decorations-H", {
    data: "https://example.com", width: 500, height: 500,
    qrOptions: { errorCorrectionLevel: "H" },
    margin: 5,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { shape: { type: "figure", path: "classy-rounded" }, color: "#2d3436" },
    cornersSquareOptions: { shape: { type: "figure", path: "classy" }, color: "#2d3436", isSingle: true },
    cornersDotOptions:    { shape: { type: "figure", path: "dot" },    color: "#2d3436", isSingle: true },
    images: [
      { source: STAR, width: 2.5, height: 2.5, excludeDots: true, position: { type: "extra-top" } },
      { source: STAR, width: 2.5, height: 2.5, excludeDots: true, position: { type: "extra-bottom" } },
      { source: STAR, width: 2.5, height: 2.5, excludeDots: true, position: { type: "extra-left" } },
      { source: STAR, width: 2.5, height: 2.5, excludeDots: true, position: { type: "extra-right" } },
      { source: WIFI, width: 5,   height: 5,   excludeDots: true, position: { type: "center" } },
    ],
    decorations: [{ shape: "star4", color: "#fdcb6e", size: 0.55, opacity: 0.7, placement: "corners", seed: 3 }],
  });

  // L error correction + large margin + classy dots + corner diamond deco
  await save("combine__L-correction-large-margin-diamond-deco", {
    data: "https://example.com", width: 500, height: 500,
    qrOptions: { errorCorrectionLevel: "L" },
    margin: 12,
    borderRadius: 20,
    backgroundOptions: { color: "#fafafa" },
    dotsOptions: { shape: { type: "figure", path: "classy" }, color: "#2c3e50" },
    cornersSquareOptions: { shape: { type: "figure", path: "classy" }, color: "#2c3e50", isSingle: true },
    cornersDotOptions:    { shape: { type: "figure", path: "dot" },    color: "#2c3e50", isSingle: true },
    decorations: [
      { shape: "diamond", color: "#e74c3c", size: 0.8, opacity: 0.65, placement: "corners", seed: 10 },
      { shape: "diamond", color: "#3498db", size: 0.5, opacity: 0.5,  placement: "edges",   seed: 20 },
    ],
  });

  // icon corners (outer-eye-heart) + gradient dots + arc label
  await save("combine__icon-heart-eye-gradient-dots-arc", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 100, margin: 16,
    backgroundOptions: { color: "#fdf2f8" },
    dotsOptions: {
      shape: { type: "figure", path: "rounded" },
      gradient: { type: "linear", rotation: 45, colorStops: [{ offset: "0%", color: "#9b59b6" }, { offset: "100%", color: "#e74c3c" }] },
    },
    cornersSquareOptions: { shape: { type: "icon", path: "outer-eye-heart" }, color: "#e74c3c", isSingle: true },
    cornersDotOptions:    { shape: { type: "figure", path: "dot" },           color: "#9b59b6", isSingle: true },
    decorations: [{ shape: "dot", color: "#e74c3c", size: 0.35, opacity: 0.3, placement: "scatter", seed: 44 }],
    frame: {
      source: FRAME, width: 1000, height: 1000, inset: { width: 500, height: 500 },
      label: { text: "SHARE THE MOMENT", style: "rounded", fontColor: "#9b59b6", fontWeight: 700, margin: 18 },
    },
  });

  // ── FULL EVERYTHING COMBOS ────────────────────────────────────────────────────

  // THE KITCHEN SINK — every major feature active at once
  await save("combine__full-all-features-kitchen-sink", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 60, margin: 10,
    qrOptions: { errorCorrectionLevel: "H" },
    backgroundOptions: {
      gradient: { type: "radial", colorStops: [{ offset: "0%", color: "#1a1a2e" }, { offset: "100%", color: "#16213e" }] },
    },
    dotsOptions: {
      shape: { type: "figure", path: "classy-rounded" },
      gradient: { type: "linear", rotation: 90, colorStops: [{ offset: "0%", color: "#e0e0ff" }, { offset: "100%", color: "#8888ff" }] },
    },
    cornersSquareOptions: {
      shape: { type: "figure", path: "extra-rounded" },
      gradient: { type: "linear", rotation: 45, colorStops: [{ offset: "0%", color: "#00cec9" }, { offset: "100%", color: "#6c5ce7" }] },
      isSingle: true,
    },
    cornersDotOptions: {
      shape: { type: "figure", path: "dot" },
      gradient: { type: "radial", colorStops: [{ offset: "0%", color: "#ffeaa7" }, { offset: "100%", color: "#fdcb6e" }] },
      isSingle: true,
    },
    images: [{ source: WIFI, width: 5, height: 5, excludeDots: true, position: { type: "center" } }],
    decorations: [
      { shape: "star",  color: "#ffeaa7", size: 0.7,  opacity: 0.75, placement: "scatter", seed: 7  },
      { shape: "ring",  color: "#00cec9", size: 0.4,  opacity: 0.35, placement: "scatter", seed: 33 },
    ],
    frame: {
      source: FRAME, width: 1000, height: 1000, inset: { width: 500, height: 500 },
      labels: [
        { text: "CONNECT NOW",   style: "rounded",             fontColor: "#ffeaa7", fontWeight: 700, margin: 20 },
        { text: "SCAN TO START", style: "rounded", position: "bottom", fontColor: "#00cec9", fontWeight: 700, margin: 20 },
      ],
    },
  });

  // dark tech: dark bg + custom-path circuit deco + logo + gradient corners + scale
  await save("combine__dark-tech-circuit-logo-gradient", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 10, margin: 7,
    backgroundOptions: { color: "#0a0a0f" },
    dotsOptions: { shape: { type: "figure", path: "square" }, color: "#00ff88", scale: 0.88 },
    cornersSquareOptions: {
      shape: { type: "figure", path: "square" },
      gradient: { type: "linear", rotation: 90, colorStops: [{ offset: "0%", color: "#00ff88" }, { offset: "100%", color: "#00aaff" }] },
      isSingle: true,
    },
    cornersDotOptions: { shape: { type: "figure", path: "square" }, color: "#00aaff", isSingle: true },
    images: [{ source: WIFI, width: 5, height: 5, excludeDots: true, opacity: 0.9, position: { type: "center" } }],
    decorations: [
      {
        shape: { type: "custom-path", path: "M3 12h3M18 12h3M12 3v3M12 18v3M6.2 6.2l2.1 2.1M15.7 15.7l2.1 2.1M6.2 17.8l2.1-2.1M15.7 8.3l2.1-2.1", viewBox: "0 0 24 24" },
        color: "#004422", size: 1.0, opacity: 0.4, placement: "scatter", seed: 55,
      },
    ],
  });

  // minimal white: just dots shape + scale 0.7 + center logo — ultra minimal
  await save("combine__minimal-white-sparse-center-logo", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 20, margin: 6,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { shape: { type: "figure", path: "dots" }, color: "#111111", scale: 0.7 },
    cornersSquareOptions: { shape: { type: "figure", path: "extra-rounded" }, color: "#111111", isSingle: true },
    cornersDotOptions:    { shape: { type: "figure", path: "dot" },           color: "#111111", isSingle: true },
    images: [{ source: STAR, width: 4, height: 4, excludeDots: true, position: { type: "center" } }],
  });

  // vibrant: rainbow gradient dots + radial bg + image corners + star4 deco
  await save("combine__vibrant-rainbow-radial-4corners-logos", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 50, margin: 8,
    qrOptions: { errorCorrectionLevel: "H" },
    backgroundOptions: {
      gradient: { type: "radial", colorStops: [{ offset: "0%", color: "#ffffff" }, { offset: "100%", color: "#f0e6ff" }] },
    },
    dotsOptions: {
      shape: { type: "figure", path: "rounded" },
      gradient: { type: "linear", rotation: 60, colorStops: [
        { offset: "0%",   color: "#f72585" },
        { offset: "33%",  color: "#7209b7" },
        { offset: "66%",  color: "#4361ee" },
        { offset: "100%", color: "#4cc9f0" },
      ]},
    },
    cornersSquareOptions: {
      shape: { type: "figure", path: "extra-rounded" },
      gradient: { type: "linear", rotation: 45, colorStops: [{ offset: "0%", color: "#f72585" }, { offset: "100%", color: "#4cc9f0" }] },
      isSingle: true,
    },
    cornersDotOptions: { shape: { type: "figure", path: "dot" }, color: "#7209b7", isSingle: true },
    images: [{ source: WIFI, width: 5, height: 5, excludeDots: true, position: { type: "center" } }],
    decorations: [
      { shape: "star4", color: "#f72585", size: 0.6, opacity: 0.5, placement: "corners", seed: 8 },
      { shape: "dot",   color: "#4cc9f0", size: 0.3, opacity: 0.3, placement: "edges",   seed: 60 },
    ],
  });

  // bold brand: flat design, classy dots, border-radius 0, bold frame label
  await save("combine__bold-brand-flat-classy-frame", {
    data: "https://example.com", width: 500, height: 500,
    borderRadius: 0, margin: 4,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: { shape: { type: "figure", path: "classy" }, color: "#000000" },
    cornersSquareOptions: { shape: { type: "figure", path: "classy" }, color: "#e53e3e", isSingle: true },
    cornersDotOptions:    { shape: { type: "figure", path: "square" }, color: "#e53e3e", isSingle: true },
    frame: {
      source: FRAME, width: 1000, height: 1000, inset: { width: 500, height: 500 },
      label: { text: "SCAN ME NOW", position: "bottom", fontColor: "#ffffff", fontBackgroundColor: "#e53e3e", fontWeight: 800, fontSize: 32, margin: 10 },
    },
  });

  // ────────────────────────────────────────────────────────────────────────────
  console.log(`\n✅  Done — ${total} combination SVGs written to ${OUT}/`);
})();
