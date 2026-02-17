import { generateSVG } from "./dist/index.js";
import fs from "fs";

const path1 =
  "M15.029 34.623c.521.266.399 1.034-.178 1.143a12.592 12.592 0 0 1-6.551-.472C3.466 33.608 0 29.065 0 23.719V13.291c0-1.482 1.012-2.783 2.466-3.17l5.055-1.336a.623.623 0 0 1 .785.592v14.335c0 4.742 2.73 8.86 6.729 10.905l-.006.006ZM24.905 35.295a12.52 12.52 0 0 0 4.153-2.431c2.546-2.244 4.147-5.516 4.147-9.152V4.521c0-1.488 1.012-2.782 2.466-3.17l5.054-1.33a.623.623 0 0 1 .786.593v23.104c0 5.347-3.466 9.89-8.3 11.577-1.3.454-2.693.702-4.153.702-1.46 0-2.852-.248-4.147-.696l-.006-.006Z"; // ...shortened
const path2 =
  "M24.906 35.295a12.548 12.548 0 0 1-4.153-2.425c-2.545-2.244-4.152-5.517-4.152-9.152V8.906c0-1.482 1.012-2.782 2.466-3.17L24.12 4.4a.623.623 0 0 1 .785.592v18.72c0 3.635 1.608 6.901 4.153 9.152a12.564 12.564 0 0 1-4.153 2.431Z"; // ...shortened
const fullWLogo = path1 + " " + path2; // Just concatenating

const svg = generateSVG({
  text: "https://github.com",
  shape: "custom-icon",
  color: "#000000",
  bgColor: "#FFFFFF",
  padding: 2,
  customIconPath: fullWLogo,
  customIconViewBox: "0 0 41 36",
});

console.log("Done!");

fs.writeFileSync("output.svg", svg);
