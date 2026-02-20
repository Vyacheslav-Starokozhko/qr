import { QRCodeGenerate } from "./dist/index.js";
import fs from "fs";
import path from "path";

function fileToDataURI(relativePath) {
  const absolutePath = path.resolve(relativePath);
  const ext = path.extname(absolutePath).slice(1).toLowerCase();
  const mimeMap = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
  };
  const mime = mimeMap[ext] || "application/octet-stream";
  const data = fs.readFileSync(absolutePath).toString("base64");
  return `data:${mime};base64,${data}`;
}

const placeholderImg = fileToDataURI("assets/placeholder.png");
const frameImg = fileToDataURI("assets/frames/frame.png");
const bg1Img = fileToDataURI("assets/bg/bg1.jpg");

const path1 =
  "M15.029 34.623c.521.266.399 1.034-.178 1.143a12.592 12.592 0 0 1-6.551-.472C3.466 33.608 0 29.065 0 23.719V13.291c0-1.482 1.012-2.783 2.466-3.17l5.055-1.336a.623.623 0 0 1 .785.592v14.335c0 4.742 2.73 8.86 6.729 10.905l-.006.006ZM24.905 35.295a12.52 12.52 0 0 0 4.153-2.431c2.546-2.244 4.147-5.516 4.147-9.152V4.521c0-1.488 1.012-2.782 2.466-3.17l5.054-1.33a.623.623 0 0 1 .786.593v23.104c0 5.347-3.466 9.89-8.3 11.577-1.3.454-2.693.702-4.153.702-1.46 0-2.852-.248-4.147-.696l-.006-.006Z"; // ...shortened
const path2 =
  "M24.906 35.295a12.548 12.548 0 0 1-4.153-2.425c-2.545-2.244-4.152-5.517-4.152-9.152V8.906c0-1.482 1.012-2.782 2.466-3.17L24.12 4.4a.623.623 0 0 1 .785.592v18.72c0 3.635 1.608 6.901 4.153 9.152a12.564 12.564 0 0 1-4.153 2.431Z"; // ...shortened
const fullWLogo = path1 + " " + path2; // Just concatenating

(async () => {
  const {
    svg: svgWithFrame,
    matrixSize,
    eyeZones,
    getMaxPos,
  } = await QRCodeGenerate({
    data: "https://wiki.org",
    margin: 1,
    width: 500,
    height: 500,
    borderRadius: 10,
    frame: {
      source: frameImg,
      width: 1000,
      height: 1000,
      inset: { width: 500, height: 500 },
    },
    // --- Background ---
    background: {
      // Dark background so white dots are visible
      color: "#1a1a2e",
      // Uncomment to use a full-bleed background image instead:
      image: bg1Img,
      // gradient: {
      //   type: "linear",
      //   rotation: 90,
      //   colorStops: [
      //     { offset: "0%", color: "#021ffa" },
      //     { offset: "100%", color: "#ed0909" },
      //   ],
      // },
    },

    // --- Images overlaid INSIDE the QR code (logos, icons, etc.) ---
    // Multiple images are supported. Use excludeDots:true to clear dots underneath.
    // Coordinates are in QR modules (same unit as the matrix grid).
    images: [
      {
        // Center logo — inline SVG data URI (works without network)
        // A simple WiFi icon as SVG data URI
        source:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%2316213e'/%3E%3Cpath d='M12 15.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm0-4a5.5 5.5 0 0 1 4.95 3.07l-1.6 1.6A3.5 3.5 0 0 0 12 14a3.5 3.5 0 0 0-3.35 2.17l-1.6-1.6A5.5 5.5 0 0 1 12 11.5zm0-4a9.5 9.5 0 0 1 8.49 5.24l-1.6 1.6A7.5 7.5 0 0 0 12 10a7.5 7.5 0 0 0-6.89 4.34l-1.6-1.6A9.5 9.5 0 0 1 12 7.5z' fill='%2300d4ff'/%3E%3C/svg%3E",
        width: 5,
        height: 5,
        excludeDots: true,
      },
      // Second image — also inline SVG (a small star badge)
      {
        source:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23edf505'/%3E%3Cpolygon points='12,4 14.5,9.5 21,10.3 16.5,14.6 17.8,21 12,17.8 6.2,21 7.5,14.6 3,10.3 9.5,9.5' fill='%231a1a2e'/%3E%3C/svg%3E",
        width: 3,
        height: 3,
        excludeDots: true,
      },
      {
        source:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23edf505'/%3E%3Cpolygon points='12,4 14.5,9.5 21,10.3 16.5,14.6 17.8,21 12,17.8 6.2,21 7.5,14.6 3,10.3 9.5,9.5' fill='%231a1a2e'/%3E%3C/svg%3E",
        width: 3,
        height: 3,
        excludeDots: true,
      },
      {
        source:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23edf505'/%3E%3Cpolygon points='12,4 14.5,9.5 21,10.3 16.5,14.6 17.8,21 12,17.8 6.2,21 7.5,14.6 3,10.3 9.5,9.5' fill='%231a1a2e'/%3E%3C/svg%3E",
        width: 3,
        height: 3,
        excludeDots: true,
      },
      {
        // Center logo — inline SVG data URI (works without network)
        // A simple WiFi icon as SVG data URI
        source:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%2316213e'/%3E%3Cpath d='M12 15.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm0-4a5.5 5.5 0 0 1 4.95 3.07l-1.6 1.6A3.5 3.5 0 0 0 12 14a3.5 3.5 0 0 0-3.35 2.17l-1.6-1.6A5.5 5.5 0 0 1 12 11.5zm0-4a9.5 9.5 0 0 1 8.49 5.24l-1.6 1.6A7.5 7.5 0 0 0 12 10a7.5 7.5 0 0 0-6.89 4.34l-1.6-1.6A9.5 9.5 0 0 1 12 7.5z' fill='%2300d4ff'/%3E%3C/svg%3E",
        width: 5,
        height: 5,
        x: 18,
        y: 20,
        excludeDots: true,
      },
    ],

    // 1. DOTS — use a simple square type with visible color
    dotsOptions: {
      // type: "square",
      color: "#e0e0e0",
      scale: 0.85,
      // To use custom-icon type, uncomment below and comment out type/color above:
      type: "qr-duck",
      // color: "white",
    },

    // 2. CORNER SQUARE (outer eye frame)
    cornersSquareOptions: {
      type: "dots-extra-rounded",
      color: "black",
      gradient: {
        type: "linear",
        rotation: 180,
        colorStops: [
          { offset: "0%", color: "#EEAECA" },
          { offset: "100%", color: "#00D4FF" },
        ],
      },
    },

    // 3. CORNER DOT (inner eye ball)
    cornersDotOptions: {
      type: "",
      // customIconPath: fullWLogo,
      // customIconViewBox: "0 0 41 36",
      gradient: {
        type: "linear",
        rotation: 90,
        colorStops: [
          { offset: "0%", color: "#edf505" },
          { offset: "100%", color: "#1aebd9" },
        ],
      },
      isSingle: true,
      scale: 1.2,
    },
  });
  fs.writeFileSync("output-frame.svg", svgWithFrame);
  console.log(
    `Frame demo written to output-frame.svg (matrixSize: ${matrixSize})`,
  );
  console.log("Eye zones:", JSON.stringify(eyeZones));
  console.log("Max pos for 5x5 image:", getMaxPos(5, 5));
})();
