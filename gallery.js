import { QRCodeGenerate } from "./dist/index.js";
import fs from "fs";
import path from "path";

const URL = "https://example.com";
const ECL = "H";

// ─── shared colour palettes ────────────────────────────────────────────────
const DARK   = "#0a0a0f";
const WHITE  = "#ffffff";
const OFFWHT = "#f5f0e8";

function stops(pairs) {
  return pairs.map(([offset, color]) => ({ offset, color }));
}

// ─── 20 QR configurations ─────────────────────────────────────────────────
const qrs = [

  // 1 ── Neon Cyber ────────────────────────────────────────────────────────
  {
    name: "01-neon-cyber",
    title: "Neon Cyber",
    cfg: {
      backgroundOptions: { color: "#050510" },
      dotsOptions: { color: "#00e5ff" },
      cornersSquareOptions: { color: "#ff00aa" },
      cornersDotOptions: { color: "#00e5ff" },
      effects: { type: "neon-glow", color: "#00e5ff", intensity: 2.5, spread: 7 },
      animation: [
        { type: "pulse", target: "eyes", from: 0.3, duration: 1.8 },
        { type: "shimmer", color: "#ffffff", opacity: 0.25, duration: 3 },
      ],
    },
  },

  // 2 ── Liquid Mercury ────────────────────────────────────────────────────
  {
    name: "02-liquid-mercury",
    title: "Liquid Mercury",
    cfg: {
      backgroundOptions: { color: "#1a1a2e" },
      dotsOptions: { color: "#c0c0c0" },
      cornersSquareOptions: { color: "#e0e0e0" },
      cornersDotOptions: { color: "#ffffff" },
      effects: [
        { type: "liquid", blur: 1.6, threshold: 0.28 },
        { type: "neon-glow", color: "#aaaacc", intensity: 2, spread: 5 },
      ],
      animation: { type: "glow", color: "#8888ff", intensity: 3, duration: 2.5 },
    },
  },

  // 3 ── Drop Shadow 3D ────────────────────────────────────────────────────
  {
    name: "03-drop-shadow-3d",
    title: "Drop Shadow 3D",
    cfg: {
      backgroundOptions: { color: WHITE },
      dotsOptions: { color: "#1a1a2e" },
      cornersSquareOptions: { color: "#e63946" },
      cornersDotOptions: { color: "#1a1a2e" },
      effects: { type: "drop-shadow", target: "dots", dx: 1.2, dy: 1.8, blur: 1, color: "#e63946", opacity: 0.55 },
      animation: { type: "draw", direction: "ltr", duration: 1.8 },
    },
  },

  // 4 ── Organic Blobs ─────────────────────────────────────────────────────
  {
    name: "04-organic-blobs",
    title: "Organic Blobs",
    cfg: {
      backgroundOptions: { color: "#1b1b2f" },
      dotsOptions: { color: "#ff6b35" },
      cornersSquareOptions: { color: "#ff9f1c" },
      cornersDotOptions: { color: "#ffbf69" },
      effects: [
        { type: "morphology", operator: "dilate", radius: 0.35 },
        { type: "blend", mode: "screen", color: "#ff6b35", opacity: 0.4 },
      ],
      animation: { type: "pulse", target: "dots", from: 0.6, duration: 2.2 },
    },
  },

  // 5 ── Matrix Rain ───────────────────────────────────────────────────────
  {
    name: "05-matrix-rain",
    title: "Matrix Rain",
    cfg: {
      backgroundOptions: { color: "#001100" },
      dotsOptions: { color: "#00ff41" },
      cornersSquareOptions: { color: "#00cc33" },
      cornersDotOptions: { color: "#00ff41" },
      effects: [
        { type: "liquid", blur: 1.3, threshold: 0.32 },
        { type: "neon-glow", color: "#00ff41", intensity: 2, spread: 5 },
      ],
      animation: [
        { type: "pulse", target: "dots", from: 0.5, duration: 1.5 },
        { type: "shimmer", color: "#00ff41", opacity: 0.3, duration: 2 },
      ],
    },
  },

  // 6 ── Gold Rush ─────────────────────────────────────────────────────────
  {
    name: "06-gold-rush",
    title: "Gold Rush",
    cfg: {
      backgroundOptions: { color: "#1a0a00" },
      dotsOptions: {
        gradient: {
          type: "linear", rotation: 45,
          colorStops: stops([["0%","#ffd700"],["50%","#ff8c00"],["100%","#ffd700"]]),
        },
      },
      cornersSquareOptions: { color: "#ffd700" },
      cornersDotOptions: { color: "#ff8c00" },
      effects: [
        { type: "neon-glow", color: "#ffd700", intensity: 2.5, spread: 6 },
        { type: "drop-shadow", target: "dots", dx: 1, dy: 1, blur: 1.5, color: "#ff6600", opacity: 0.6 },
      ],
      animation: { type: "shimmer", color: "#fffde7", opacity: 0.5, duration: 2 },
    },
  },

  // 7 ── Eroded Mono ────────────────────────────────────────────────────────
  {
    name: "07-eroded-mono",
    title: "Eroded Mono",
    cfg: {
      backgroundOptions: { color: WHITE },
      dotsOptions: { color: "#111111" },
      cornersSquareOptions: { color: "#6a0dad" },
      cornersDotOptions: { color: "#111111" },
      effects: [
        { type: "morphology", operator: "erode", radius: 0.18 },
        { type: "blend", mode: "multiply", opacity: 0.7,
          gradient: { type: "linear", rotation: 120,
            colorStops: stops([["0%","#6a0dad"],["100%","#0d47a1"]]) } },
      ],
    },
  },

  // 8 ── Holographic ────────────────────────────────────────────────────────
  {
    name: "08-holographic",
    title: "Holographic",
    cfg: {
      backgroundOptions: { color: "#f0f0ff" },
      dotsOptions: { color: "#0d0d2b" },
      cornersSquareOptions: { color: "#0d0d2b" },
      cornersDotOptions: { color: "#0d0d2b" },
      effects: [
        { type: "neon-glow", target: "all", color: "#aa88ff", intensity: 1.5, spread: 4 },
        { type: "blend", mode: "screen", opacity: 0.55,
          gradient: { type: "linear", rotation: 90,
            colorStops: stops([["0%","#ff0080"],["33%","#00ffcc"],["66%","#4400ff"],["100%","#ff0080"]]) } },
      ],
      animation: { type: "shimmer", color: "#ffffff", opacity: 0.45, duration: 3 },
    },
  },

  // 9 ── Drawing Blueprint ──────────────────────────────────────────────────
  {
    name: "09-blueprint-draw",
    title: "Blueprint Draw",
    cfg: {
      backgroundOptions: { color: "#003366" },
      dotsOptions: { color: "#7ec8e3" },
      cornersSquareOptions: { color: "#ffffff" },
      cornersDotOptions: { color: "#7ec8e3" },
      effects: [
        { type: "drop-shadow", target: "dots", dx: 0.5, dy: 0.5, blur: 0.5, color: "#00ccff", opacity: 0.8 },
        { type: "neon-glow", color: "#7ec8e3", intensity: 1.5, spread: 3 },
      ],
      animation: { type: "draw", direction: "ttb", duration: 2.2, repeat: false },
    },
  },

  // 10 ── Ocean Depths ──────────────────────────────────────────────────────
  {
    name: "10-ocean-depths",
    title: "Ocean Depths",
    cfg: {
      backgroundOptions: { color: "#020f1c" },
      dotsOptions: { color: "#0077b6" },
      cornersSquareOptions: { color: "#00b4d8" },
      cornersDotOptions: { color: "#90e0ef" },
      effects: [
        { type: "liquid", blur: 2, threshold: 0.25 },
        { type: "blend", mode: "screen", opacity: 0.5,
          gradient: { type: "radial",
            colorStops: stops([["0%","#00f5ff"],["60%","#0077b6"],["100%","#020f1c"]]) } },
      ],
      animation: { type: "glow", color: "#00b4d8", intensity: 4, duration: 3 },
    },
  },

  // 11 ── Fire Storm ────────────────────────────────────────────────────────
  {
    name: "11-fire-storm",
    title: "Fire Storm",
    cfg: {
      backgroundOptions: { color: "#0d0000" },
      dotsOptions: { color: "#ff4500" },
      cornersSquareOptions: { color: "#ff8c00" },
      cornersDotOptions: { color: "#ffdd00" },
      effects: [
        { type: "neon-glow", color: "#ff4500", intensity: 3, spread: 8 },
        { type: "blend", mode: "screen", color: "#ff6600", opacity: 0.35 },
      ],
      animation: [
        { type: "shimmer", color: "#ffdd00", opacity: 0.4, duration: 1.5 },
        { type: "pulse", target: "eyes", from: 0.4, duration: 1.2 },
      ],
    },
  },

  // 12 ── Crystal Frost ─────────────────────────────────────────────────────
  {
    name: "12-crystal-frost",
    title: "Crystal Frost",
    cfg: {
      backgroundOptions: { color: "#080d14" },
      dotsOptions: { color: "#e0f2ff" },
      cornersSquareOptions: { color: "#ffffff" },
      cornersDotOptions: { color: "#b3e5fc" },
      effects: [
        { type: "drop-shadow", target: "all", dx: 0, dy: 0, blur: 3, color: "#66ccff", opacity: 0.7 },
        { type: "neon-glow", color: "#b3e5fc", intensity: 2, spread: 5 },
        { type: "blend", mode: "screen", color: "#aaddff", opacity: 0.25 },
      ],
    },
  },

  // 13 ── Vintage Stamp ─────────────────────────────────────────────────────
  {
    name: "13-vintage-stamp",
    title: "Vintage Stamp",
    cfg: {
      backgroundOptions: { color: "#f5e6c8" },
      dotsOptions: { color: "#3b1f00" },
      cornersSquareOptions: { color: "#7a3b0a" },
      cornersDotOptions: { color: "#3b1f00" },
      effects: [
        { type: "morphology", operator: "erode", radius: 0.15 },
        { type: "drop-shadow", target: "dots", dx: 1.5, dy: 1.5, blur: 0.8, color: "#7a3b0a", opacity: 0.5 },
        { type: "blend", mode: "multiply", opacity: 0.4,
          gradient: { type: "linear", rotation: 45,
            colorStops: stops([["0%","#c68642"],["100%","#8b4513"]]) } },
      ],
    },
  },

  // 14 ── Electric Storm ────────────────────────────────────────────────────
  {
    name: "14-electric-storm",
    title: "Electric Storm",
    cfg: {
      backgroundOptions: { color: "#07000f" },
      dotsOptions: { color: "#7b2fff" },
      cornersSquareOptions: { color: "#00d4ff" },
      cornersDotOptions: { color: "#7b2fff" },
      effects: [
        { type: "neon-glow", color: "#7b2fff", intensity: 3.5, spread: 9 },
        { type: "blend", mode: "screen", opacity: 0.4,
          gradient: { type: "linear", rotation: 90,
            colorStops: stops([["0%","#00d4ff"],["50%","#7b2fff"],["100%","#ff0080"]]) } },
      ],
      animation: [
        { type: "pulse", target: "all", from: 0.55, duration: 1.5 },
        { type: "shimmer", color: "#ffffff", opacity: 0.2, duration: 2.5 },
      ],
    },
  },

  // 15 ── Liquid Gold ───────────────────────────────────────────────────────
  {
    name: "15-liquid-gold",
    title: "Liquid Gold",
    cfg: {
      backgroundOptions: { color: "#0f0800" },
      dotsOptions: { color: "#e6a817" },
      cornersSquareOptions: { color: "#ffd700" },
      cornersDotOptions: { color: "#e6a817" },
      effects: [
        { type: "liquid", blur: 1.8, threshold: 0.3 },
        { type: "neon-glow", color: "#ffd700", intensity: 2, spread: 5 },
        { type: "blend", mode: "screen", opacity: 0.35,
          gradient: { type: "radial",
            colorStops: stops([["0%","#fff176"],["60%","#ffa000"],["100%","#0f0800"]]) } },
      ],
      animation: { type: "glow", color: "#ffd700", intensity: 4, duration: 2.5 },
    },
  },

  // 16 ── Glitch Art ────────────────────────────────────────────────────────
  {
    name: "16-glitch-art",
    title: "Glitch Art",
    cfg: {
      backgroundOptions: { color: "#000000" },
      dotsOptions: { color: "#ffffff" },
      cornersSquareOptions: { color: "#ff0044" },
      cornersDotOptions: { color: "#00ffff" },
      effects: [
        { type: "blend", mode: "difference", opacity: 0.6,
          gradient: { type: "linear", rotation: 0,
            colorStops: stops([["0%","#ff0044"],["50%","#00ffff"],["100%","#ff0044"]]) } },
        { type: "neon-glow", target: "eyes", color: "#ff0044", intensity: 2.5, spread: 5 },
      ],
      animation: [
        { type: "pulse", target: "eyes", from: 0.2, duration: 0.8 },
        { type: "shimmer", color: "#00ffff", opacity: 0.35, direction: "ttb", duration: 1.2 },
      ],
    },
  },

  // 17 ── Dark Matter ───────────────────────────────────────────────────────
  {
    name: "17-dark-matter",
    title: "Dark Matter",
    cfg: {
      backgroundOptions: { color: "#000000" },
      dotsOptions: { color: "#9d00ff" },
      cornersSquareOptions: { color: "#ff00aa" },
      cornersDotOptions: { color: "#9d00ff" },
      effects: [
        { type: "liquid", blur: 2.2, threshold: 0.22 },
        { type: "neon-glow", color: "#9d00ff", intensity: 3, spread: 8 },
      ],
      animation: [
        { type: "glow", color: "#ff00aa", intensity: 5, duration: 2 },
        { type: "pulse", target: "eyes", from: 0.3, duration: 1.5 },
      ],
    },
  },

  // 18 ── Aurora Borealis ───────────────────────────────────────────────────
  {
    name: "18-aurora",
    title: "Aurora Borealis",
    cfg: {
      backgroundOptions: { color: "#010c10" },
      dotsOptions: { color: "#00e676" },
      cornersSquareOptions: { color: "#00bfa5" },
      cornersDotOptions: { color: "#69f0ae" },
      effects: [
        { type: "neon-glow", color: "#00e676", intensity: 2, spread: 5 },
        { type: "blend", mode: "screen", opacity: 0.45,
          gradient: { type: "linear", rotation: 70,
            colorStops: stops([["0%","#00e676"],["25%","#00bcd4"],["50%","#aa00ff"],["75%","#00e676"],["100%","#00bcd4"]]) } },
      ],
      animation: [
        { type: "shimmer", color: "#69f0ae", opacity: 0.4, duration: 4 },
        { type: "pulse", target: "eyes", from: 0.4, duration: 2.5 },
      ],
    },
  },

  // 19 ── Rose Gold ─────────────────────────────────────────────────────────
  {
    name: "19-rose-gold",
    title: "Rose Gold",
    cfg: {
      backgroundOptions: { color: "#2d1b22" },
      dotsOptions: { color: "#f4a0b5" },
      cornersSquareOptions: { color: "#e8768f" },
      cornersDotOptions: { color: "#f4a0b5" },
      effects: [
        { type: "morphology", operator: "dilate", radius: 0.2 },
        { type: "neon-glow", color: "#ff9eb5", intensity: 2, spread: 4.5 },
        { type: "drop-shadow", target: "dots", dx: 1, dy: 1, blur: 1.2, color: "#c45069", opacity: 0.5 },
        { type: "blend", mode: "screen", opacity: 0.25,
          gradient: { type: "radial",
            colorStops: stops([["0%","#ffd6e0"],["100%","#2d1b22"]]) } },
      ],
      animation: { type: "shimmer", color: "#fff0f5", opacity: 0.35, duration: 3 },
    },
  },

  // 20 ── Ultraviolet ───────────────────────────────────────────────────────
  {
    name: "20-ultraviolet",
    title: "Ultraviolet",
    cfg: {
      backgroundOptions: { color: "#060008" },
      dotsOptions: {
        gradient: {
          type: "linear", rotation: 135,
          colorStops: stops([["0%","#bf00ff"],["50%","#ff00cc"],["100%","#3300ff"]]),
        },
      },
      cornersSquareOptions: { color: "#ff00cc" },
      cornersDotOptions: { color: "#bf00ff" },
      effects: [
        { type: "liquid", blur: 1.5, threshold: 0.3 },
        { type: "neon-glow", color: "#bf00ff", intensity: 3, spread: 7 },
        { type: "blend", mode: "screen", opacity: 0.3,
          gradient: { type: "linear", rotation: 135,
            colorStops: stops([["0%","#ff00ff"],["100%","#0000ff"]]) } },
      ],
      animation: [
        { type: "glow", color: "#ff00cc", intensity: 4, duration: 2 },
        { type: "shimmer", color: "#ee88ff", opacity: 0.3, duration: 2.5 },
      ],
    },
  },

];

