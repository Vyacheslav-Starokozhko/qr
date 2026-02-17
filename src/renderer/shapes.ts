// Type for drawing function
export type ShapeDrawer = (x: number, y: number) => string;

export const shapes: Record<string, ShapeDrawer> = {
  // --- BASIC SHAPES ---

  // Classic square
  square: (x, y) => {
    // Move to x,y -> horizontal 1 -> vertical 1 -> horizontal -1 -> close
    return `M ${x} ${y} h 1 v 1 h -1 z`;
  },

  // Circle (maximum size within the cell)
  circle: (x, y) => {
    const cx = x + 0.5;
    const cy = y + 0.5;
    const r = 0.5; // Full radius
    // Draw with two arcs (Arc)
    return `M ${cx - r}, ${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 -${r * 2},0`;
  },

  // Rounded square (softer than regular)
  rounded: (x, y) => {
    const r = 0.2; // Corner rounding radius
    // Start offset from top-left corner
    return `M ${x + r} ${y} 
            h ${1 - 2 * r} a ${r} ${r} 0 0 1 ${r} ${r} 
            v ${1 - 2 * r} a ${r} ${r} 0 0 1 -${r} ${r} 
            h -${1 - 2 * r} a ${r} ${r} 0 0 1 -${r} -${r} 
            v -${1 - 2 * r} a ${r} ${r} 0 0 1 ${r} -${r} z`;
  },

  // --- COMPLEX SHAPES ---

  // Heart ❤️
  heart: (x, y) => {
    // Scale to make the heart "fatter" and better fill the cell
    const s = 1.1;
    const dx = x + 0.5;
    const dy = y + 0.5;
    return `
      M ${dx} ${dy - 0.3 * s} 
      C ${dx} ${dy - 0.5 * s}, ${dx - 0.5 * s} ${dy - 0.5 * s}, ${dx - 0.5 * s} ${dy - 0.1 * s} 
      C ${dx - 0.5 * s} ${dy + 0.2 * s}, ${dx - 0.2 * s} ${dy + 0.4 * s}, ${dx} ${dy + 0.6 * s} 
      C ${dx + 0.2 * s} ${dy + 0.4 * s}, ${dx + 0.5 * s} ${dy + 0.2 * s}, ${dx + 0.5 * s} ${dy - 0.1 * s} 
      C ${dx + 0.5 * s} ${dy - 0.5 * s}, ${dx} ${dy - 0.5 * s}, ${dx} ${dy - 0.3 * s} 
      z`;
  },

  // 5-pointed star ⭐
  star: (x, y) => {
    // This is a bit more complex, need to calculate 10 points.
    // For simplicity I use a pre-calculated path for the star
    // and scale/shift it to coordinates x,y.

    const cx = x + 0.5;
    const cy = y + 0.5;
    // Star vertices (outer radius ~0.5, inner ~0.2)
    // Coordinates relative to center (cx, cy)
    return `
      M ${cx} ${cy - 0.5} 
      L ${cx + 0.11} ${cy - 0.15} 
      L ${cx + 0.47} ${cy - 0.15} 
      L ${cx + 0.18} ${cy + 0.06} 
      L ${cx + 0.29} ${cy + 0.4} 
      L ${cx} ${cy + 0.19} 
      L ${cx - 0.29} ${cy + 0.4} 
      L ${cx - 0.18} ${cy + 0.06} 
      L ${cx - 0.47} ${cy - 0.15} 
      L ${cx - 0.11} ${cy - 0.15} 
      z`;
  },

  // Wave 🌊 (block with curved top and bottom)
  wave: (x, y) => {
    // Use quadratic Bezier curves (Q) to create "humps"
    // Top line curves down, bottom also curves down, creating flow effect.
    return `
      M ${x} ${y + 0.1} 
      Q ${x + 0.5} ${y - 0.1} ${x + 1} ${y + 0.1} 
      V ${y + 0.9} 
      Q ${x + 0.5} ${y + 0.7} ${x} ${y + 0.9} 
      z`;
  },
  capsule: (cx: number, cy: number) => {
    // scale 0.23 gives width 0.46 (almost half a cell), this is better for readability
    const scale = 0.23;

    const r = 1 * scale;
    const h_straight = 1 * scale;

    return `
      M ${cx - r} ${cy - h_straight} 
      A ${r} ${r} 0 0 1 ${cx + r} ${cy - h_straight} 
      V ${cy + h_straight} 
      A ${r} ${r} 0 0 1 ${cx - r} ${cy + h_straight} 
      Z
    `;
  },
  diamond: (x: number, y: number) => {
    const cx = x + 0.5;
    const cy = y + 0.5;

    // Radius from center to vertex.
    // 0.5 = full touching of neighbors.
    // 0.45 = small gaps (looks stylish).
    const r = 0.45;

    return `
      M ${cx} ${cy - r}      
      L ${cx + r} ${cy}      
      L ${cx} ${cy + r}      
      L ${cx - r} ${cy}      
      Z
    `;
  },
  hexagon: (x: number, y: number) => {
    const cx = x + 0.5;
    const cy = y + 0.5;
    const r = 0.45; // Radius
    const w = 0.25; // Half the width of the top edge (r * sin(30))

    // Draw hexagon with flat top
    return `
      M ${cx - w} ${cy - r} 
      L ${cx + w} ${cy - r} 
      L ${cx + r} ${cy} 
      L ${cx + w} ${cy + r} 
      L ${cx - w} ${cy + r} 
      L ${cx - r} ${cy} 
      Z
    `;
  },
  leaf: (x: number, y: number) => {
    const cx = x + 0.5;
    const cy = y + 0.5;

    // Radius (half the leaf height)
    const r = 0.5;

    // To make the leaf "plump", the arc curvature radius must be greater than r.
    // If curveR = r, this will be a perfect circle.
    // If curveR > r, this will be a "flattened" circle (lemon).
    const curveR = 0.8;

    return `
      M ${cx} ${cy - r} 
      A ${curveR} ${curveR} 0 0 1 ${cx} ${cy + r} 
      A ${curveR} ${curveR} 0 0 1 ${cx} ${cy - r} 
      Z
    `;
  },
  triangle: (x: number, y: number) => {
    const cx = x + 0.5;
    const cy = y + 0.5;
    const r = 0.45; // Offset from center

    // Equilateral triangle pointing upward
    // (Can be flipped by changing signs in cy)
    return `
      M ${cx} ${cy - r} 
      L ${cx + r} ${cy + r} 
      L ${cx - r} ${cy + r} 
      Z
    `;
  },
};
