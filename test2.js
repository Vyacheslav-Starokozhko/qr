import("./dist/index.js").then(async ({ exportQR }) => {
  const config = {
    width: 362,
    height: 362,
    data: "http://localhost:3000/",
    margin: 70,
    backgroundEnable: true,
    imageEnable: false,
    qrOptions: {
      typeNumber: 0,
      mode: "Byte",
      errorCorrectionLevel: "H",
    },
    dotsOptions: {
      overlays: [
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "linear",
              rotation: 180,
              colorStops: [
                {
                  offset: "0%",
                  color: "#8e8201",
                },
                {
                  offset: "50%",
                  color: "#2f0b93",
                },
                {
                  offset: "100%",
                  color: "#021c79",
                },
              ],
            },
          },
        },
        {
          fill: {
            type: "color",
            color: "#188b04",
          },
          mask: {
            type: "wave",
            scale: 2.066660813288763,
          },
          opacity: 0.8165936583187431,
        },
      ],
      shape: {
        type: "figure",
        path: "square",
      },
    },
    backgroundOptions: {
      color: "#f1f3f8",
    },
    cornersSquareOptions: {
      overlays: [
        {
          fill: {
            type: "color",
            color: "#950b98",
          },
        },
        {
          fill: {
            type: "color",
            color: "#3f4601",
          },
          mask: {
            type: "wave",
            scale: 2.1292250002734363,
          },
          opacity: 0.5162539405515417,
        },
        {
          fill: {
            type: "color",
            color: "#4d052c",
          },
          mask: {
            type: "checker",
            scale: 1.5860084121581166,
          },
          opacity: 0.6743242695461958,
        },
      ],
      shape: {
        type: "icon",
        path: "outer-eye-rounded",
      },
    },
    cornersDotOptions: {
      overlays: [
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "linear",
              rotation: 45,
              colorStops: [
                {
                  offset: "0%",
                  color: "#12024a",
                },
                {
                  offset: "100%",
                  color: "#021c36",
                },
              ],
            },
          },
        },
        {
          fill: {
            type: "gradient",
            gradient: {
              type: "radial",
              colorStops: [
                {
                  offset: "0%",
                  color: "#862d03",
                },
                {
                  offset: "100%",
                  color: "#530467",
                },
              ],
            },
          },
          mask: {
            type: "stripe",
            scale: 1.7182223009876907,
            angle: 60,
          },
          opacity: 0.40929680354893205,
        },
      ],
      shape: {
        type: "icon",
        path: "inner-eye-rounded",
      },
    },
    borderRadius: 86,
    decorations: [
      {
        shape: "triangle",
        color: "#005144",
        placement: "right",
        size: 0.7903213686775417,
        opacity: 0.593175384029746,
        seed: 2285,
      },
      {
        shape: "cross",
        color: "#0335a0",
        placement: "left",
        size: 0.3604051670525223,
        opacity: 0.7225701708812267,
        seed: -1640534135,
      },
    ],
    effects: [
      {
        type: "drop-shadow",
        target: "eyes",
        dx: 0.3548536440357566,
        dy: -0.05854607978835702,
        blur: 0.5528551770374179,
        color: "#e8d578",
        opacity: 0.5507305788691155,
      },
    ],
    animation: [
      {
        type: "color-cycle",
        target: "eyes",
        duration: 3.3862852975726128,
        delay: 0.22,
      },
      {
        type: "float",
        amplitude: 1.2478367496747524,
        direction: "vertical",
        duration: 4.402888290584087,
        delay: 0.48,
      },
      {
        type: "glow",
        target: "all",
        duration: 2,
      },
    ],
    wrapper: {
      shape: "diamond",
      strokeWidth: 10,
      strokeGradient: {
        type: "radial",
        colorStops: [
          {
            offset: "0%",
            color: "#4f019d",
          },
          {
            offset: "100%",
            color: "#470a06",
          },
        ],
      },
      fillMargin: {
        shape: {
          type: "figure",
          path: "square",
        },
      },
    },
  };

  const gif = await exportQR(config, "gif", { fps: 30, cycles: 2, dithering: true });
  const fs = await import("fs");
  fs.writeFileSync("test_output.gif", gif);
  console.log("Written test_output.gif, size:", gif.length);
});
