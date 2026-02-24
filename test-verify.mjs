import fs from "fs";

const svg = fs.readFileSync("out-isingle-false.svg", "utf8");

const check = (maskId, label) => {
  const mask = svg.match(new RegExp(`id="${maskId}"[\\s\\S]*?<\\/mask>`))?.[0] ?? "";
  const d = mask.match(/<path d="([^"]*)"/)?.[1] ?? "";
  const subPaths = d.trim().split(/(?=M )/).filter(Boolean);
  const shapeOnly = (p) => p.replace(/[-\d.]+/g, "N").trim();
  const unique = new Set(subPaths.map(shapeOnly));
  console.log(`${label}: ${subPaths.length} subpaths, ${unique.size} unique shape(s)`);
  unique.forEach(s => console.log(`  Shape: ${s.substring(0, 100)}`));
};

check("mask-cornerSquare", "isSingle:false cornerSquare");
check("mask-cornerDot",    "isSingle:false cornerDot   ");

const svgT = fs.readFileSync("out-isingle-true.svg", "utf8");
const checkT = (maskId, label) => {
  const mask = svgT.match(new RegExp(`id="${maskId}"[\\s\\S]*?<\\/mask>`))?.[0] ?? "";
  const d = mask.match(/<path d="([^"]*)"/)?.[1] ?? "";
  const subPaths = d.trim().split(/(?=M )/).filter(Boolean);
  console.log(`${label}: ${subPaths.length} subpaths (single shapes for 3 eyes)`);
};
checkT("mask-cornerSquare", "isSingle:true  cornerSquare");
checkT("mask-cornerDot",    "isSingle:true  cornerDot   ");
