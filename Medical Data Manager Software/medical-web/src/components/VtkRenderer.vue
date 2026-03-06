<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { createRenderPipeline, type RenderPipeline } from '../vtk/pipeline';
import { setupLights } from '../vtk/lights';
import { STLLoader, type LoadedModelInfo } from '../vtk/loader';
import { BONE_MATERIAL } from '../vtk/material';
import { smartResetCamera } from '../vtk/camera';
import { setupPicker } from '../vtk/picker';
import vtkCellPicker from '@kitware/vtk.js/Rendering/Core/CellPicker';

const containerRef = ref<HTMLDivElement | null>(null);
const overlayRef = ref<HTMLDivElement | null>(null);
let pipeline: RenderPipeline | null = null;
let stlLoader: STLLoader | null = null;
let lightController: { updateFromCamera: () => void } | null = null;
let interactorSubscriptions: Array<{ unsubscribe: () => void }> = [];
let resizeHandler: (() => void) | null = null;
let pickerCleanup: (() => void) | null = null;
const origColors = new Map<number, [number, number, number]>();

/* ── 自动旋转状态 ── */
let autoRotateRAF: number | null = null;
const isAutoRotating = ref(false);
const AUTO_ROTATE_DEG_PER_SEC = 30; // 每秒旋转度数

/* ── 拖拽模式状态 ── */
const isDragMode = ref(false);
let dragActor: any = null;
let dragOrigPos: [number, number, number] | null = null;
let dragMouseDown = false;
let dragSubs: Array<{ unsubscribe: () => void }> = [];
let dragPicker: any = null;

/* ── 爆炸视图状态 ── */
const isExploded = ref(false);
const explodeOrigPositions = new Map<number, [number, number, number]>();
const EXPLODE_FACTOR = 0.6; // 爆炸系数，每个部件离中心的距离乘以此值

const emit = defineEmits<{ (e: 'pick', index: number): void }>();

/* ── 标注模式下屏蔽卡片拾取 ── */
let pickSuppressed = false;
function setSuppressPick(v: boolean) { pickSuppressed = v; }

function renderScene(): void { pipeline?.renderWindow.render(); }

function getActorProp(index: number) {
  const actor = stlLoader?.getActor(index);
  return actor ? actor.getProperty() : null;
}

onMounted(() => {
  const container = containerRef.value;
  if (!container) { console.error('VTK container not found'); return; }

  pipeline = createRenderPipeline(container);
  lightController = setupLights(pipeline.renderer);
  stlLoader = new STLLoader(pipeline.renderer);

  resizeHandler = () => { pipeline?.resize(); renderScene(); };
  window.addEventListener('resize', resizeHandler);

  const syncLights = () => lightController?.updateFromCamera();
  const onAnim = pipeline.interactor.onAnimation?.(syncLights);
  if (onAnim) interactorSubscriptions.push(onAnim);
  const onEnd = pipeline.interactor.onEndAnimation?.(syncLights);
  if (onEnd) interactorSubscriptions.push(onEnd);

  pickerCleanup = setupPicker({
    renderer: pipeline.renderer,
    interactor: pipeline.interactor,
    findIndex: (actor: any) => stlLoader!.findIndexByActor(actor),
    onPick: (index: number) => emit('pick', index),
    guard: () => pickSuppressed,
  }).cleanup;

  renderScene();
});

onUnmounted(() => {
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }
  stopAutoRotate();
  if (pickerCleanup) { pickerCleanup(); pickerCleanup = null; }
  if (stlLoader) { stlLoader.cleanup(); stlLoader = null; }
  interactorSubscriptions.forEach(sub => sub.unsubscribe());
  interactorSubscriptions = [];
  lightController = null;
  if (pipeline) { pipeline.cleanup(); pipeline = null; }
});

function loadModel(arrayBuffer: ArrayBuffer, colorHex?: string, skipRender = false): LoadedModelInfo | null {
  if (!stlLoader || !pipeline) { console.error('VTK pipeline not initialized'); return null; }
  const info = stlLoader.loadSTL(arrayBuffer, colorHex);
  if (!skipRender) renderScene();
  return info;
}

function setModelColor(index: number, hexColor: string): void {
  stlLoader?.setColor(index, hexColor);
  if (origColors.has(index)) {
    const prop = getActorProp(index);
    if (prop) {
      const [r, g, b] = prop.getColor() as [number, number, number];
      origColors.set(index, [r, g, b]);
      const lift = (v: number) => Math.min(1.0, v + (1.0 - v) * 0.3);
      prop.setColor(lift(r), lift(g), lift(b));
    }
  }
  renderScene();
}

function setModelOpacity(index: number, opacity: number): void {
  stlLoader?.setOpacity(index, opacity);
  renderScene();
}

