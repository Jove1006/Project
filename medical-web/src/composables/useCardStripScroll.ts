import { watch, onUnmounted, type Ref } from 'vue';

/**
 * 底部卡片栏滚动与事件隔离
 * - 鼠标滚轮 → 横向滚动（阻止冒泡到 VTK 3D 视图）
 * - pointer 进入卡片区域时确保事件不穿透到底层 canvas
 */
export function useCardStripScroll(elRef: Ref<HTMLElement | null>) {
  let el: HTMLElement | null = null;

  const onWheel = (e: WheelEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (el) el.scrollLeft += e.deltaY;
  };

  const onPointerEnter = () => {
    el?.style.setProperty('pointer-events', 'auto');
  };

  const onPointerLeave = () => {};

  const bindEvents = (element: HTMLElement) => {
    el = element;
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerenter', onPointerEnter);
    el.addEventListener('pointerleave', onPointerLeave);
  };

  const unbindEvents = () => {
    if (!el) return;
    el.removeEventListener('wheel', onWheel);
    el.removeEventListener('pointerenter', onPointerEnter);
    el.removeEventListener('pointerleave', onPointerLeave);
    el = null;
  };

  watch(elRef, (newEl) => {
    unbindEvents();
    if (newEl) bindEvents(newEl);
  });

  onUnmounted(unbindEvents);
}
