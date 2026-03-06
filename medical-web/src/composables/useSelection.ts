/**
 * 模型与卡片双向选中联动
 * - 点击模型/卡片 → 高亮对应模型（颜色提亮 + 镜面增强）
 * - 点击 3D 场景空白 → 取消选中
 */
import { ref, type Ref } from 'vue';

export interface SelectionRenderer {
  highlightModel: (index: number) => void;
  unhighlightModel: (index: number) => void;
}

export function useSelection(rendererRef: Ref<SelectionRenderer | null>) {
  const selectedIndex = ref(-1);

  /** 选中指定模型（自动取消旧高亮） */
  function selectModel(index: number): void {
    const renderer = rendererRef.value;
    if (!renderer) return;

    if (selectedIndex.value >= 0 && selectedIndex.value !== index) {
      renderer.unhighlightModel(selectedIndex.value);
    }
    if (index !== selectedIndex.value) {
      renderer.highlightModel(index);
      selectedIndex.value = index;
    }
  }

  /** 取消所有选中 */
  function clearSelection(): void {
    const renderer = rendererRef.value;
    if (selectedIndex.value >= 0) {
      renderer?.unhighlightModel(selectedIndex.value);
    }
    selectedIndex.value = -1;
  }

  /** 3D 场景点击回调（index < 0 表示点击空白） */
  function onScenePick(index: number): void {
    index < 0 ? clearSelection() : selectModel(index);
  }

  /** 卡片点击回调 */
  function onCardSelect(index: number): void {
    selectModel(index);
  }

  return {
    selectedIndex,
    selectModel,
    clearSelection,
    onScenePick,
    onCardSelect,
  };
}