function resetCamera(): void {
  if (!pipeline) return;
  smartResetCamera(pipeline.renderer);
  lightController?.updateFromCamera();
  renderScene();
}

function highlightModel(index: number): void {
  const prop = getActorProp(index);
  if (!prop) return;
  const [r, g, b] = prop.getColor() as [number, number, number];
  origColors.set(index, [r, g, b]);
  const lift = (v: number) => Math.min(1.0, v + (1.0 - v) * 0.3);
  prop.setColor(lift(r), lift(g), lift(b));
  prop.setAmbient(0.2);
  prop.setSpecular(0.4);
  prop.setSpecularPower(32);
  renderScene();
}

function unhighlightModel(index: number): void {
  const prop = getActorProp(index);
  if (!prop) return;
  const orig = origColors.get(index);
  if (orig) { prop.setColor(...orig); origColors.delete(index); }
  prop.setAmbient(BONE_MATERIAL.ambient);
  prop.setSpecular(BONE_MATERIAL.specular);
  prop.setSpecularPower(BONE_MATERIAL.specularPower);
  renderScene();
}

function setBackground(gradient: string): void {
  if (!pipeline) return;
  pipeline.renderer.setBackground(0, 0, 0, 0);
  containerRef.value!.style.background = gradient;
  renderScene();
}

/* ── 自动旋转：绕所有模型包围盒中心旋转 ── */
function computeBoundsCenter(): [number, number, number] | null {
  if (!pipeline) return null;
  const actors: any[] = pipeline.renderer.getActors() ?? [];
  if (!actors.length) return null;
  const merged = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
  for (const actor of actors) {
    const b = actor.getBounds?.() as number[] | null;
    if (!b) continue;
    for (let i = 0; i < 6; i++) {
      merged[i] = i % 2 === 0 ? Math.min(merged[i]!, b[i]!) : Math.max(merged[i]!, b[i]!);
    }
  }
  if (!isFinite(merged[0]!)) return null;
  return [
    (merged[0]! + merged[1]!) / 2,
    (merged[2]! + merged[3]!) / 2,
    (merged[4]! + merged[5]!) / 2,
  ];
}

function startAutoRotate(): void {
  if (autoRotateRAF !== null || !pipeline) return;
  const center = computeBoundsCenter();
  if (!center) return;
  isAutoRotating.value = true;

  const camera = pipeline.renderer.getActiveCamera();
  // 将焦点设为包围盒中心
  camera.setFocalPoint(...center);

  let lastTime = performance.now();
  const loop = (now: number) => {
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    if (!pipeline) { stopAutoRotate(); return; }
    // 绕焦点做方位角旋转
    camera.azimuth(AUTO_ROTATE_DEG_PER_SEC * dt);
    camera.orthogonalizeViewUp();
    // 重新计算近/远裁切面，避免旋转到某些角度时模型被截断
    pipeline!.renderer.resetCameraClippingRange();
    lightController?.updateFromCamera();
    renderScene();
    autoRotateRAF = requestAnimationFrame(loop);
  };
  autoRotateRAF = requestAnimationFrame(loop);
}

function stopAutoRotate(): void {
  if (autoRotateRAF !== null) {
    cancelAnimationFrame(autoRotateRAF);
    autoRotateRAF = null;
  }
  isAutoRotating.value = false;
}

function toggleAutoRotate(): boolean {
  if (isAutoRotating.value) { stopAutoRotate(); } else { startAutoRotate(); }
  return isAutoRotating.value;
}

/* ── 拖拽模式：选中部件后拖动位置 ── */

