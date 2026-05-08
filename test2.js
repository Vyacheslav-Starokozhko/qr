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
    data: "http://localhost:3000/",
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
        path: "extra-rounded",
      },
      overlays: [
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "linear",
              rotation: 135,
              colorStops: [
                {
                  offset: "0%",
                  color: "#005c5c",
                },
                {
                  offset: "50%",
                  color: "#473f00",
                },
                {
                  offset: "100%",
                  color: "#0c003d",
                },
              ],
            },
          },
        },
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "linear",
              rotation: 45,
              colorStops: [
                {
                  offset: "0%",
                  color: "#695802",
                },
                {
                  offset: "50%",
                  color: "#704700",
                },
                {
                  offset: "100%",
                  color: "#545502",
                },
              ],
            },
          },
          mask: {
            type: "stripe",
            scale: 0.8775808894541114,
            angle: 135,
          },
          opacity: 0.6945245721377432,
        },
      ],
    },
    backgroundOptions: {
      color: "#f7eef1",
    },
    cornersSquareOptions: {
      color: "#000000",
      shape: {
        type: "icon",
        path: "outer-eye-heart",
      },
      overlays: [
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "linear",
              rotation: 90,
              colorStops: [
                {
                  offset: "0%",
                  color: "#570b89",
                },
                {
                  offset: "100%",
                  color: "#03401c",
                },
              ],
            },
          },
        },
        {
          fill: {
            type: "color",
            color: "#025038",
          },
          mask: {
            type: "checker",
            scale: 2.1106913244817407,
          },
          opacity: 0.5515477388631552,
        },
      ],
    },
    cornersDotOptions: {
      color: "#000000",
      shape: {
        type: "figure",
        path: "dots",
      },
      overlays: [
        {
          fill: {
            type: "color",
            color: "#677e01",
          },
        },
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "linear",
              rotation: 270,
              colorStops: [
                {
                  offset: "0%",
                  color: "#288f00",
                },
                {
                  offset: "50%",
                  color: "#461801",
                },
                {
                  offset: "100%",
                  color: "#025047",
                },
              ],
            },
          },
          mask: {
            type: "wave",
            scale: 0.9735585900489241,
          },
          opacity: 0.4184532623272389,
        },
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "linear",
              rotation: 315,
              colorStops: [
                {
                  offset: "0%",
                  color: "#044281",
                },
                {
                  offset: "100%",
                  color: "#84230b",
                },
              ],
            },
          },
          mask: {
            type: "checker",
            scale: 1.5742429345846176,
          },
          opacity: 0.4867649580352008,
        },
      ],
    },
    borderRadius: 50,
    decorations: [
      {
        shape: "triangle",
        color: "#35031d",
        placement: "left",
        size: 0.3728400165680796,
        opacity: 0.4345249963458627,
        seed: 38456,
      },
      {
        shape: "ring",
        color: "#648806",
        placement: "top",
        size: 0.37770345057360827,
        opacity: 0.3609117477200925,
        seed: -1640503234,
      },
    ],
    effects: [
      {
        type: "morphology",
        target: "dots",
        operator: "erode",
        radius: 0.07594069040380419,
      },
    ],
    animation: [
      {
        type: "pulse",
        target: "dots",
        duration: 3.64,
        delay: 0,
      },
      {
        type: "draw",
        direction: "ltr",
        duration: 3.64,
        delay: 0,
      },
      {
        type: "glow",
        color: "#b336dd",
        intensity: 3.136963554425165,
        duration: 3.17,
        delay: 0.36,
      },
    ],
  });

  fs.writeFileSync("decDots2.svg", decDots2);
  console.log(`Frame: ${frameWidth}x${frameHeight}`);
})();
