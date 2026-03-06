<script setup lang="ts">
import { onMounted, ref, nextTick, computed } from 'vue';
import Topbar from './components/Topbar.vue';
import VtkRenderer from './components/VtkRenderer.vue';
import ModelCard from './components/ModelCard.vue';
import { useViewer } from './composables/useViewer';
import { useSelection } from './composables/useSelection';
import { useCardStripScroll } from './composables/useCardStripScroll';
import { useBackground } from './composables/useBackground';
import { useAnnotations } from './composables/useAnnotations';

const vtkRendererRef = ref<InstanceType<typeof VtkRenderer> | null>(null);
const cardStripRef = ref<HTMLElement | null>(null);
const cardRefs = ref<Map<number, HTMLElement>>(new Map());
useCardStripScroll(cardStripRef);
const { modelCards, isLoading, initialize, onColorChange, onOpacityChange, resetView } =
  useViewer(vtkRendererRef);
const { selectedIndex, onScenePick, onCardSelect, clearSelection } =
  useSelection(vtkRendererRef as any);
const { toggleBackground } = useBackground(vtkRendererRef as any);
const { annotationMode, startDistance, startAngle, startLabel, deleteSelected, clearAnnotations } = useAnnotations(vtkRendererRef as any);
const cardsVisible = ref(true);
const isRotating = ref(false);
const isDragging = ref(false);
const isExploded = ref(false);
const showCards = computed(() => cardsVisible.value && modelCards.length > 0);
function toggleCards(): void { cardsVisible.value = !cardsVisible.value; }
function handleToggleRotate(): void {
  const rotating = vtkRendererRef.value?.toggleAutoRotate();
  isRotating.value = !!rotating;
}
function handleToggleDrag(): void {
  const dragging = vtkRendererRef.value?.toggleDragMode();
  isDragging.value = !!dragging;
}
function handleToggleExplode(): void {
  const exploded = vtkRendererRef.value?.toggleExplode();
  isExploded.value = !!exploded;
}
function handleResetPositions(): void {
  vtkRendererRef.value?.resetAllPositions();
  isExploded.value = false;
}

/** 注册卡片 DOM 引用 */
function setCardRef(index: number, el: any): void {
  if (el?.$el) {
    cardRefs.value.set(index, el.$el);
  }
}

/** 点击 3D 模型 / 空白 → 卡片滚动到视图 */
function handleScenePick(index: number): void {
  onScenePick(index);
  if (index >= 0) {
    nextTick(() => {
      const el = cardRefs.value.get(index);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  }
}

/** 重置时清除选中 */
function handleReset(): void {
  // 重置时停止所有特效
  vtkRendererRef.value?.stopAutoRotate();
  isRotating.value = false;
  vtkRendererRef.value?.disableDragMode();
  isDragging.value = false;
  vtkRendererRef.value?.resetExplode();
  isExploded.value = false;
  clearAnnotations();
  clearSelection();
  resetView();
}

onMounted(() => {
  void initialize();
});
</script>

<template>
  <div id="app">
    <Topbar v-if="!isLoading" :cards-visible="cardsVisible" :rotating="isRotating" :dragging="isDragging" :exploded="isExploded" :annotation-mode="annotationMode"
      @reset="handleReset" @toggle-bg="toggleBackground" @toggle-cards="toggleCards"
      @toggle-rotate="handleToggleRotate" @toggle-drag="handleToggleDrag" @reset-positions="handleResetPositions" @toggle-explode="handleToggleExplode"
      @measure-distance="startDistance" @measure-angle="startAngle" @add-label="startLabel" @delete-annotation="deleteSelected" />
    <VtkRenderer ref="vtkRendererRef" @pick="handleScenePick" />

    <!-- 底部模型卡片栏 -->
    <div v-show="showCards" ref="cardStripRef" class="card-strip">
      <ModelCard
        v-for="card in modelCards"
        :key="card.index"
        :ref="(el: any) => setCardRef(card.index, el)"
        :info="card"
        :selected="selectedIndex === card.index"
        @select="onCardSelect"
        @update:color="onColorChange"
        @update:opacity="onOpacityChange"
      />
    </div>

    <!-- 加载提示 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner" />
      <span class="loading-text">加载模型中</span>
    </div>
  </div>
</template>

<style scoped>
#app {
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background-color: #1a1a1a;
}

/* 底部卡片栏 */
.card-strip {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  overflow-x: auto;
  overflow-y: hidden;
  /* 渐变背景让卡片与场景自然过渡 */
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.45) 40%);
  /* 隐藏滚动条但保留滚动功能 */
  scrollbar-width: none;
}

.card-strip::-webkit-scrollbar {
  display: none;
}

/* 加载遮罩 */
.loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255, 255, 255, 0.15);
  border-top-color: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  letter-spacing: 1px;
}
</style>
