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
  // --- Decoration showcase: dots scattered in the margin ---
  const { svg: decDots } = await QRCodeGenerate({
    data: "https://example.com",
    margin: 4,
    width: 500,
    height: 500,
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: {
      shape: { type: "figure", path: "square" },
      color: "#000000",
    },
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
    decorations: [
      {
        shape: "dot",
        color: "#e74c3c",
        size: 0.7,
        opacity: 0.9,
        placement: "scatter",
        seed: 1,
      },
    ],
  });

  // --- Decoration showcase: stars + rings in margin (circle QR) ---
  const { svg: decStars } = await QRCodeGenerate({
    data: "https://example.com",
    margin: 8,
    width: 500,
    height: 500,
    borderRadius: 100,
    backgroundOptions: { color: "#1a1a2e" },
    dotsOptions: {
      shape: { type: "figure", path: "square" },
      color: "#ffffff",
    },
    cornersSquareOptions: {
      shape: { type: "figure", path: "square" },
      color: "#00d4ff",
      isSingle: true,
    },
    cornersDotOptions: {
      shape: { type: "figure", path: "square" },
      color: "#00d4ff",
      isSingle: true,
    },
    decorations: [
      {
        shape: "star",
        color: "#ffd700",
        size: 0.9,
        opacity: 0.85,
        placement: "scatter",
        seed: 7,
      },
      {
        shape: "ring",
        color: "#00d4ff",
        size: 0.55,
        opacity: 0.5,
        placement: "scatter",
        seed: 99,
      },
    ],
  });

  // --- Decoration showcase: icon shape (heart from icon registry) ---
  const { svg: decIconHeart } = await QRCodeGenerate({
    data: "https://example.com",
    margin: 5,
    width: 500,
    height: 500,
    borderRadius: 20,
    backgroundOptions: { color: "#fff0f3" },
    dotsOptions: {
      shape: { type: "figure", path: "dots" },
      color: "#c0392b",
    },
    cornersSquareOptions: {
      shape: { type: "figure", path: "extra-rounded" },
      color: "#c0392b",
      isSingle: true,
    },
    cornersDotOptions: {
      shape: { type: "figure", path: "dot" },
      color: "#c0392b",
      isSingle: true,
    },
    decorations: [
      {
        // Use any icon from the built-in shape registry — same keys as dot shapes
        shape: { type: "icon", path: "heart" },
        color: "#e74c3c",
        size: 1.0,
        opacity: 0.7,
        placement: "scatter",
        seed: 3,
      },
      {
        shape: { type: "icon", path: "heart" },
        color: "#ff6b81",
        size: 0.5,
        opacity: 0.45,
        placement: "scatter",
        seed: 77,
      },
    ],
  });

  // --- Decoration showcase: custom SVG path ---
  const customArrowPath =
    "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"; // layered chevron
  const { svg: decCustomPath } = await QRCodeGenerate({
    data: "https://example.com",
    margin: 5,
    width: 500,
    height: 500,
    borderRadius: 10,
    backgroundOptions: { color: "#f0f4ff" },
    dotsOptions: {
      shape: { type: "figure", path: "square" },
      color: "#2d3436",
    },
    cornersSquareOptions: {
      shape: { type: "figure", path: "square" },
      color: "#0984e3",
      isSingle: true,
    },
    cornersDotOptions: {
      shape: { type: "figure", path: "square" },
      color: "#0984e3",
      isSingle: true,
    },
    decorations: [
      {
        // Provide your own SVG path data — same viewBox system as QR icons
        shape: {
          type: "custom-path",
          d: customArrowPath,
          viewBox: "0 0 24 24",
        },
        color: "#0984e3",
        size: 0.8,
        opacity: 0.6,
        placement: "scatter",
        seed: 21,
      },
    ],
  });

  // --- Decoration showcase: borderRadius corners filled with diamonds ---
  const { svg: decRounded } = await QRCodeGenerate({
    data: "https://example.com",
    margin: 3,
    borderRadius: 30,
    width: 500,
    height: 500,
    backgroundOptions: { color: "#fff" },
    dotsOptions: {
      shape: { type: "figure", path: "rounded" },
      color: "#333",
    },
    cornersSquareOptions: {
      shape: { type: "figure", path: "extra-rounded" },
      color: "#e74c3c",
      isSingle: true,
    },
    cornersDotOptions: {
      shape: { type: "figure", path: "dot" },
      color: "#e74c3c",
      isSingle: true,
    },
    decorations: [
      {
        shape: "diamond",
        color: "#e74c3c",
        size: 0.65,
        opacity: 0.7,
        placement: "scatter",
        seed: 42,
      },
    ],
  });

  // --- Decoration showcase: corner-only stars for borderRadius QR ---
  const { svg: decCornerStars } = await QRCodeGenerate({
    data: "https://example.com",
    margin: 5,
    borderRadius: 50,
    width: 500,
    height: 500,
    backgroundOptions: { color: "#fff8f0" },
    dotsOptions: {
      shape: { type: "figure", path: "classy-rounded" },
      color: "#2d3436",
    },
    cornersSquareOptions: {
      shape: { type: "figure", path: "extra-rounded" },
      color: "#6c5ce7",
      isSingle: true,
    },
    cornersDotOptions: {
      shape: { type: "figure", path: "dot" },
      color: "#6c5ce7",
      isSingle: true,
    },
    decorations: [
      {
        shape: "star4",
        color: "#6c5ce7",
        size: 1.1,
        opacity: 0.8,
        placement: "corners",
        seed: 12,
      },
      {
        shape: "dot",
        color: "#fd79a8",
        size: 0.45,
        opacity: 0.6,
        placement: "edges",
        seed: 55,
      },
    ],
  });

  fs.writeFileSync("dec_dots.svg", decDots);
  fs.writeFileSync("dec_stars.svg", decStars);
  fs.writeFileSync("dec_rounded.svg", decRounded);
  fs.writeFileSync("dec_corner_stars.svg", decCornerStars);
  fs.writeFileSync("dec_icon_heart.svg", decIconHeart);
  fs.writeFileSync("dec_custom_path.svg", decCustomPath);

  // --- Rounded labels: top + bottom arcs hugging the outer frame circle ---
  const { svg: labelRounded } = await QRCodeGenerate({
    data: "https://wiki.org",
    margin: 15,
    width: 500,
    height: 500,
    borderRadius: 100,
    frame: {
      source: frameImg,
      width: 1000,
      height: 1000,
      inset: { width: 500, height: 500 },
      // Use `labels` array for multiple arc texts
      labels: [
        {
          text: "SEE WHY IT'S SUPER",
          style: "rounded", // top arc (default when no position given)
          fontFamily: "Arial, sans-serif",
          fontWeight: 700,
          fontColor: "#ffffff",
          margin: 20,
        },
        {
          text: "SCAN ME",
          style: "rounded",
          position: "bottom", // bottom arc
          fontFamily: "Arial, sans-serif",
          fontWeight: 700,
          fontColor: "#ffffff",
          margin: 20,
        },
      ],
    },
    backgroundOptions: { color: "#1a1a2e" },
    images: [],
    dotsOptions: {
      shape: { type: "figure", path: "square" },
      color: "#ffffff",
    },
    cornersSquareOptions: {
      shape: { type: "figure", path: "square" },
      color: "#00d4ff",
      isSingle: true,
    },
    cornersDotOptions: {
      shape: { type: "figure", path: "square" },
      color: "#00d4ff",
      isSingle: true,
    },
  });

  // --- Rounded labels: gradient arc background ---
  const { svg: labelRoundedGrad } = await QRCodeGenerate({
    data: "https://wiki.org",
    margin: 18,
    width: 500,
    height: 500,
    borderRadius: 100,
    frame: {
      source: frameImg,
      width: 1000,
      height: 1000,
      inset: { width: 500, height: 500 },
      labels: [
        {
          text: "TURN YOUR CODE",
          style: "rounded",
          fontFamily: "Arial, sans-serif",
          fontWeight: 700,
          fontColor: "#ffffff",
          fontBackgroundGradient: {
            type: "linear",
            rotation: 90,
            colorStops: [
              { offset: "0%", color: "#6c5ce7" },
              { offset: "100%", color: "#000000" },
            ],
          },
          margin: 20,
        },
        {
          text: "INTO REVENUE",
          style: "rounded",
          position: "bottom",
          fontFamily: "Arial, sans-serif",
          fontWeight: 700,
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
      ],
    },
    backgroundOptions: { color: "#1a1a2e" },
    images: [],
    dotsOptions: {
      shape: { type: "figure", path: "square" },
      color: "#ffffff",
    },
    cornersSquareOptions: {
      shape: { type: "figure", path: "square" },
      color: "#6c5ce7",
      isSingle: true,
    },
    cornersDotOptions: {
      shape: { type: "figure", path: "square" },
      color: "#6c5ce7",
      isSingle: true,
    },
  });

  fs.writeFileSync("label_rounded.svg", labelRounded);
  fs.writeFileSync("label_rounded_grad.svg", labelRoundedGrad);

  const { svg: svgWithFrame } = await QRCodeGenerate({
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
      label: {
        text: "SCAN ME",
        position: "top",
        fontFamily: "Arial, sans-serif",
        fontWeight: 700,
        fontColor: "#ffffff",
        fontBackgroundColor: "#1a1a2e",
        margin: 12,
      },
    },
    // --- Background ---
    backgroundOptions: {
      // Dark background so white dots are visible
      color: "#fff",
      // Uncomment to use a full-bleed background image instead:
      // image: bg1Img,
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
        position: { type: "center" },
      },
      // Second image — also inline SVG (a small star badge)
      // {
      //   source:
      //     "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23edf505'/%3E%3Cpolygon points='12,4 14.5,9.5 21,10.3 16.5,14.6 17.8,21 12,17.8 6.2,21 7.5,14.6 3,10.3 9.5,9.5' fill='%231a1a2e'/%3E%3C/svg%3E",
      //   width: 3,
      //   height: 3,
      //   excludeDots: true,
      //   position: { type: "extra-top" },
      // },
      // {
      //   source:
      //     "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23edf505'/%3E%3Cpolygon points='12,4 14.5,9.5 21,10.3 16.5,14.6 17.8,21 12,17.8 6.2,21 7.5,14.6 3,10.3 9.5,9.5' fill='%231a1a2e'/%3E%3C/svg%3E",
      //   width: 3,
      //   height: 3,
      //   excludeDots: true,
      //   margin: 0,
      //   position: { type: "extra-bottom" },
      // },
      // {
      //   source:
      //     "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23edf505'/%3E%3Cpolygon points='12,4 14.5,9.5 21,10.3 16.5,14.6 17.8,21 12,17.8 6.2,21 7.5,14.6 3,10.3 9.5,9.5' fill='%231a1a2e'/%3E%3C/svg%3E",
      //   width: 3,
      //   height: 3,
      //   excludeDots: true,
      //   margin: 0,
      //   position: { type: "extra-left" },
      // },
      // {
      //   source:
      //     "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23edf505'/%3E%3Cpolygon points='12,4 14.5,9.5 21,10.3 16.5,14.6 17.8,21 12,17.8 6.2,21 7.5,14.6 3,10.3 9.5,9.5' fill='%231a1a2e'/%3E%3C/svg%3E",
      //   width: 3,
      //   height: 3,
      //   excludeDots: true,
      //   margin: 0,
      //   position: { type: "extra-right" },
      // },

      {
        source:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23edf505'/%3E%3Cpolygon points='12,4 14.5,9.5 21,10.3 16.5,14.6 17.8,21 12,17.8 6.2,21 7.5,14.6 3,10.3 9.5,9.5' fill='%231a1a2e'/%3E%3C/svg%3E",
        width: 3,
        height: 3,
        excludeDots: true,
        position: { type: "top" },
      },
      {
        source:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23edf505'/%3E%3Cpolygon points='12,4 14.5,9.5 21,10.3 16.5,14.6 17.8,21 12,17.8 6.2,21 7.5,14.6 3,10.3 9.5,9.5' fill='%231a1a2e'/%3E%3C/svg%3E",
        width: 3,
        height: 3,
        excludeDots: true,
        margin: 0,
        position: { type: "bottom" },
      },
      {
        source:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23edf505'/%3E%3Cpolygon points='12,4 14.5,9.5 21,10.3 16.5,14.6 17.8,21 12,17.8 6.2,21 7.5,14.6 3,10.3 9.5,9.5' fill='%231a1a2e'/%3E%3C/svg%3E",
        width: 3,
        height: 3,
        excludeDots: true,
        margin: 0,
        position: { type: "left" },
      },
      {
        source:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23edf505'/%3E%3Cpolygon points='12,4 14.5,9.5 21,10.3 16.5,14.6 17.8,21 12,17.8 6.2,21 7.5,14.6 3,10.3 9.5,9.5' fill='%231a1a2e'/%3E%3C/svg%3E",
        width: 3,
        height: 3,
        excludeDots: true,
        margin: 0,
        position: { type: "right" },
      },
      {
        source:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='12' fill='%23edf505'/%3E%3Cpolygon points='12,4 14.5,9.5 21,10.3 16.5,14.6 17.8,21 12,17.8 6.2,21 7.5,14.6 3,10.3 9.5,9.5' fill='%231a1a2e'/%3E%3C/svg%3E",
        width: 3,
        height: 3,
        excludeDots: false,
        position: { type: "custom", x: 24, y: 24 },
        margin: 0,
      },
    ],

    // 1. DOTS
    dotsOptions: {
      shape: {
        type: "figure",
        path: "square",
      },
      color: "#000000",
      // scale: 1.6,
    },

    // 2. CORNER SQUARE (outer eye frame)
    cornersSquareOptions: {
      shape: { type: "figure", path: "square" },
      color: "black",
      isSingle: true,
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
      shape: { type: "icon", path: "inner-eye-dots" },
      // Example custom-icon:
      // shape: { type: "custom-icon", path: fullWLogo, viewBox: "0 0 41 36" },
      gradient: {
        type: "linear",
        rotation: 90,
        colorStops: [
          { offset: "0%", color: "#edf505" },
          { offset: "100%", color: "#1aebd9" },
        ],
      },
      isSingle: false,
      scale: 1.2,
    },
  });

  const { svg: heart } = await QRCodeGenerate({
    width: 362,
    height: 362,
    images: [],
    margin: 1,
    dotsOptions: {
      color: "#000000",

      shape: {
        type: "icon",
        path: "heart",
      },
    },
    backgroundOptions: {
      color: "#ffffff",
    },
    cornersSquareOptions: {
      color: "#000000",
      shape: {
        type: "icon",
        path: "outer-eye-extra-rounded",
      },
      isSingle: true,
    },
    cornersDotOptions: {
      color: "#000000",
      shape: {
        type: "icon",
        path: "heart",
      },
      isSingle: true,
    },
    data: "https://qr-code-builder.vercel.app",
  });
  const { svg: heart2 } = await QRCodeGenerate({
    width: 362,
    height: 362,
    images: [],
    margin: 1,
    dotsOptions: {
      color: "#000000",

      shape: {
        type: "icon",
        path: "heart2",
      },
    },
    backgroundOptions: {
      color: "#ffffff",
    },
    cornersSquareOptions: {
      color: "#000000",
      shape: {
        type: "icon",
        path: "outer-eye-extra-rounded",
      },
      isSingle: true,
    },
    cornersDotOptions: {
      color: "#000000",
      shape: {
        type: "icon",
        path: "heart2",
      },
      isSingle: true,
    },
    data: "https://qr-code-builder.vercel.app",
  });
  const { svg: star } = await QRCodeGenerate({
    width: 362,
    height: 362,
    images: [],
    margin: 1,
    dotsOptions: {
      color: "#000000",

      shape: {
        type: "icon",
        path: "star",
      },
    },
    backgroundOptions: {
      color: "#ffffff",
    },
    cornersSquareOptions: {
      color: "#000000",
      shape: {
        type: "icon",
        path: "outer-eye-extra-rounded",
      },
      isSingle: true,
    },
    cornersDotOptions: {
      color: "#000000",
      shape: {
        type: "icon",
        path: "star",
      },
      isSingle: true,
    },
    data: "https://qr-code-builder.vercel.app",
  });
  const { svg: star2 } = await QRCodeGenerate({
    width: 362,
    height: 362,
    images: [],
    margin: 1,
    dotsOptions: {
      color: "#000000",

      shape: {
        type: "icon",
        path: "star2",
      },
    },
    backgroundOptions: {
      color: "#ffffff",
    },
    cornersSquareOptions: {
      color: "#000000",
      shape: {
        type: "icon",
        path: "outer-eye-extra-rounded",
      },
      isSingle: true,
    },
    cornersDotOptions: {
      color: "#000000",
      shape: {
        type: "icon",
        path: "star2",
      },
      isSingle: true,
    },
    data: "https://qr-code-builder.vercel.app",
  });

  const { svg: heart3 } = await QRCodeGenerate({
    width: 362,
    height: 362,
    images: [],
    margin: 1,
    dotsOptions: {
      color: "#000000",
      gradient: {
        type: "linear",
        rotation: 0,
        colorStops: [
          {
            offset: "0",
            color: "#000000",
          },
          {
            offset: "1",
            color: "#000000",
          },
        ],
      },
      shape: {
        type: "figure",
        path: "classy-rounded",
      },
      scale: 1,
    },
    backgroundOptions: {
      color: "rgba(255, 255, 255, 0)",
    },
    cornersSquareOptions: {
      color: "#000000",
      shape: {
        type: "figure",
        path: "dots",
      },
      isSingle: false,
      scale: 1,
    },
    cornersDotOptions: {
      color: "#000000",
      shape: {
        type: "figure",
        path: "dots",
      },
      isSingle: false,
      scale: 1,
    },
    data: "https://qr-code-builder.vercel.app",
  });

  const { svg: gradientQR } = await QRCodeGenerate({
    width: 362,
    height: 362,
    images: [],
    margin: 1,
    dotsOptions: {
      color: "#000000",
      gradient: {
        type: "linear",
        rotation: 0,
        colorStops: [
          {
            offset: "0",
            color: "#000000",
          },
          {
            offset: "1",
            color: "#000000",
          },
        ],
      },
      shape: {
        type: "figure",
        path: "dots",
      },
      scale: 1,
    },
    backgroundOptions: {
      gradient: {
        type: "radial",
        rotation: 0,
        colorStops: [
          {
            color: "rgba(255,161,8,1)",
            offset: "0.29",
          },
          {
            color: "rgba(61,104,129,1)",
            offset: "0.74",
          },
          {
            color: "rgba(71,123,164,0.286)",
            offset: "0.99",
          },
        ],
      },
    },
    cornersSquareOptions: {
      color: "#000000",
      shape: {
        type: "figure",
        path: "extra-rounded",
      },
    },
    cornersDotOptions: {
      color: "#000000",
      shape: {
        type: "icon",
        path: "star2",
      },
      isSingle: true,
    },
    data: "dsadasd",
    borderRadius: 50,
  });

  const { svg: gradientQR2 } = await QRCodeGenerate({
    width: 362,
    height: 362,
    images: [],
    margin: 1,
    dotsOptions: {
      color: "#000000",
      gradient: {
        type: "linear",
        rotation: 0,
        colorStops: [
          {
            offset: "0",
            color: "#000000",
          },
          {
            offset: "1",
            color: "#000000",
          },
        ],
      },
      shape: {
        type: "figure",
        path: "dots",
      },
      scale: 1,
    },
    backgroundOptions: {
      gradient: {
        type: "linear",
        rotation: 90,
        colorStops: [
          {
            color: "rgba(255,161,8,1)",
            offset: "0.29",
          },
          {
            color: "rgba(61,104,129,1)",
            offset: "0.74",
          },
          {
            color: "rgba(71,123,164,0.286)",
            offset: "0.99",
          },
        ],
      },
    },
    cornersSquareOptions: {
      color: "#000000",
      shape: {
        type: "figure",
        path: "extra-rounded",
      },
    },
    cornersDotOptions: {
      color: "#000000",
      shape: {
        type: "icon",
        path: "star2",
      },
      isSingle: true,
    },
    data: "dsadsa",
    borderRadius: 50,
  });

  fs.writeFileSync("star2.svg", star2);
  fs.writeFileSync("star.svg", star);
  fs.writeFileSync("heart2.svg", heart2);
  fs.writeFileSync("heart.svg", heart);
  fs.writeFileSync("svgWithFrame.svg", svgWithFrame);
  fs.writeFileSync("heart3.svg", heart3);
  fs.writeFileSync("gradientQR.svg", gradientQR);
  fs.writeFileSync("gradientQR2.svg", gradientQR2);
})();
