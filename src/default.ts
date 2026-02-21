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
    color: "#000000",
  },
  cornersDotOptions: {
    shape: { type: "icon", path: "inner-eye-square" },
    color: "#000000",
  },
  cornersSquareOptions: {
    shape: { type: "icon", path: "outer-eye-square" },
    color: "#000000",
  },
};