/** 将屏幕像素差量转换为世界坐标差量（在相机平面上移动） */
function screenDeltaToWorld(dxPx: number, dyPx: number): [number, number, number] {
  if (!pipeline) return [0, 0, 0];
  const camera = pipeline.renderer.getActiveCamera();
  const size = pipeline.openGLRenderWindow.getSize() as [number, number];
  const pos = camera.getPosition() as [number, number, number];
  const fp  = camera.getFocalPoint() as [number, number, number];

  // 相机到焦点距离
  const dist = Math.sqrt(
    (fp[0] - pos[0]) ** 2 + (fp[1] - pos[1]) ** 2 + (fp[2] - pos[2]) ** 2,
  );

  // 焦平面上可见区域的高度（世界单位）
  let viewHeight: number;
  if (camera.getParallelProjection()) {
    viewHeight = 2 * camera.getParallelScale();
  } else {
    const halfAngle = (camera.getViewAngle() * Math.PI) / 360; // 半角 rad
    viewHeight = 2 * dist * Math.tan(halfAngle);
  }
  const aspect = size[0] / size[1];
  const viewWidth = viewHeight * aspect;

  // 像素 → 世界单位
  const worldDx = (dxPx / size[0]) * viewWidth;
  const worldDy = (dyPx / size[1]) * viewHeight;

  // 相机坐标系：right / up 向量
  const dir: [number, number, number] = [fp[0] - pos[0], fp[1] - pos[1], fp[2] - pos[2]];
  const dLen = Math.sqrt(dir[0] ** 2 + dir[1] ** 2 + dir[2] ** 2) || 1;
  const nDir: [number, number, number] = [dir[0] / dLen, dir[1] / dLen, dir[2] / dLen];

  const viewUp = camera.getViewUp() as [number, number, number];
  // right = nDir × viewUp
  const right: [number, number, number] = [
    nDir[1]! * viewUp[2]! - nDir[2]! * viewUp[1]!,
    nDir[2]! * viewUp[0]! - nDir[0]! * viewUp[2]!,
    nDir[0]! * viewUp[1]! - nDir[1]! * viewUp[0]!,
  ];
  const rLen = Math.sqrt(right[0] ** 2 + right[1] ** 2 + right[2] ** 2) || 1;
  right[0] /= rLen; right[1] /= rLen; right[2] /= rLen;

  // 真正的 up = right × nDir
  const up: [number, number, number] = [
    right[1] * nDir[2]! - right[2] * nDir[1]!,
    right[2] * nDir[0]! - right[0] * nDir[2]!,
    right[0] * nDir[1]! - right[1] * nDir[0]!,
  ];

  return [
    right[0] * worldDx + up[0] * worldDy,
    right[1] * worldDx + up[1] * worldDy,
    right[2] * worldDx + up[2] * worldDy,
  ];
}

function enableDragMode(): void {
  if (isDragMode.value || !pipeline) return;
  isDragMode.value = true;
  const interactor = pipeline.interactor;
  const renderer = pipeline.renderer;

  // 切换到拖拽布局：左键留给拖拽逻辑，右键旋转相机，中键/滚轮缩放保留
  pipeline.enterDragLayout();

  dragPicker = vtkCellPicker.newInstance();
  dragPicker.setPickFromList(false);
  dragPicker.setTolerance(0.005);

  let startScreenX = 0;
  let startScreenY = 0;

  const subDown = interactor.onLeftButtonPress((callData: any) => {
    const { x, y } = callData.position;
    dragPicker.pick([x, y, 0], renderer);
    const actors = dragPicker.getActors?.() ?? [];
    if (actors.length > 0) {
      dragActor = actors[0];
      startScreenX = x;
      startScreenY = y;
      dragOrigPos = dragActor.getPosition() as [number, number, number];
      dragMouseDown = true;
    }
  });

  const subMove = interactor.onMouseMove((callData: any) => {
    if (!dragMouseDown || !dragActor || !dragOrigPos) return;
    const { x, y } = callData.position;
    const [wdx, wdy, wdz] = screenDeltaToWorld(x - startScreenX, y - startScreenY);
    dragActor.setPosition(
      dragOrigPos[0] + wdx,
      dragOrigPos[1] + wdy,
      dragOrigPos[2] + wdz,
    );
    renderScene();
  });

  const subUp = interactor.onLeftButtonRelease(() => {
    dragMouseDown = false;
    dragActor = null;
    dragOrigPos = null;
  });

  dragSubs = [subDown, subMove, subUp];
}

function disableDragMode(): void {
  isDragMode.value = false;
  dragSubs.forEach(s => s.unsubscribe());
  dragSubs = [];
  if (dragPicker) { dragPicker.delete(); dragPicker = null; }
  dragActor = null;
  dragMouseDown = false;
  // 恢复正常交互布局
  pipeline?.exitDragLayout();
}

function toggleDragMode(): boolean {
  if (isDragMode.value) { disableDragMode(); } else { enableDragMode(); }
  return isDragMode.value;
}

/* ── 爆炸视图：所有部件从中心向外散开 ── */
function explodeModels(): void {
  if (isExploded.value || !pipeline || !stlLoader) return;
  const center = computeBoundsCenter();
  if (!center) return;
  isExploded.value = true;
  explodeOrigPositions.clear();

  const actors: any[] = pipeline.renderer.getActors() ?? [];
  for (const actor of actors) {
    const b = actor.getBounds?.() as number[] | null;
    if (!b || b.length < 6) continue;
    const pos = actor.getPosition() as [number, number, number];
    explodeOrigPositions.set(actor.getObjectId?.() ?? actors.indexOf(actor), [...pos]);
    // 计算此 actor 包围盒中心（世界坐标 = 局部中心 + position）
    const cx = (b[0]! + b[1]!) / 2;
    const cy = (b[2]! + b[3]!) / 2;
    const cz = (b[4]! + b[5]!) / 2;
    // 从全局中心到此部件中心的方向
    const dx = cx - center[0]!;
    const dy = cy - center[1]!;
    const dz = cz - center[2]!;
    // 沿方向移动
    actor.setPosition(
      pos[0] + dx * EXPLODE_FACTOR,
      pos[1] + dy * EXPLODE_FACTOR,
      pos[2] + dz * EXPLODE_FACTOR,
    );
  }
  pipeline.renderer.resetCameraClippingRange();
  renderScene();
}

