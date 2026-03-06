/**
 * useAnnotations — 标注系统的 Vue 组合式 API
 *
 * 管理标注模式状态，桥接 AnnotationManager 与 UI
 */
import { ref, type Ref, onUnmounted } from 'vue';
import { AnnotationManager, type AnnotationMode } from '../vtk/annotations';
import type VtkRenderer from '../components/VtkRenderer.vue';

type RendererRef = Ref<InstanceType<typeof VtkRenderer> | null>;

export function useAnnotations(vtkRendererRef: RendererRef) {
  const annotationMode = ref<AnnotationMode>(null);
  let manager: AnnotationManager | null = null;

  function ensureManager(): AnnotationManager | null {
    if (manager) return manager;
    const comp = vtkRendererRef.value;
    if (!comp) return null;
    const ctx = (comp as any).getAnnotationContext?.();
    if (!ctx) return null;

    manager = new AnnotationManager({
      renderer: ctx.renderer,
      interactor: ctx.interactor,
      openGLRenderWindow: ctx.openGLRenderWindow,
      overlay: ctx.overlay,
      onModeEnd: () => {
        annotationMode.value = null;
        syncSuppressPick(false); // 标注完成后恢复卡片拾取
      },
      onLabelInput: (resolve) => {
        const text = prompt('输入标签文字：');
        resolve(text);
      },
    });
    return manager;
  }

  /** 进入/退出标注模式时，同步屏蔽卡片拾取 */
  function syncSuppressPick(active: boolean) {
    (vtkRendererRef.value as any)?.setSuppressPick?.(active);
  }

  function startDistance(): void {
    const m = ensureManager();
    if (!m) return;
    if (annotationMode.value === 'distance') {
      m.exitMode();
      annotationMode.value = null;
      syncSuppressPick(false);
    } else {
      m.enterDistanceMode();
      annotationMode.value = 'distance';
      syncSuppressPick(true);
    }
  }

  function startAngle(): void {
    const m = ensureManager();
    if (!m) return;
    if (annotationMode.value === 'angle') {
      m.exitMode();
      annotationMode.value = null;
      syncSuppressPick(false);
    } else {
      m.enterAngleMode();
      annotationMode.value = 'angle';
      syncSuppressPick(true);
    }
  }

  function startLabel(): void {
    const m = ensureManager();
    if (!m) return;
    if (annotationMode.value === 'label') {
      m.exitMode();
      annotationMode.value = null;
      syncSuppressPick(false);
    } else {
      m.enterLabelMode();
      annotationMode.value = 'label';
      syncSuppressPick(true);
    }
  }

  function deleteSelected(): void {
    const m = ensureManager();
    m?.deleteSelected();
  }

  function clearAnnotations(): void {
    manager?.clearAll();
    annotationMode.value = null;
    syncSuppressPick(false);
  }

  onUnmounted(() => {
    manager?.dispose();
    manager = null;
  });

  return {
    annotationMode,
    startDistance,
    startAngle,
    startLabel,
    deleteSelected,
    clearAnnotations,
  };
}
