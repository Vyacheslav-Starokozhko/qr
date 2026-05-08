import { Options } from "./types";

export const defaultOptions: Required<
  Pick<
    Options,
    | "dotsOptions"
    | "cornersDotOptions"
    | "cornersSquareOptions"
    | "backgroundOptions"
  >
> = {
  backgroundOptions: {
    color: "#ffffff",
  },
  dotsOptions: {
    shape: { type: "icon", path: "dots-square" },
    overlays: [{ fill: { type: "color", color: "#000000" } }],
  },
  cornersDotOptions: {
    shape: { type: "icon", path: "inner-eye-square" },
    overlays: [{ fill: { type: "color", color: "#000000" } }],
  },
  cornersSquareOptions: {
    shape: { type: "icon", path: "outer-eye-square" },
    overlays: [{ fill: { type: "color", color: "#000000" } }],
  },
};