function resetExplode(): void {
  if (!isExploded.value || !pipeline) return;
  isExploded.value = false;
  const actors: any[] = pipeline.renderer.getActors() ?? [];
  for (const actor of actors) {
    const id = actor.getObjectId?.() ?? actors.indexOf(actor);
    const orig = explodeOrigPositions.get(id);
    if (orig) actor.setPosition(...orig);
  }
  explodeOrigPositions.clear();
  pipeline.renderer.resetCameraClippingRange();
  renderScene();
}

function toggleExplode(): boolean {
  if (isExploded.value) { resetExplode(); } else { explodeModels(); }
  return isExploded.value;
}

/** 重置所有模型位置到原点（拖拽乱了之后复位） */
function resetAllPositions(): void {
  if (!pipeline) return;
  const actors: any[] = pipeline.renderer.getActors() ?? [];
  for (const actor of actors) {
    actor.setPosition(0, 0, 0);
  }
  // 同时清除爆炸状态
  if (isExploded.value) {
    isExploded.value = false;
    explodeOrigPositions.clear();
  }
  pipeline.renderer.resetCameraClippingRange();
  renderScene();
}

/** 提供给标注系统的上下文 */
function getAnnotationContext() {
  if (!pipeline || !overlayRef.value) return null;
  return {
    renderer: pipeline.renderer,
    interactor: pipeline.interactor,
    openGLRenderWindow: pipeline.openGLRenderWindow,
    overlay: overlayRef.value,
  };
}

defineExpose({ loadModel, resetCamera, setModelColor, setModelOpacity, highlightModel, unhighlightModel, setBackground, toggleAutoRotate, stopAutoRotate, toggleDragMode, disableDragMode, toggleExplode, resetExplode, resetAllPositions, getAnnotationContext, setSuppressPick });
</script>

<template>
  <div ref="containerRef" class="vtk-renderer">
    <div ref="overlayRef" class="ann-overlay"></div>
  </div>
</template>

<style scoped>
.vtk-renderer {
  flex: 1;
  width: 100%;
  height: 100%;
  background: radial-gradient(at center center, #d0d0d0 20%, #525a63 100%);
  position: relative;
}
.ann-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
  overflow: hidden;
}
/* 标注点 */
.ann-overlay :deep(.ann-dot) {
  position: absolute;
  width: 10px;
  height: 10px;
  margin-left: -5px;
  margin-top: -5px;
  border-radius: 50%;
  background: #ffcc00;
  border: 2px solid #fff;
  box-shadow: 0 0 4px rgba(0,0,0,0.5);
  pointer-events: auto;
  cursor: pointer;
}
.ann-overlay :deep(.ann-dot.ann-pending) {
  background: #ff6600;
  animation: ann-pulse 0.8s ease-in-out infinite;
}
.ann-overlay :deep(.ann-dot.ann-selected) {
  background: #00ccff;
  border-color: #fff;
  box-shadow: 0 0 8px rgba(0,204,255,0.6);
}
/* 标注线 */
.ann-overlay :deep(.ann-line) {
  position: absolute;
  height: 2px;
  background: #ffcc00;
  transform-origin: 0 50%;
  pointer-events: none;
}
.ann-overlay :deep(.ann-line.ann-pending) {
  background: #ff6600;
  opacity: 0.7;
}
.ann-overlay :deep(.ann-line.ann-selected) {
  background: #00ccff;
}
/* 标注文字 */
.ann-overlay :deep(.ann-text) {
  position: absolute;
  transform: translate(-50%, -100%);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: auto;
  cursor: pointer;
  user-select: none;
}
.ann-overlay :deep(.ann-distance) {
  background: rgba(0,0,0,0.75);
  color: #ffcc00;
  border: 1px solid rgba(255,204,0,0.4);
}
.ann-overlay :deep(.ann-angle) {
  background: rgba(0,0,0,0.75);
  color: #ffcc00;
  border: 1px solid rgba(255,204,0,0.4);
}
.ann-overlay :deep(.ann-label) {
  background: rgba(0,0,0,0.8);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.3);
  transform: translate(0, -50%);
}
.ann-overlay :deep(.ann-text.ann-selected) {
  border-color: #00ccff;
  box-shadow: 0 0 8px rgba(0,204,255,0.4);
}
@keyframes ann-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.4); }
}
</style>
