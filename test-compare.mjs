import { QRCodeGenerate } from "./dist/index.js";
import fs from "fs";

async function run() {
  const base = {
    width: 362, height: 362, images: [], margin: 1,
    dotsOptions: { color: "#000", shape: { type: "figure", path: "rounded" } },
    backgroundOptions: { color: "rgba(255,255,255,0)" },
    data: "https://qr-code-builder.vercel.app",
  };

  const r1 = await QRCodeGenerate({
    ...base,
    cornersSquareOptions: { color: "#000", shape: { type: "figure", path: "classy" }, isSingle: true },
    cornersDotOptions: { color: "#000", shape: { type: "figure", path: "classy" }, isSingle: true },
  });
  fs.writeFileSync("out-isingle-true.svg", r1.svg);

  const r2 = await QRCodeGenerate({
    ...base,
    cornersSquareOptions: { color: "#000", shape: { type: "figure", path: "classy" }, isSingle: false },
    cornersDotOptions: { color: "#000", shape: { type: "figure", path: "classy" }, isSingle: false },
  });
  fs.writeFileSync("out-isingle-false.svg", r2.svg);

  // Extract cornerSquare mask path
  const sqTrue = r1.svg.match(/id="mask-cornerSquare"[\s\S]*?<\/mask>/)?.[0] ?? "";
  const sqFalse = r2.svg.match(/id="mask-cornerSquare"[\s\S]*?<\/mask>/)?.[0] ?? "";
  const dotTrue = r1.svg.match(/id="mask-cornerDot"[\s\S]*?<\/mask>/)?.[0] ?? "";
  const dotFalse = r2.svg.match(/id="mask-cornerDot"[\s\S]*?<\/mask>/)?.[0] ?? "";

  // Count subpaths (ZM = next sub-path in one big path, or M for first)
  const countSubPaths = (maskHtml) => {
    const d = maskHtml.match(/d="([^"]*)"/)?.[1] ?? "";
    return (d.match(/M /g) || []).length;
  };

  console.log("cornerSquare isSingle:true  subpaths:", countSubPaths(sqTrue));
  console.log("cornerSquare isSingle:false subpaths:", countSubPaths(sqFalse));
  console.log("cornerDot    isSingle:true  subpaths:", countSubPaths(dotTrue));
  console.log("cornerDot    isSingle:false subpaths:", countSubPaths(dotFalse));

  console.log("\n--- cornerDot mask isSingle:true (first 200 chars) ---");
  console.log(dotTrue.slice(0, 200));
  console.log("\n--- cornerDot mask isSingle:false (first 200 chars) ---");
  console.log(dotFalse.slice(0, 200));

  console.log("\nFiles written: out-isingle-true.svg / out-isingle-false.svg");
}

run().catch(console.error);
