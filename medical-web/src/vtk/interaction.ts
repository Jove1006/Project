/** 鼠标交互：左键旋转 | 中键缩放 | 右键平移 | Shift+左键平移 | 滚轮缩放 */
import vtkInteractorStyleManipulator from '@kitware/vtk.js/Interaction/Style/InteractorStyleManipulator';
import vtkMouseCameraTrackballRotateManipulator from '@kitware/vtk.js/Interaction/Manipulators/MouseCameraTrackballRotateManipulator';
import vtkMouseCameraTrackballZoomManipulator from '@kitware/vtk.js/Interaction/Manipulators/MouseCameraTrackballZoomManipulator';
import vtkMouseCameraTrackballPanManipulator from '@kitware/vtk.js/Interaction/Manipulators/MouseCameraTrackballPanManipulator';
import vtkMouseCameraTrackballZoomToMouseManipulator from '@kitware/vtk.js/Interaction/Manipulators/MouseCameraTrackballZoomToMouseManipulator';
import type vtkRenderWindowInteractor from '@kitware/vtk.js/Rendering/Core/RenderWindowInteractor';

type InteractorInstance = ReturnType<typeof vtkRenderWindowInteractor.newInstance>;

export function setupInteraction(interactor: InteractorInstance, container: HTMLElement) {
  const style = vtkInteractorStyleManipulator.newInstance();

  const rotate = vtkMouseCameraTrackballRotateManipulator.newInstance();
  rotate.setButton(1);
  rotate.setUseFocalPointAsCenterOfRotation(true);

  const zoom = vtkMouseCameraTrackballZoomManipulator.newInstance();
  zoom.setButton(2);

  const pan = vtkMouseCameraTrackballPanManipulator.newInstance();
  pan.setButton(3);

  const scroll = vtkMouseCameraTrackballZoomToMouseManipulator.newInstance();
  scroll.setScrollEnabled(true);
  scroll.setDragEnabled(false); // 仅响应滚轮，不响应鼠标按键拖拽

  const shiftPan = vtkMouseCameraTrackballPanManipulator.newInstance();
  shiftPan.setButton(1);
  shiftPan.setShift(true);

  [rotate, zoom, pan, scroll, shiftPan].forEach(m => style.addMouseManipulator(m));

  interactor.setInteractorStyle(style);
  interactor.bindEvents(container);

  const preventCtx = (e: Event) => e.preventDefault();
  container.addEventListener('contextmenu', preventCtx);

  /* ── 安全网：防止 currentManipulator 卡死导致交互失灵 ──
   *
   * VTK.js InteractorStyleManipulator 内部维护 currentManipulator 状态，
   * 一旦 pointerup 丢失（窗口失焦、浏览器干扰、pointer capture 被打断等），
   * currentManipulator 不会被清除，后续所有鼠标操作都会被 onButtonDown
   * 的 `if (model.currentManipulator) return` 守卫拦截。
   *
   * 以下两个监听器确保卡死状态能被自动恢复：
   */

  // 1) 在 document 上监听 pointerup —— 当所有鼠标按钮都已释放时强制重置
  //    如果 VTK 已正常处理了 pointerup，currentManipulator 本就是 null，重置无副作用
  //    如果 VTK 没收到 pointerup（卡死场景），此处修复它
  const safetyReset = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      (style as any).resetCurrentManipulator?.();
    }
  };
  document.addEventListener('pointerup', safetyReset);

  // 2) 窗口失焦时强制重置（Alt-Tab、点击其它窗口等场景）
  const onBlur = () => {
    (style as any).resetCurrentManipulator?.();
  };
  window.addEventListener('blur', onBlur);

  /** 拖拽模式用的额外 manipulator：右键旋转 */
  const dragRotate = vtkMouseCameraTrackballRotateManipulator.newInstance();
  dragRotate.setButton(3);
  dragRotate.setUseFocalPointAsCenterOfRotation(true);

  /**
   * 进入拖拽模式布局：
   * - 移除左键旋转 & 右键平移 & Shift+左键平移
   * - 左键留给 VtkRenderer 的拖拽逻辑
   * - 右键改为旋转相机
   * - 中键缩放 & 滚轮缩放保留
   */
  function enterDragLayout(): void {
    style.removeMouseManipulator(rotate);
    style.removeMouseManipulator(pan);
    style.removeMouseManipulator(shiftPan);
    style.addMouseManipulator(dragRotate);
  }

  /** 退出拖拽模式布局，恢复正常 */
  function exitDragLayout(): void {
    style.removeMouseManipulator(dragRotate);
    style.addMouseManipulator(rotate);
    style.addMouseManipulator(pan);
    style.addMouseManipulator(shiftPan);
  }

  return {
    enterDragLayout,
    exitDragLayout,
    cleanup() {
      document.removeEventListener('pointerup', safetyReset);
      window.removeEventListener('blur', onBlur);
      interactor.unbindEvents();
      container.removeEventListener('contextmenu', preventCtx);
      style.removeAllMouseManipulators();
      [rotate, zoom, pan, scroll, shiftPan, dragRotate].forEach(m => m.delete());
      style.delete();
    },
  };
}
