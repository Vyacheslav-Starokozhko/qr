import { QRConfig } from "./types";

export const defaultOptions: Required<
  Pick<QRConfig, "dotsOptions" | "cornersDotOptions" | "cornersSquareOptions">
> = {
  dotsOptions: {
    shape: "square",
    color: "#000000",
  },
  cornersDotOptions: {
    shape: "square",
    color: "#000000",
  },
  cornersSquareOptions: {
    shape: "square",
    color: "#000000",
  },
};
