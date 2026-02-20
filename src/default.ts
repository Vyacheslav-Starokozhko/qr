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
    type: "inner-eye-square",
    color: "#000000",
  },
  cornersDotOptions: {
    type: "inner-eye-square",
    color: "#000000",
  },
  cornersSquareOptions: {
    type: "inner-eye-square",
    color: "#000000",
  },
};
