import("./dist/index.js").then(async ({ exportQR }) => {
  const config = {
    data: "https://example.com",
    width: 500,
    height: 500,
    backgroundOptions: { color: "#f1f3f8" },
    dotsOptions: {
      overlays: [
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "linear",
              colorStops: [
                { offset: 0, color: "#1a0050" },
                { offset: 1, color: "#0d2b5e" },
              ],
            },
          },
        },
      ],
    },
    cornersSquareOptions: {
      overlays: [{ fill: { type: "color", color: "#c41fa1" } }],
    },
    cornersDotOptions: {
      overlays: [{ fill: { type: "color", color: "#c41fa1" } }],
    },
    wrapper: {
      shape: "diamond",
      fillMargin: {
        shape: { type: "figure", path: "square" },
        color: "#2d0065",
      },
    },
    animation: [
      {
        type: "glow",
        color: "#7a6beb",
        intensity: 2.928,
        duration: 3.79,
        delay: 0.19,
      },
      { type: "color-cycle", target: "all" },
      { type: "float", direction: "vertical", duration: 4.4 },
    ],
  };

  const gif = await exportQR(config, "gif", { fps: 20 });
  const fs = await import("fs");
  fs.writeFileSync("test_output.gif", gif);
  console.log("Written test_output.gif, size:", gif.length);
});
