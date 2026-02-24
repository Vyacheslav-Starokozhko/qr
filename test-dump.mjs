import fs from "fs";

const t = fs.readFileSync("out-isingle-true.svg", "utf8");
const f = fs.readFileSync("out-isingle-false.svg", "utf8");

const getSqMask = (s) => {
  const m = s.match(/id="mask-cornerSquare"[\s\S]*?<\/mask>/);
  return m ? m[0].substring(0, 400) : "NOT FOUND";
};
const getDotMask = (s) => {
  const m = s.match(/id="mask-cornerDot"[\s\S]*?<\/mask>/);
  return m ? m[0].substring(0, 400) : "NOT FOUND";
};

console.log("=== isSingle:TRUE  cornerSquare mask ===");
console.log(getSqMask(t));
console.log("\n=== isSingle:FALSE cornerSquare mask ===");
console.log(getSqMask(f));
console.log("\n=== isSingle:TRUE  cornerDot mask ===");
console.log(getDotMask(t));
console.log("\n=== isSingle:FALSE cornerDot mask ===");
console.log(getDotMask(f));
