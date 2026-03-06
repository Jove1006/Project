type RGB = [number, number, number];

/**
 * HEX 颜色字符串 → 归一化 RGB (0-1)
 * @param hex 如 "#E53935"
 */
export function hexToRgb(hex: string): RGB {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

/**
 * 归一化 RGB (0-1) → HEX 颜色字符串
 * @param r 红色分量 0-1
 * @param g 绿色分量 0-1
 * @param b 蓝色分量 0-1
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
