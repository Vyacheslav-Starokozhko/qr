// src/index.ts
import { QRAnalyzer } from "./core/analyzer";
import { shapes } from "./renderer/shapes";
import { AvailableShape } from "./types";

// Extend the type, allowing 'custom-icon' as a valid value,
// even if it's not in the shapes object
export type QRLayoutShape = AvailableShape | "custom-icon";

export interface QRConfig {
  text: string;
  shape?: QRLayoutShape; // Use the extended type
  color?: string;
  bgColor?: string;
  padding?: number;
  customIconPath?: string;
  customIconViewBox?: string;
}

// Helper function to determine the CENTER of the eye (3x3)
function isFinderCenter(x: number, y: number, size: number): boolean {
  if (x >= 2 && x <= 4 && y >= 2 && y <= 4) return true;
  if (x >= size - 5 && x <= size - 3 && y >= 2 && y <= 4) return true;
  if (x >= 2 && x <= 4 && y >= size - 5 && y <= size - 3) return true;
  return false;
}

export function generateSVG(config: QRConfig): string {
  const analyzer = new QRAnalyzer(config.text);
  const matrix = analyzer.getMatrix();
  const size = matrix.length;

  // Settings
  const shapeKey = config.shape || "square";
  const isCustomIconMode = shapeKey === "custom-icon";

  // Safe function selection: if "custom-icon" mode, use square as fallback,
  // so the code doesn't crash. Otherwise use the selected shape.
  // @ts-ignore - ignore key checking for custom-icon
  const selectedShapeFn = isCustomIconMode
    ? shapes["square"]
    : shapes[shapeKey] || shapes["square"];
  const squareFn = shapes["square"];

  const fgColor = config.color || "#000000";
  const bgColor = config.bgColor || "#FFFFFF";
  const padding = config.padding ?? 4;

  const fullSize = size + padding * 2;

  let fgPath = ""; // For standard vector paths
  let iconUses = ""; // For <use> (custom icons)
  let bgPath = ""; // For background shapes

  for (let y = -padding; y < size + padding; y++) {
    for (let x = -padding; x < size + padding; x++) {
      const drawX = x + padding;
      const drawY = y + padding;
      const insideMatrix = x >= 0 && x < size && y >= 0 && y < size;

      let isDark = false;
      let isFinder = false; // Does this belong to the eye module (both center and frame)

      if (insideMatrix) {
        const cell = matrix[y][x];
        isDark = cell.isDark;
        isFinder = cell.type.startsWith("pos-");
      }

      // --- DRAWING LOGIC (FOREGROUND) ---
      if (isDark) {
        // PRIORITY 1: Eye center is always drawn as a solid square
        //   if (insideMatrix && isFinderCenter(x, y, size)) {
        if (insideMatrix && isFinder) {
          fgPath += squareFn(drawX, drawY) + " ";
        }
        // PRIORITY 2: Custom icon (if enabled)
        else if (isCustomIconMode) {
          // width="1" height="1" scales the icon's viewBox to one cell
          iconUses += `
  <g transform="translate(${drawX}, ${drawY})">
     <use href="#custom-icon-def" width="1" height="1" 
          style="transform-box: fill-box; transform-origin: center; transform: scale(1);" />
  </g>
`;
        }
        // PRIORITY 3: Regular selected shape (heart, star, etc.)
        else {
          fgPath += selectedShapeFn(drawX, drawY) + " ";
        }
      }

      // --- BACKGROUND DRAWING LOGIC ---
      else {
        // We draw background pattern only if it's not regular square mode
        // and we're not in custom icon mode (because white logos on background are usually unnecessary)
        if (shapeKey !== "square" && !isCustomIconMode && !isFinder) {
          bgPath += selectedShapeFn(drawX, drawY) + " ";
        }
      }
    }
  }

  // Form the final SVG
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fullSize} ${fullSize}">
      <defs>
        ${
          isCustomIconMode
            ? `
        <symbol id="custom-icon-def" viewBox="${config.customIconViewBox || "0 0 24 24"}">
           <path d="${config.customIconPath}" fill="currentColor" />
        </symbol>`
            : ""
        }
      </defs>

      <rect width="100%" height="100%" fill="${bgColor}"/>
      
      <path d="${bgPath}" fill="${bgColor}" />
      
      <path d="${fgPath}" fill="${fgColor}" />
      
      <g fill="${fgColor}">${iconUses}</g>
    </svg>
  `;
}
