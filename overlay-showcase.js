import { QRCodeGenerate } from "./dist/index.js";
import fs from "fs";
import path from "path";

const OUT = "svg-output/overlays";
fs.mkdirSync(OUT, { recursive: true });

const URL = "https://example.com";

async function gen(name, options) {
  const { svg } = await QRCodeGenerate({ data: URL, width: 400, height: 400, margin: 3, ...options });
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg);
  console.log(`✓ ${name}`);
  return svg;
}

(async () => {
  // ──────────────────────────────────────────────────────────────
  // 1-5  STRIPE
  // ──────────────────────────────────────────────────────────────

  // 1. Stripe 45° — solid dark teal on white
  await gen("01-stripe-45-solid", {
    backgroundOptions: { color: "#f0fafa" },
    dotsOptions: {
      shape: { type: "figure", path: "square" },
      overlays: [
        { fill: { type: "color", color: "#006d77" } },
        {
          fill: { type: "color", color: "#83c5be" },
          mask: { type: "stripe", angle: 45, scale: 1.2 },
          opacity: 0.85,
        },
      ],
    },
    cornersSquareOptions: { color: "#006d77", shape: { type: "figure", path: "square" } },
    cornersDotOptions: { color: "#006d77", shape: { type: "figure", path: "square" } },
  });

  // 2. Stripe 0° — horizontal, linear gradient fill
  await gen("02-stripe-0-linear-gradient", {
    backgroundOptions: { color: "#1a1a2e" },
    dotsOptions: {
      shape: { type: "figure", path: "dots" },
      overlays: [
        { fill: { type: "color", color: "#e0e0e0" } },
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "linear",
              rotation: 0,
              colorStops: [
                { offset: "0%", color: "#f72585" },
                { offset: "100%", color: "#4cc9f0" },
              ],
            },
          },
          mask: { type: "stripe", angle: 0, scale: 1.0 },
          opacity: 0.9,
        },
      ],
    },
    cornersSquareOptions: { color: "#f72585", shape: { type: "figure", path: "square" } },
    cornersDotOptions: { color: "#4cc9f0", shape: { type: "figure", path: "dot" } },
  });

  // 3. Stripe 90° (vertical) — radial gradient, dark background
  await gen("03-stripe-90-vertical-radial", {
    backgroundOptions: { color: "#0d0d0d" },
    dotsOptions: {
      shape: { type: "figure", path: "classy-rounded" },
      overlays: [
        { fill: { type: "color", color: "#333" } },
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "radial",
              colorStops: [
                { offset: "0%", color: "#ffe600" },
                { offset: "60%", color: "#ff7b00" },
                { offset: "100%", color: "#ff0055" },
              ],
            },
          },
          mask: { type: "stripe", angle: 90, scale: 0.9 },
          opacity: 1.0,
        },
      ],
    },
    cornersSquareOptions: { color: "#ffe600", shape: { type: "figure", path: "extra-rounded" } },
    cornersDotOptions: { color: "#ff0055", shape: { type: "figure", path: "dot" } },
  });

  // 4. Stripe fine (small scale) — purple gradient
  await gen("04-stripe-fine-purple", {
    backgroundOptions: { color: "#f8f0ff" },
    dotsOptions: {
      shape: { type: "figure", path: "rounded" },
      overlays: [
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "linear",
              rotation: 135,
              colorStops: [
                { offset: "0%", color: "#7209b7" },
                { offset: "100%", color: "#3a0ca3" },
              ],
            },
          },
        },
        {
          fill: { type: "color", color: "#c77dff" },
          mask: { type: "stripe", angle: 45, scale: 0.5 },
          opacity: 0.5,
        },
      ],
    },
    cornersSquareOptions: { color: "#7209b7", shape: { type: "figure", path: "extra-rounded" } },
    cornersDotOptions: { color: "#3a0ca3", shape: { type: "figure", path: "dot" } },
  });

  // 5. Stripe bold (large scale) — warm orange
  await gen("05-stripe-bold-orange", {
    backgroundOptions: { color: "#fff8ee" },
    dotsOptions: {
      shape: { type: "figure", path: "extra-rounded" },
      overlays: [
        { fill: { type: "color", color: "#d62828" } },
        {
          fill: { type: "color", color: "#f77f00" },
          mask: { type: "stripe", angle: 45, scale: 2.5 },
          opacity: 0.9,
        },
      ],
    },
    cornersSquareOptions: { color: "#d62828", shape: { type: "figure", path: "square" } },
    cornersDotOptions: { color: "#d62828", shape: { type: "figure", path: "square" } },
  });

  // ──────────────────────────────────────────────────────────────
  // 6-9  ZIGZAG
  // ──────────────────────────────────────────────────────────────

  // 6. Zigzag — solid teal on white
  await gen("06-zigzag-solid-teal", {
    backgroundOptions: { color: "#ffffff" },
    dotsOptions: {
      shape: { type: "figure", path: "square" },
      overlays: [
        { fill: { type: "color", color: "#264653" } },
        {
          fill: { type: "color", color: "#2a9d8f" },
          mask: { type: "zigzag", scale: 1.2 },
          opacity: 0.9,
        },
      ],
    },
    cornersSquareOptions: { color: "#264653", shape: { type: "figure", path: "square" } },
    cornersDotOptions: { color: "#2a9d8f", shape: { type: "figure", path: "dot" } },
  });

  // 7. Zigzag — linear gradient fill, gradient background
  await gen("07-zigzag-linear-gradient", {
    backgroundOptions: {
      gradient: {
        type: "linear",
        rotation: 90,
        colorStops: [
          { offset: "0%", color: "#edf2ff" },
          { offset: "100%", color: "#dbe4ff" },
        ],
      },
    },
    dotsOptions: {
      shape: { type: "figure", path: "rounded" },
      overlays: [
        { fill: { type: "color", color: "#364fc7" } },
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "linear",
              rotation: 45,
              colorStops: [
                { offset: "0%", color: "#4dabf7" },
                { offset: "100%", color: "#339af0" },
              ],
            },
          },
          mask: { type: "zigzag", scale: 1.5 },
          opacity: 0.85,
        },
      ],
    },
    cornersSquareOptions: { color: "#364fc7", shape: { type: "figure", path: "extra-rounded" } },
    cornersDotOptions: { color: "#364fc7", shape: { type: "figure", path: "dot" } },
  });

  // 8. Zigzag — radial gradient, large scale, neon theme
  await gen("08-zigzag-neon-radial", {
    backgroundOptions: { color: "#0a0a0a" },
    dotsOptions: {
      shape: { type: "figure", path: "dots" },
      overlays: [
        { fill: { type: "color", color: "#111" } },
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "radial",
              colorStops: [
                { offset: "0%", color: "#00f5ff" },
                { offset: "50%", color: "#7b2ff7" },
                { offset: "100%", color: "#ff206e" },
              ],
            },
          },
          mask: { type: "zigzag", scale: 2.0 },
          opacity: 1.0,
        },
      ],
    },
    cornersSquareOptions: { color: "#00f5ff", shape: { type: "figure", path: "square" } },
    cornersDotOptions: { color: "#ff206e", shape: { type: "figure", path: "dot" } },
  });

  // 9. Zigzag fine — pink/rose solid
  await gen("09-zigzag-fine-pink", {
    backgroundOptions: { color: "#fff0f6" },
    dotsOptions: {
      shape: { type: "figure", path: "classy-rounded" },
      overlays: [
        { fill: { type: "color", color: "#c2255c" } },
        {
          fill: { type: "color", color: "#f783ac" },
          mask: { type: "zigzag", scale: 0.6 },
          opacity: 0.7,
        },
      ],
    },
    cornersSquareOptions: { color: "#c2255c", shape: { type: "figure", path: "extra-rounded" } },
    cornersDotOptions: { color: "#c2255c", shape: { type: "figure", path: "dot" } },
  });

  // ──────────────────────────────────────────────────────────────
  // 10-13  WAVE
  // ──────────────────────────────────────────────────────────────

  // 10. Wave — solid ocean blue
  await gen("10-wave-solid-ocean", {
    backgroundOptions: { color: "#e7f5ff" },
    dotsOptions: {
      shape: { type: "figure", path: "square" },
      overlays: [
        { fill: { type: "color", color: "#1864ab" } },
        {
          fill: { type: "color", color: "#74c0fc" },
          mask: { type: "wave", scale: 1.2 },
          opacity: 0.8,
        },
      ],
    },
    cornersSquareOptions: { color: "#1864ab", shape: { type: "figure", path: "square" } },
    cornersDotOptions: { color: "#1864ab", shape: { type: "figure", path: "square" } },
  });

  // 11. Wave — linear gradient horizontal, light theme
  await gen("11-wave-linear-gradient-sunset", {
    backgroundOptions: { color: "#fff9db" },
    dotsOptions: {
      shape: { type: "figure", path: "extra-rounded" },
      overlays: [
        { fill: { type: "color", color: "#e67700" } },
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "linear",
              rotation: 0,
              colorStops: [
                { offset: "0%", color: "#ff6b6b" },
                { offset: "50%", color: "#ffd43b" },
                { offset: "100%", color: "#ff6b6b" },
              ],
            },
          },
          mask: { type: "wave", scale: 1.5 },
          opacity: 0.9,
        },
      ],
    },
    cornersSquareOptions: { color: "#e67700", shape: { type: "figure", path: "square" } },
    cornersDotOptions: { color: "#e67700", shape: { type: "figure", path: "dot" } },
  });

  // 12. Wave — radial gradient, dark bg (fire theme)
  await gen("12-wave-radial-fire", {
    backgroundOptions: { color: "#1c0a00" },
    dotsOptions: {
      shape: { type: "figure", path: "dots" },
      overlays: [
        { fill: { type: "color", color: "#7f1d1d" } },
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "radial",
              colorStops: [
                { offset: "0%", color: "#fbbf24" },
                { offset: "40%", color: "#ef4444" },
                { offset: "100%", color: "#7f1d1d" },
              ],
            },
          },
          mask: { type: "wave", scale: 1.8 },
          opacity: 1.0,
        },
      ],
    },
    cornersSquareOptions: { color: "#fbbf24", shape: { type: "figure", path: "extra-rounded" } },
    cornersDotOptions: { color: "#ef4444", shape: { type: "figure", path: "dot" } },
  });

  // 13. Wave large + two colors layered
  await gen("13-wave-double-layer", {
    backgroundOptions: { color: "#f0fff4" },
    dotsOptions: {
      shape: { type: "figure", path: "rounded" },
      overlays: [
        { fill: { type: "color", color: "#1b4332" } },
        {
          fill: { type: "color", color: "#40916c" },
          mask: { type: "wave", scale: 2.0 },
          opacity: 0.7,
        },
        {
          fill: { type: "color", color: "#95d5b2" },
          mask: { type: "wave", scale: 1.0 },
          opacity: 0.5,
        },
      ],
    },
    cornersSquareOptions: { color: "#1b4332", shape: { type: "figure", path: "square" } },
    cornersDotOptions: { color: "#40916c", shape: { type: "figure", path: "dot" } },
  });

  // ──────────────────────────────────────────────────────────────
  // 14-17  CHECKER
  // ──────────────────────────────────────────────────────────────

  // 14. Checker — solid black/gold
  await gen("14-checker-solid-gold", {
    backgroundOptions: { color: "#1a1500" },
    dotsOptions: {
      shape: { type: "figure", path: "square" },
      overlays: [
        { fill: { type: "color", color: "#78350f" } },
        {
          fill: { type: "color", color: "#fbbf24" },
          mask: { type: "checker", scale: 1.0 },
          opacity: 1.0,
        },
      ],
    },
    cornersSquareOptions: { color: "#fbbf24", shape: { type: "figure", path: "square" } },
    cornersDotOptions: { color: "#78350f", shape: { type: "figure", path: "square" } },
  });

  // 15. Checker — linear gradient fill, pastel bg
  await gen("15-checker-linear-gradient-pastel", {
    backgroundOptions: { color: "#faf5ff" },
    dotsOptions: {
      shape: { type: "figure", path: "dots" },
      overlays: [
        { fill: { type: "color", color: "#6d28d9" } },
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "linear",
              rotation: 45,
              colorStops: [
                { offset: "0%", color: "#a78bfa" },
                { offset: "100%", color: "#7c3aed" },
              ],
            },
          },
          mask: { type: "checker", scale: 1.2 },
          opacity: 0.8,
        },
      ],
    },
    cornersSquareOptions: { color: "#6d28d9", shape: { type: "figure", path: "extra-rounded" } },
    cornersDotOptions: { color: "#7c3aed", shape: { type: "figure", path: "dot" } },
  });

  // 16. Checker — radial gradient, dark bg (diamond glow)
  await gen("16-checker-radial-diamond", {
    backgroundOptions: { color: "#0f0f23" },
    dotsOptions: {
      shape: { type: "figure", path: "square" },
      overlays: [
        { fill: { type: "color", color: "#1e1e4f" } },
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "radial",
              colorStops: [
                { offset: "0%", color: "#e0aaff" },
                { offset: "40%", color: "#7b2d8b" },
                { offset: "100%", color: "#1e1e4f" },
              ],
            },
          },
          mask: { type: "checker", scale: 0.8 },
          opacity: 1.0,
        },
      ],
    },
    cornersSquareOptions: { color: "#e0aaff", shape: { type: "figure", path: "square" } },
    cornersDotOptions: { color: "#7b2d8b", shape: { type: "figure", path: "square" } },
  });

  // 17. Checker micro — very fine, cyan tech
  await gen("17-checker-micro-cyan", {
    backgroundOptions: { color: "#f0fdfa" },
    dotsOptions: {
      shape: { type: "figure", path: "classy-rounded" },
      overlays: [
        { fill: { type: "color", color: "#0d9488" } },
        {
          fill: { type: "color", color: "#5eead4" },
          mask: { type: "checker", scale: 0.5 },
          opacity: 0.7,
        },
      ],
    },
    cornersSquareOptions: { color: "#0d9488", shape: { type: "figure", path: "extra-rounded" } },
    cornersDotOptions: { color: "#0d9488", shape: { type: "figure", path: "dot" } },
  });

  // ──────────────────────────────────────────────────────────────
  // 18-20  CUSTOM PATH MASKS
  // ──────────────────────────────────────────────────────────────

  // 18. Custom — diamond/rhombus tile
  await gen("18-custom-diamond-tile", {
    backgroundOptions: { color: "#fff" },
    dotsOptions: {
      shape: { type: "figure", path: "square" },
      overlays: [
        { fill: { type: "color", color: "#2c2c54" } },
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "linear",
              rotation: 90,
              colorStops: [
                { offset: "0%", color: "#706fd3" },
                { offset: "100%", color: "#474787" },
              ],
            },
          },
          mask: {
            type: "custom",
            path: "M5 0 L10 5 L5 10 L0 5 Z",
            tileWidth: 10,
            tileHeight: 10,
          },
          opacity: 0.9,
        },
      ],
    },
    cornersSquareOptions: { color: "#2c2c54", shape: { type: "figure", path: "square" } },
    cornersDotOptions: { color: "#706fd3", shape: { type: "figure", path: "dot" } },
  });

  // 19. Custom — cross/plus tile
  await gen("19-custom-cross-tile", {
    backgroundOptions: { color: "#fff5f5" },
    dotsOptions: {
      shape: { type: "figure", path: "square" },
      overlays: [
        { fill: { type: "color", color: "#9b2226" } },
        {
          fill: { type: "color", color: "#e63946" },
          mask: {
            type: "custom",
            path: "M3 0 L7 0 L7 3 L10 3 L10 7 L7 7 L7 10 L3 10 L3 7 L0 7 L0 3 L3 3 Z",
            tileWidth: 10,
            tileHeight: 10,
          },
          opacity: 0.85,
        },
      ],
    },
    cornersSquareOptions: { color: "#9b2226", shape: { type: "figure", path: "square" } },
    cornersDotOptions: { color: "#e63946", shape: { type: "figure", path: "square" } },
  });

  // 20. Custom — hexagon tile
  await gen("20-custom-hexagon-tile", {
    backgroundOptions: { color: "#fffff0" },
    dotsOptions: {
      shape: { type: "figure", path: "square" },
      overlays: [
        { fill: { type: "color", color: "#3d405b" } },
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "linear",
              rotation: 30,
              colorStops: [
                { offset: "0%", color: "#e07a5f" },
                { offset: "100%", color: "#f2cc8f" },
              ],
            },
          },
          mask: {
            type: "custom",
            path: "M6 0 L12 3.5 L12 10.5 L6 14 L0 10.5 L0 3.5 Z",
            tileWidth: 12,
            tileHeight: 14,
          },
          opacity: 0.9,
        },
      ],
    },
    cornersSquareOptions: { color: "#3d405b", shape: { type: "figure", path: "square" } },
    cornersDotOptions: { color: "#e07a5f", shape: { type: "figure", path: "dot" } },
  });

  // ──────────────────────────────────────────────────────────────
  // 21-26  MULTI-LAYER COMBINATIONS
  // ──────────────────────────────────────────────────────────────

  // 21. Gradient base + stripe overlay (classic combo)
  await gen("21-gradient-base-stripe-top", {
    backgroundOptions: { color: "#fff" },
    dotsOptions: {
      shape: { type: "figure", path: "dots" },
      overlays: [
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "linear",
              rotation: 45,
              colorStops: [
                { offset: "0%", color: "#0077b6" },
                { offset: "100%", color: "#023e8a" },
              ],
            },
          },
        },
        {
          fill: { type: "color", color: "#48cae4" },
          mask: { type: "stripe", angle: 45, scale: 1.2 },
          opacity: 0.6,
        },
      ],
    },
    cornersSquareOptions: { color: "#0077b6", shape: { type: "figure", path: "extra-rounded" } },
    cornersDotOptions: { color: "#023e8a", shape: { type: "figure", path: "dot" } },
  });

  // 22. Gradient base + wave overlay — spring
  await gen("22-gradient-base-wave-spring", {
    backgroundOptions: { color: "#f1fdf0" },
    dotsOptions: {
      shape: { type: "figure", path: "rounded" },
      overlays: [
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "linear",
              rotation: 90,
              colorStops: [
                { offset: "0%", color: "#1b4332" },
                { offset: "100%", color: "#52b788" },
              ],
            },
          },
        },
        {
          fill: { type: "color", color: "#b7e4c7" },
          mask: { type: "wave", scale: 1.3 },
          opacity: 0.55,
        },
      ],
    },
    cornersSquareOptions: { color: "#1b4332", shape: { type: "figure", path: "extra-rounded" } },
    cornersDotOptions: { color: "#52b788", shape: { type: "figure", path: "dot" } },
  });

  // 23. Gradient base + checker overlay — luxe
  await gen("23-gradient-base-checker-luxe", {
    backgroundOptions: { color: "#0a0700" },
    dotsOptions: {
      shape: { type: "figure", path: "square" },
      overlays: [
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "radial",
              colorStops: [
                { offset: "0%", color: "#fbbf24" },
                { offset: "60%", color: "#92400e" },
                { offset: "100%", color: "#451a03" },
              ],
            },
          },
        },
        {
          fill: { type: "color", color: "#fde68a" },
          mask: { type: "checker", scale: 0.7 },
          opacity: 0.4,
        },
      ],
    },
    cornersSquareOptions: { color: "#fbbf24", shape: { type: "figure", path: "square" } },
    cornersDotOptions: { color: "#92400e", shape: { type: "figure", path: "square" } },
  });

  // 24. Three layers — solid base + stripe + zigzag
  await gen("24-three-layers-stripe-zigzag", {
    backgroundOptions: { color: "#ffeedd" },
    dotsOptions: {
      shape: { type: "figure", path: "extra-rounded" },
      overlays: [
        { fill: { type: "color", color: "#c1121f" } },
        {
          fill: { type: "color", color: "#e85d04" },
          mask: { type: "stripe", angle: 45, scale: 1.5 },
          opacity: 0.65,
        },
        {
          fill: { type: "color", color: "#faa307" },
          mask: { type: "zigzag", scale: 1.0 },
          opacity: 0.5,
        },
      ],
    },
    cornersSquareOptions: { color: "#c1121f", shape: { type: "figure", path: "square" } },
    cornersDotOptions: { color: "#e85d04", shape: { type: "figure", path: "dot" } },
  });

  // 25. Different overlays on dots vs. eyes
  await gen("25-different-overlays-dots-vs-eyes", {
    backgroundOptions: { color: "#f8f9fa" },
    dotsOptions: {
      shape: { type: "figure", path: "classy-rounded" },
      overlays: [
        { fill: { type: "color", color: "#212529" } },
        {
          fill: { type: "color", color: "#6741d9" },
          mask: { type: "wave", scale: 1.2 },
          opacity: 0.7,
        },
      ],
    },
    cornersSquareOptions: {
      shape: { type: "figure", path: "square" },
      overlays: [
        { fill: { type: "color", color: "#212529" } },
        {
          fill: { type: "color", color: "#f03e3e" },
          mask: { type: "checker", scale: 0.8 },
          opacity: 0.75,
        },
      ],
    },
    cornersDotOptions: {
      shape: { type: "figure", path: "dot" },
      overlays: [
        { fill: { type: "color", color: "#212529" } },
        {
          fill: { type: "color", color: "#1971c2" },
          mask: { type: "stripe", angle: 0, scale: 0.8 },
          opacity: 0.7,
        },
      ],
    },
  });

  // 26. Overlays only on eyes — dots stay solid
  await gen("26-overlays-eyes-only", {
    backgroundOptions: { color: "#f3f0ff" },
    dotsOptions: {
      shape: { type: "figure", path: "dots" },
      color: "#343a40",
    },
    cornersSquareOptions: {
      shape: { type: "figure", path: "extra-rounded" },
      overlays: [
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "linear",
              rotation: 135,
              colorStops: [
                { offset: "0%", color: "#5c7cfa" },
                { offset: "100%", color: "#7950f2" },
              ],
            },
          },
        },
        {
          fill: { type: "color", color: "#e599f7" },
          mask: { type: "zigzag", scale: 1.0 },
          opacity: 0.6,
        },
      ],
    },
    cornersDotOptions: {
      shape: { type: "figure", path: "dot" },
      overlays: [
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "radial",
              colorStops: [
                { offset: "0%", color: "#cc5de8" },
                { offset: "100%", color: "#7950f2" },
              ],
            },
          },
        },
      ],
    },
  });

  // ──────────────────────────────────────────────────────────────
  // 27-30  THEMATIC COMBOS
  // ──────────────────────────────────────────────────────────────

  // 27. FIRE — orange-red gradient + wave
  await gen("27-theme-fire", {
    backgroundOptions: { color: "#1c0a00" },
    dotsOptions: {
      shape: { type: "figure", path: "extra-rounded" },
      overlays: [
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "radial",
              colorStops: [
                { offset: "0%", color: "#fde047" },
                { offset: "35%", color: "#f97316" },
                { offset: "70%", color: "#dc2626" },
                { offset: "100%", color: "#7f1d1d" },
              ],
            },
          },
        },
        {
          fill: { type: "color", color: "#fed7aa" },
          mask: { type: "wave", scale: 1.5 },
          opacity: 0.3,
        },
      ],
    },
    cornersSquareOptions: { color: "#f97316", shape: { type: "figure", path: "square" } },
    cornersDotOptions: { color: "#fde047", shape: { type: "figure", path: "dot" } },
  });

  // 28. OCEAN — blue gradient + wave
  await gen("28-theme-ocean", {
    backgroundOptions: { color: "#03045e" },
    dotsOptions: {
      shape: { type: "figure", path: "rounded" },
      overlays: [
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "linear",
              rotation: 180,
              colorStops: [
                { offset: "0%", color: "#caf0f8" },
                { offset: "40%", color: "#0077b6" },
                { offset: "100%", color: "#03045e" },
              ],
            },
          },
        },
        {
          fill: { type: "color", color: "#90e0ef" },
          mask: { type: "wave", scale: 2.0 },
          opacity: 0.35,
        },
      ],
    },
    cornersSquareOptions: { color: "#0096c7", shape: { type: "figure", path: "extra-rounded" } },
    cornersDotOptions: { color: "#caf0f8", shape: { type: "figure", path: "dot" } },
  });

  // 29. NEON CITY — radial gradient + checker
  await gen("29-theme-neon-city", {
    backgroundOptions: { color: "#03001c" },
    dotsOptions: {
      shape: { type: "figure", path: "square" },
      overlays: [
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "radial",
              colorStops: [
                { offset: "0%", color: "#00f5ff" },
                { offset: "35%", color: "#bc01fe" },
                { offset: "70%", color: "#ff2079" },
                { offset: "100%", color: "#03001c" },
              ],
            },
          },
        },
        {
          fill: { type: "color", color: "#ffffff" },
          mask: { type: "checker", scale: 0.6 },
          opacity: 0.12,
        },
      ],
    },
    cornersSquareOptions: { color: "#00f5ff", shape: { type: "figure", path: "square" } },
    cornersDotOptions: { color: "#ff2079", shape: { type: "figure", path: "square" } },
  });

  // 30. FOREST — green gradient + zigzag + wave triple layer
  await gen("30-theme-forest", {
    backgroundOptions: { color: "#081c15" },
    dotsOptions: {
      shape: { type: "figure", path: "classy-rounded" },
      overlays: [
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "linear",
              rotation: 135,
              colorStops: [
                { offset: "0%", color: "#d8f3dc" },
                { offset: "30%", color: "#52b788" },
                { offset: "70%", color: "#1b4332" },
                { offset: "100%", color: "#081c15" },
              ],
            },
          },
        },
        {
          fill: { type: "color", color: "#95d5b2" },
          mask: { type: "zigzag", scale: 1.8 },
          opacity: 0.3,
        },
        {
          fill: { type: "color", color: "#d8f3dc" },
          mask: { type: "wave", scale: 1.0 },
          opacity: 0.2,
        },
      ],
    },
    cornersSquareOptions: { color: "#52b788", shape: { type: "figure", path: "extra-rounded" } },
    cornersDotOptions: { color: "#d8f3dc", shape: { type: "figure", path: "dot" } },
  });

  // ──────────────────────────────────────────────────────────────
  // HTML GALLERY
  // ──────────────────────────────────────────────────────────────

  const files = fs.readdirSync(OUT).filter(f => f.endsWith(".svg")).sort();

  const labels = {
    "01": "Stripe 45° — teal solid",
    "02": "Stripe 0° — linear gradient, dark bg",
    "03": "Stripe 90° — radial gradient, neon",
    "04": "Stripe fine — purple gradient base",
    "05": "Stripe bold — warm orange",
    "06": "Zigzag — teal solid",
    "07": "Zigzag — linear gradient, pastel",
    "08": "Zigzag — neon radial, dark bg",
    "09": "Zigzag fine — rose pink",
    "10": "Wave — ocean solid",
    "11": "Wave — sunset linear gradient",
    "12": "Wave — fire radial, dark bg",
    "13": "Wave — triple layer green",
    "14": "Checker — gold on black",
    "15": "Checker — purple linear gradient",
    "16": "Checker — diamond radial glow",
    "17": "Checker micro — cyan tech",
    "18": "Custom mask — diamond tile",
    "19": "Custom mask — cross tile",
    "20": "Custom mask — hexagon tile",
    "21": "2 layers — gradient + stripe",
    "22": "2 layers — gradient + wave spring",
    "23": "2 layers — gold radial + checker",
    "24": "3 layers — stripe + zigzag",
    "25": "3 parts — each with different mask",
    "26": "Eyes-only overlays — dots solid",
    "27": "Theme: Fire",
    "28": "Theme: Ocean",
    "29": "Theme: Neon City",
    "30": "Theme: Forest",
  };

  const cards = files.map(f => {
    const num = f.slice(0, 2);
    const label = labels[num] || f.replace(".svg", "").replace(/-/g, " ");
    const svg = fs.readFileSync(path.join(OUT, f), "utf8");
    return `
    <div class="card">
      <div class="qr">${svg}</div>
      <div class="num">${num}</div>
      <div class="label">${label}</div>
    </div>`;
  }).join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Overlay Showcase — 30 QR Codes</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #111; color: #eee; padding: 32px; }
  h1 { text-align: center; font-size: 1.8rem; margin-bottom: 8px; letter-spacing: .5px; }
  p.sub { text-align: center; color: #888; font-size: .9rem; margin-bottom: 32px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; }
  .card { background: #1e1e1e; border-radius: 12px; overflow: hidden; text-align: center; padding-bottom: 12px; }
  .qr svg { width: 100%; height: auto; display: block; }
  .num { font-size: .7rem; color: #555; margin-top: 8px; }
  .label { font-size: .8rem; color: #bbb; padding: 2px 12px; line-height: 1.3; }
  .section { grid-column: 1 / -1; padding: 20px 0 4px; font-size: 1rem; font-weight: 600;
             color: #888; border-top: 1px solid #333; margin-top: 16px; }
</style>
</head>
<body>
<h1>QR Overlay Showcase</h1>
<p class="sub">30 QR codes demonstrating stripe, zigzag, wave, checker and custom path masks — solid, gradient and multi-layer fills</p>
<div class="grid">
  <div class="section">Stripe masks (1–5)</div>
  ${cards.slice(0, 5 * (cards.split('<div class="card">').length / files.length))}
</div>
</body>
</html>`;

  // simpler: just dump all cards in a flat grid
  const htmlSimple = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Overlay Showcase — 30 QR Codes</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #111; color: #eee; padding: 32px 24px; }
  h1 { text-align: center; font-size: 1.9rem; margin-bottom: 6px; }
  p.sub { text-align: center; color: #777; font-size: .88rem; margin-bottom: 36px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 18px; }
  .card { background: #1c1c1c; border-radius: 14px; overflow: hidden; text-align: center;
          padding-bottom: 14px; box-shadow: 0 2px 12px rgba(0,0,0,.5); }
  .card:hover { transform: translateY(-2px); transition: transform .15s; }
  .qr svg { width: 100% !important; height: auto !important; display: block; }
  .num { font-size: .68rem; color: #444; margin-top: 10px; text-transform: uppercase; letter-spacing: 1px; }
  .label { font-size: .78rem; color: #aaa; padding: 3px 12px 0; line-height: 1.35; }
</style>
</head>
<body>
<h1>QR Overlay Showcase</h1>
<p class="sub">30 examples — stripe · zigzag · wave · checker · custom path · solid · gradient · multi-layer</p>
<div class="grid">
${cards}
</div>
</body>
</html>`;

  fs.writeFileSync(path.join(OUT, "index.html"), htmlSimple);
  console.log(`\n✓ Gallery → ${OUT}/index.html`);
})();
