/** 计算封闭三角网格体积（有符号四面体法），返回绝对值（mm³） */
export function computeVolume(polyData: any): number {
  const pts = polyData.getPoints()?.getData();
  const cells = polyData.getPolys()?.getData();
  if (!pts || !cells) return 0;

  let vol = 0;
  for (let i = 0; i < cells.length; ) {
    const n = cells[i++];
    if (n !== 3) { i += n; continue; }
    const a = cells[i++] * 3, b = cells[i++] * 3, c = cells[i++] * 3;
    vol += pts[a]     * (pts[b + 1] * pts[c + 2] - pts[c + 1] * pts[b + 2])
         + pts[b]     * (pts[c + 1] * pts[a + 2] - pts[a + 1] * pts[c + 2])
         + pts[c]     * (pts[a + 1] * pts[b + 2] - pts[b + 1] * pts[a + 2]);
  }
  return Math.abs(vol / 6);
}
