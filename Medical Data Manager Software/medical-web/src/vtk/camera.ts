const OUTLIER_FACTOR = 10;

/** 智能重置相机：自动排除包围盒异常 Actor，避免极端顶点拉远视角 */
export function smartResetCamera(renderer: any): void {
  const actors: any[] = renderer.getActors() ?? [];
  if (!actors.length) { renderer.resetCamera(); return; }

  const infos = actors
    .map(a => a.getBounds?.() as number[] | null)
    .filter((b): b is number[] => !!b)
    .map(b => ({ b, diag: Math.hypot(b[1]! - b[0]!, b[3]! - b[2]!, b[5]! - b[4]!) }));

  const sorted = infos.map(i => i.diag).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;

  const merged = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
  let normalCount = 0;

  for (const { b, diag } of infos) {
    if (median > 0 && diag > median * OUTLIER_FACTOR) {
      console.warn(`[VTK] Skipping outlier actor (diag=${diag.toFixed(1)}, median=${median.toFixed(1)})`);
      continue;
    }
    for (let i = 0; i < 6; i++) {
      merged[i] = i % 2 === 0 ? Math.min(merged[i]!, b[i]!) : Math.max(merged[i]!, b[i]!);
    }
    normalCount++;
  }

  renderer.resetCamera(normalCount > 0 && normalCount < infos.length ? merged : undefined);
}
