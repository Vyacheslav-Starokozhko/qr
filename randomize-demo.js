import { QRCodeGenerate, randomizeOptions } from "./dist/index.js";
import fs from "fs";

const OUT = "svg-output/randomizer-demo";
fs.mkdirSync(OUT, { recursive: true });

const base = {
  data: "https://example.com",
  width: 400,
  height: 400,
  margin: 3,
  dotsOptions: { shape: { type: "figure", path: "dots" } },
  cornersSquareOptions: { shape: { type: "figure", path: "extra-rounded" } },
  cornersDotOptions: { shape: { type: "figure", path: "dot" } },
  backgroundOptions: { color: "#ffffff" },
};

const allFlags = {
  dotsColor: true,
  backgroundColor: true,
  cornersDotColor: true,
  cornersSquareColor: true,
  dotsOverlays: true,
  cornersDotOverlays: true,
  cornersSquareOverlays: true,
};

const cards = [];

(async () => {
  for (let i = 0; i < 30; i++) {
    const opts = randomizeOptions(base, allFlags, i * 1337 + 42);
    const { svg } = await QRCodeGenerate(opts);
    const name = `rand-${String(i + 1).padStart(2, "0")}`;
    fs.writeFileSync(`${OUT}/${name}.svg`, svg);
    cards.push({ name, svg });
    console.log(`✓ ${name}`);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Randomizer Demo — 30 QR Codes</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;background:#111;color:#eee;padding:32px 24px}
  h1{text-align:center;font-size:1.9rem;margin-bottom:6px}
  p.sub{text-align:center;color:#666;font-size:.85rem;margin-bottom:36px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px}
  .card{background:#1c1c1c;border-radius:14px;overflow:hidden;text-align:center;
        padding-bottom:10px;box-shadow:0 2px 12px rgba(0,0,0,.5)}
  .card:hover{transform:translateY(-2px);transition:transform .15s}
  .card svg{width:100%!important;height:auto!important;display:block}
  .num{font-size:.68rem;color:#444;margin-top:8px;letter-spacing:1px}
</style>
</head>
<body>
<h1>Randomizer Demo</h1>
<p class="sub">30 QR codes — all via randomizeOptions() with dotsColor + backgroundColor + overlays enabled</p>
<div class="grid">
${cards.map(({ name, svg }) => `
  <div class="card">
    <div>${svg}</div>
    <div class="num">${name}</div>
  </div>`).join("\n")}
</div>
</body>
</html>`;

  fs.writeFileSync(`${OUT}/index.html`, html);
  console.log(`\n✓ Gallery → ${OUT}/index.html`);
})();
