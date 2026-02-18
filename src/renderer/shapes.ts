// src/renderer/shapes.ts

// Helper для округлення дробів (зменшує розмір SVG)
const f = (n: number) => Number(n.toFixed(3));

export type ShapeDrawer = (x: number, y: number, scale?: number) => string;

export const shapes: Record<string, ShapeDrawer> = {
  // --- BASIC SHAPES ---

  // Classic square
  square: (x, y, s = 1) => {
    // s = розмір сторони (від 0 до 1)
    const r = s / 2; // половина сторони
    const cx = x + 0.5;
    const cy = y + 0.5;
    return `M ${f(cx - r)} ${f(cy - r)} h ${s} v ${s} h -${s} Z`;
  },

  // Circle
  circle: (x, y, s = 1) => {
    const r = 0.5 * s; // Радіус
    const cx = x + 0.5;
    const cy = y + 0.5;
    // Малюємо двома дугами
    return `M ${f(cx - r)} ${f(cy)} A ${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)} A ${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)} Z`;
  },

  // Rounded square
  rounded: (x, y, s = 1) => {
    const r = 0.2 * s; // Радіус скруглення залежить від масштабу
    const half = 0.5 * s; // Половина ширини
    const cx = x + 0.5;
    const cy = y + 0.5;

    // Починаємо з верхнього лівого кута (з урахуванням радіуса)
    return `
      M ${f(cx - half + r)} ${f(cy - half)}
      h ${f(s - 2 * r)} 
      a ${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(r)}
      v ${f(s - 2 * r)} 
      a ${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(r)}
      h ${f(-(s - 2 * r))} 
      a ${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(-r)}
      v ${f(-(s - 2 * r))} 
      a ${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(-r)} 
      Z
    `;
  },

  // --- COMPLEX SHAPES ---

  // Heart ❤️
  heart: (x, y, s = 1) => {
    // scale 1.1 виглядає краще для серця, тому множимо вхідний scale на це
    const size = s;
    const cx = x + 0.5;
    const cy = y + 0.5;

    // Координати контрольних точок Безьє масштабуються на size
    return `
      M ${f(cx)} ${f(cy - 0.3 * size)}
      C ${f(cx)} ${f(cy - 0.5 * size)}, ${f(cx - 0.5 * size)} ${f(cy - 0.5 * size)}, ${f(cx - 0.5 * size)} ${f(cy - 0.1 * size)}
      C ${f(cx - 0.5 * size)} ${f(cy + 0.2 * size)}, ${f(cx - 0.2 * size)} ${f(cy + 0.4 * size)}, ${f(cx)} ${f(cy + 0.6 * size)}
      C ${f(cx + 0.2 * size)} ${f(cy + 0.4 * size)}, ${f(cx + 0.5 * size)} ${f(cy + 0.2 * size)}, ${f(cx + 0.5 * size)} ${f(cy - 0.1 * size)}
      C ${f(cx + 0.5 * size)} ${f(cy - 0.5 * size)}, ${f(cx)} ${f(cy - 0.5 * size)}, ${f(cx)} ${f(cy - 0.3 * size)}
      Z
    `;
  },

  // 5-pointed star ⭐
  star: (x, y, s = 1) => {
    const cx = x + 0.5;
    const cy = y + 0.5;

    // Всі зміщення множимо на s
    return `
      M ${f(cx)} ${f(cy - 0.5 * s)} 
      L ${f(cx + 0.11 * s)} ${f(cy - 0.15 * s)} 
      L ${f(cx + 0.47 * s)} ${f(cy - 0.15 * s)} 
      L ${f(cx + 0.18 * s)} ${f(cy + 0.06 * s)} 
      L ${f(cx + 0.29 * s)} ${f(cy + 0.4 * s)} 
      L ${f(cx)} ${f(cy + 0.19 * s)} 
      L ${f(cx - 0.29 * s)} ${f(cy + 0.4 * s)} 
      L ${f(cx - 0.18 * s)} ${f(cy + 0.06 * s)} 
      L ${f(cx - 0.47 * s)} ${f(cy - 0.15 * s)} 
      L ${f(cx - 0.11 * s)} ${f(cy - 0.15 * s)} 
      Z`;
  },

  // Wave 🌊
  wave: (x, y, s = 1) => {
    // Центруємо хвилю по вертикалі
    // Повна висота хвилі ~0.8 * s
    const topY = y + 0.5 - 0.4 * s;
    const bottomY = y + 0.5 + 0.4 * s;
    const midY = y + 0.5;

    // Ширина хвилі теж залежить від s, відступаємо від країв
    const leftX = x + (0.5 - 0.5 * s);
    const rightX = x + (0.5 + 0.5 * s);
    const midX = x + 0.5;

    return `
      M ${f(leftX)} ${f(midY - 0.1 * s)} 
      Q ${f(midX)} ${f(topY - 0.2 * s)} ${f(rightX)} ${f(midY - 0.1 * s)} 
      V ${f(bottomY)} 
      Q ${f(midX)} ${f(bottomY - 0.2 * s)} ${f(leftX)} ${f(bottomY)} 
      Z`;
  },

  // Vertical Capsule (Pill)
  capsule: (x, y, s = 1) => {
    const cx = x + 0.5;
    const cy = y + 0.5;

    // За замовчуванням капсула вузька (співвідношення 1:2 приблизно)
    // Якщо s=1, ширина буде 0.5, висота 1.0
    const r = 0.25 * s; // Радіус половини ширини
    const h_straight = 0.25 * s; // Висота прямої секції (від центру)

    return `
      M ${f(cx - r)} ${f(cy - h_straight)} 
      A ${f(r)} ${f(r)} 0 0 1 ${f(cx + r)} ${f(cy - h_straight)} 
      V ${f(cy + h_straight)} 
      A ${f(r)} ${f(r)} 0 0 1 ${f(cx - r)} ${f(cy + h_straight)} 
      Z
    `;
  },

  // Diamond ♦️
  diamond: (x, y, s = 1) => {
    const cx = x + 0.5;
    const cy = y + 0.5;
    const r = 0.5 * s; // Радіус від центру до вершини

    return `
      M ${f(cx)} ${f(cy - r)} 
      L ${f(cx + r)} ${f(cy)} 
      L ${f(cx)} ${f(cy + r)} 
      L ${f(cx - r)} ${f(cy)} 
      Z
    `;
  },

  // Hexagon ⬢
  hexagon: (x, y, s = 1) => {
    const cx = x + 0.5;
    const cy = y + 0.5;
    const r = 0.48 * s; // Радіус (трохи менше 0.5 щоб не злипалось при s=1)
    const w = r * 0.577; // tan(30) * r ≈ ширина верхньої грані

    return `
      M ${f(cx - w)} ${f(cy - r)} 
      L ${f(cx + w)} ${f(cy - r)} 
      L ${f(cx + r)} ${f(cy)} 
      L ${f(cx + w)} ${f(cy + r)} 
      L ${f(cx - w)} ${f(cy + r)} 
      L ${f(cx - r)} ${f(cy)} 
      Z
    `;
  },

  // Leaf 🍃
  leaf: (x, y, s = 1) => {
    const cx = x + 0.5;
    const cy = y + 0.5;
    const r = 0.5 * s;
    const curveR = 0.8 * s; // Радіус кривизни дуги

    return `
      M ${f(cx)} ${f(cy - r)} 
      A ${f(curveR)} ${f(curveR)} 0 0 1 ${f(cx)} ${f(cy + r)} 
      A ${f(curveR)} ${f(curveR)} 0 0 1 ${f(cx)} ${f(cy - r)} 
      Z
    `;
  },

  // Triangle ▲
  triangle: (x, y, s = 1) => {
    const cx = x + 0.5;
    const cy = y + 0.5;
    const r = 0.5 * s;
    // Зсуваємо трохи вниз, щоб візуально було по центру
    const offsetY = 0.1 * s;

    return `
      M ${f(cx)} ${f(cy - r + offsetY)} 
      L ${f(cx + r)} ${f(cy + r + offsetY)} 
      L ${f(cx - r)} ${f(cy + r + offsetY)} 
      Z
    `;
  },
};
