const svgWithFrame = await generateSVG({
    data: "https://wiki.org",
    padding: 1,
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
        excludeDots: true,
        x: 1,
        y: 2,
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

    // 1. DOTS — use a simple square shape with visible color
    dotsOptions: {
      // shape: "square",
      color: "#e0e0e0",
      scale: 0.85,
      // To use custom-icon shape, uncomment below and comment out shape/color above:
      shape: "custom-icon",
      // color: "white",
      customIconPath: fullWLogo,
      customIconViewBox: "0 0 41 36",
    },

    // 2. CORNER SQUARE (outer eye frame)
    cornersSquareOptions: {
      shape: "square",
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
      shape: "heart",
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

  const { matrixSize, eyeZones, getMaxPos } = getQRBounds('https://wiki.org');
// Для зображення розміром 3×3 модулі:
const { maxX, maxY } = getMaxPos(3, 3);


const { matrixSize, eyeZones, getMaxPos,svgWithFrame } = await generateSVG({...})