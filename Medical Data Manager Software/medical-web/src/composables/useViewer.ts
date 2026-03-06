import { ref, reactive, type Ref } from 'vue';
import { fetchModelBundle, type BundleResult, type BundleFileItem } from '../api/files';
import type { ModelCardInfo } from '../types/model';
import type VtkRenderer from '../components/VtkRenderer.vue';

type VtkRendererInstance = InstanceType<typeof VtkRenderer>;
type PrefetchResult = BundleResult | null;

/**
 * 3D 查看器核心逻辑
 * - 预取模型数据（与 WebGL 初始化并行）
 * - 加载 STL/OBJ/PLY 到场景
 * - 管理模型卡片状态、颜色、透明度
 * - 提供重置视图功能
 */
export function useViewer(rendererRef: Ref<VtkRendererInstance | null>) {
  const recordNo = ref('');
  const files = ref<BundleFileItem[]>([]);
  const isLoading = ref(false);
  const modelCards = reactive<ModelCardInfo[]>([]);
  const initialColors = new Map<number, string>();

  // 预取：在 setup 阶段立即发起网络请求，与 WebGL 初始化并行
  const params = new URLSearchParams(window.location.search);
  const initialRecordNo = params.get('record_no') || '';
  const prefetchPromise: Promise<PrefetchResult[]> | null = initialRecordNo
    ? fetchModelBundle(initialRecordNo).catch(err => {
        console.error('Prefetch model bundle failed:', err);
        return [] as BundleResult[];
      })
    : null;

  /** 加载所有模型文件到场景 */
  async function loadAllModels(prefetched: PrefetchResult[]): Promise<void> {
    const renderer = rendererRef.value;
    if (!renderer) return;

    for (let i = 0; i < prefetched.length; i++) {
      const result = prefetched[i];
      if (!result) continue;
      const colorHex = result.file.color_hex ?? undefined;
      const info = renderer.loadModel(result.buffer, colorHex, true);
      if (info) {
        const name = result.file.original_name.replace(/\.(stl|obj|ply)$/i, '');
        const finalColor = colorHex ?? '#ffffff';
        initialColors.set(info.index, finalColor);
        modelCards.push({
          index: info.index,
          name,
          volume: info.volume,
          colorHex: finalColor,
          opacity: 1,
        });
      }
    }
    renderer.resetCamera();
  }

  /** 从 URL 读取 record_no 并初始化加载所有模型 */
  async function initialize(): Promise<void> {
    recordNo.value = initialRecordNo;

    if (!recordNo.value) {
      console.warn('No record_no parameter found in URL');
      return;
    }

    try {
      isLoading.value = true;

      const prefetched = prefetchPromise ? await prefetchPromise : [];
      files.value = prefetched.filter(Boolean).map(r => r!.file);

      if (files.value.length === 0) {
        console.warn('No model files found for this record');
        return;
      }

      await loadAllModels(prefetched);
      console.log(`Successfully loaded ${files.value.length} models`);
    } catch (error) {
      console.error('Failed to initialize viewer:', error);
    } finally {
      isLoading.value = false;
    }
  }

  /** 更新指定模型颜色 */
  function onColorChange(index: number, color: string): void {
    const card = modelCards.find(c => c.index === index);
    if (card) card.colorHex = color;
    rendererRef.value?.setModelColor(index, color);
  }

  /** 更新指定模型透明度 */
  function onOpacityChange(index: number, opacity: number): void {
    const card = modelCards.find(c => c.index === index);
    if (card) card.opacity = opacity;
    rendererRef.value?.setModelOpacity(index, opacity);
  }

  /** 重置相机、颜色、透明度到初始状态 */
  function resetView(): void {
    const renderer = rendererRef.value;
    if (!renderer) return;

    for (const card of modelCards) {
      const origColor = initialColors.get(card.index) ?? '#ffffff';
      card.colorHex = origColor;
      card.opacity = 1;
      renderer.setModelColor(card.index, origColor);
      renderer.setModelOpacity(card.index, 1);
    }
    renderer.resetCamera();
  }

  return {
    recordNo,
    files,
    isLoading,
    modelCards,
    initialize,
    onColorChange,
    onOpacityChange,
    resetView,
  };
}
