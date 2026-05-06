import { QRCodeGenerate, analyzeFrame } from "./dist/index.js";
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

async function getFrameDisplayDimensions(relativePath, maxSize = 1000) {
  const { default: sharp } = await import("sharp");
  const absolutePath = path.resolve(relativePath);
  const { width, height } = await sharp(absolutePath).metadata();
  const scale = maxSize / Math.max(width, height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

const framePath = "assets/frames/f4.png";
const frameImg = fileToDataURI(framePath);
const placeholderImg = fileToDataURI("assets/placeholder.png");
const bg1Img = fileToDataURI("assets/bg/bg1.jpg");

(async () => {
  const { width: frameWidth, height: frameHeight } =
    await getFrameDisplayDimensions(framePath);

  const { svg: decDots2 } = await QRCodeGenerate({
    width: 362,
    height: 362,
    data: "fgdgffgdg",
    margin: 5,
    backgroundEnable: false,
    imageEnable: false,
    qrOptions: {
      typeNumber: 0,
      mode: "Byte",
      errorCorrectionLevel: "H",
    },
    dotsOptions: {
      color: "#000000",
    },
    backgroundOptions: {
      color: "#cba9ab",
    },
    cornersSquareOptions: {
      color: "#c00300",
    },
    cornersDotOptions: {
      color: "#000000",
    },
    frame: {
      source: frameImg,
      width: frameWidth,
      height: frameHeight,
    },
  });

  fs.writeFileSync("decDots2.svg", decDots2);
  console.log(`Frame: ${frameWidth}x${frameHeight}`);
})();
