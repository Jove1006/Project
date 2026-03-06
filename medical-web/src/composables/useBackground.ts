import type { Ref } from 'vue';

type Renderer = { setBackground(gradient: string): void } | null;

/** 5 级径向渐变预设：从最白到最黑（模仿老平台风格） */
const PRESETS = [
  'radial-gradient(at center center, #d0d0d0 20%, #525a63 100%)',  // 1 浅灰（默认）
  'radial-gradient(at center center, #a0a0a0 20%, #3a3a3a 100%)',  // 2 灰
  'radial-gradient(at center center, #6a6a6a 20%, #222222 100%)',  // 3 中灰
  'radial-gradient(at center center, #383838 20%, #0e0e0e 100%)',  // 4 深灰
  'radial-gradient(at center center, #141414 20%, #000000 100%)',  // 5 最黑
];

/** 背景渐变循环切换 */
export function useBackground(rendererRef: Ref<Renderer>) {
  let index = 0;

  function toggleBackground(): void {
    index = (index + 1) % PRESETS.length;
    rendererRef.value?.setBackground(PRESETS[index]!);
  }

  return { toggleBackground };
}