// ─── Generate all QR codes ──────────────────────────────────────────────────
const outDir = "gallery";
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const common = {
  data: URL,
  width: 600,
  height: 600,
  margin: 3,
  backgroundEnable: true,
  imageEnable: false,
  qrOptions: { typeNumber: 0, mode: "Byte", errorCorrectionLevel: ECL },
};

console.log("Generating 20 QR codes...");
const results = [];

for (const qr of qrs) {
  process.stdout.write(`  ${qr.name} ... `);
  try {
    const { svg } = await QRCodeGenerate({ ...common, ...qr.cfg });
    const file = path.join(outDir, `${qr.name}.svg`);
    fs.writeFileSync(file, svg);
    results.push({ name: qr.name, title: qr.title, file, ok: true });
    console.log("✓");
  } catch (err) {
    results.push({ name: qr.name, title: qr.title, ok: false, err: err.message });
    console.log("✗", err.message);
  }
}

// ─── Build HTML gallery ──────────────────────────────────────────────────────
const cards = results.map((r, i) => {
  if (!r.ok) {
    return `<div class="card error"><div class="num">${i+1}</div><div class="title">${r.title}</div><div class="err">${r.err}</div></div>`;
  }
  const svgContent = fs.readFileSync(r.file, "utf8");
  return `
    <div class="card">
      <div class="preview">${svgContent}</div>
      <div class="info">
        <span class="num">${i+1}</span>
        <span class="title">${r.title}</span>
      </div>
    </div>`;
}).join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>QR Gallery — 20 Effects</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0a0a0f;
    color: #eee;
    font-family: system-ui, sans-serif;
    padding: 2rem;
  }
  h1 {
    text-align: center;
    font-size: 2rem;
    margin-bottom: 0.4rem;
    background: linear-gradient(135deg, #00e5ff, #ff00cc, #ffd700);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .subtitle {
    text-align: center;
    color: #888;
    margin-bottom: 2.5rem;
    font-size: 0.9rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
  }
  .card {
    background: #13131f;
    border: 1px solid #1e1e32;
    border-radius: 16px;
    overflow: hidden;
    transition: transform .2s, box-shadow .2s;
  }
  .card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(0,0,0,.6);
  }
  .preview {
    width: 100%;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    background: #0d0d18;
  }
  .preview svg {
    width: 100%;
    height: 100%;
    border-radius: 8px;
  }
  .info {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid #1e1e32;
  }
  .num {
    background: #1e1e32;
    color: #888;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 999px;
    flex-shrink: 0;
  }
  .title {
    font-size: 0.9rem;
    font-weight: 600;
    color: #ddd;
  }
  .card.error .preview { min-height: 100px; }
  .err { color: #ff5555; font-size: 0.8rem; padding: 0.5rem; }
</style>
</head>
<body>
<h1>QR Code Effects Gallery</h1>
<p class="subtitle">20 QR codes — filters · animations · blend modes · combinations</p>
<div class="grid">
${cards}
</div>
</body>
</html>`;

fs.writeFileSync(path.join(outDir, "index.html"), html);

const ok  = results.filter(r => r.ok).length;
const bad = results.filter(r => !r.ok).length;
console.log(`\nDone: ${ok} OK, ${bad} failed`);
console.log(`Gallery → ${path.resolve(outDir, "index.html")}`);
