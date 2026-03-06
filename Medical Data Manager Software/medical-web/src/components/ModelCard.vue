<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ModelCardInfo } from '../types/model';

const props = defineProps<{
  info: ModelCardInfo;
  selected?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:color', index: number, color: string): void;
  (e: 'update:opacity', index: number, opacity: number): void;
  (e: 'select', index: number): void;
}>();

const isVisible = ref(true);
const savedOpacity = ref(1);
const opacitySteps = [0, 0.25, 0.5, 0.75, 1] as const;

const toggleVisibility = () => {
  isVisible.value = !isVisible.value;
  if (isVisible.value) {
    emit('update:opacity', props.info.index, savedOpacity.value);
  } else {
    savedOpacity.value = props.info.opacity || 1;
    emit('update:opacity', props.info.index, 0);
  }
};

const volumeDisplay = computed(() => {
  const v = props.info.volume;
  if (v <= 0) return '—';
  return v >= 1000 ? (v / 1000).toFixed(1) + ' cm³' : v.toFixed(1) + ' mm³';
});

const onColorChange = (e: Event) => {
  emit('update:color', props.info.index, (e.target as HTMLInputElement).value);
};

const setOpacity = (val: number) => {
  if (!isVisible.value && val > 0) isVisible.value = true;
  if (val === 0) {
    isVisible.value = false;
    savedOpacity.value = props.info.opacity || 0.25;
  } else {
    savedOpacity.value = val;
  }
  emit('update:opacity', props.info.index, val);
};

const activeStep = computed(() => {
  const cur = props.info.opacity;
  let best = 0, minDiff = Infinity;
  for (let i = 0; i < opacitySteps.length; i++) {
    const diff = Math.abs(cur - (opacitySteps[i] ?? 0));
    if (diff < minDiff) { minDiff = diff; best = i; }
  }
  return best;
});

watch(() => props.info.opacity, (val) => {
  if (val > 0) { isVisible.value = true; savedOpacity.value = val; }
  else { isVisible.value = false; }
});
</script>

<template>
  <div
    class="model-card"
    :class="{ 'is-hidden': !isVisible, 'is-selected': selected }"
    :style="{ '--accent-color': info.colorHex } as any"
    @click="emit('select', info.index)"
  >
    <!-- 顶部颜色标识条 -->
    <div class="color-accent" :style="{ backgroundColor: info.colorHex }" />

    <!-- 名称 + 可见性切换 -->
    <div class="card-header">
      <div class="card-name" :title="info.name">{{ info.name }}</div>
      <button
        class="vis-btn"
        :title="isVisible ? '隐藏模型' : '显示模型'"
        @click="toggleVisibility"
      >
        <!-- 眼睛图标 -->
        <svg v-if="isVisible" width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <!-- 眼睛关闭图标 -->
        <svg v-else width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45
            18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8
            11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      </button>
    </div>

    <!-- 体积 -->
    <div class="card-volume">
      <svg class="vol-icon" width="10" height="10" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7
          4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2
          0l7-4A2 2 0 0 0 21 16z"/>
      </svg>
      {{ volumeDisplay }}
    </div>

    <!-- 颜色 + 透明度 -->
    <div class="card-controls">
      <label class="color-control" title="颜色">
        <input type="color" :value="info.colorHex" @input="onColorChange" />
      </label>
      <div class="opacity-steps">
        <button
          v-for="(step, i) in opacitySteps"
          :key="step"
          class="step-btn"
          :class="{ active: i === activeStep, filled: i <= activeStep }"
          :style="{ '--step-alpha': step }"
          :title="Math.round(step * 100) + '%'"
          @click="setOpacity(step)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.model-card {
  flex-shrink: 0;
  /* 刚好放 8 张卡片：(视口宽 - 左右padding 32px - 7个gap 70px) / 8 */
  width: calc((100vw - 102px) / 8);
  min-width: 130px;
  aspect-ratio: 5 / 3;
  padding: 0 14px 14px;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 10px;
  color: #e0e0e0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 6px;
  overflow: hidden;
  transition: transform 0.25s ease, box-shadow 0.25s ease,
              opacity 0.25s ease, border-color 0.25s ease;
  user-select: none;
}

.model-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  border-color: rgba(255, 255, 255, 0.18);
}

.model-card.is-selected {
  border-color: rgba(255, 255, 255, 0.55);
  transform: translateY(-4px) scale(1.03);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.3),
    0 8px 24px -4px var(--accent-color, rgba(255, 255, 255, 0.2)),
    0 4px 32px rgba(255, 255, 255, 0.06);
}

.model-card.is-selected:hover {
  transform: translateY(-5px) scale(1.04);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.4),
    0 10px 28px -4px var(--accent-color, rgba(255, 255, 255, 0.25)),
    0 6px 36px rgba(255, 255, 255, 0.08);
}

.model-card.is-selected .color-accent {
  height: 6px;
  box-shadow: 0 2px 12px var(--accent-color, rgba(255, 255, 255, 0.3));
}

.model-card.is-hidden {
  opacity: 0.45;
  transform: scale(0.97);
}
.model-card.is-hidden:hover {
  opacity: 0.65;
  transform: scale(0.97) translateY(-1px);
}

.color-accent {
  height: 4px;
  margin: 0 -14px;
  border-radius: 0 0 2px 2px;
  transition: background-color 0.3s ease, height 0.25s ease, box-shadow 0.25s ease;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}

.card-name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #fff;
  min-width: 0;
}

.vis-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  padding: 0;
  transition: color 0.15s, background 0.15s;
}
.vis-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.card-volume {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}
.vol-icon {
  opacity: 0.5;
}

.card-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.color-control input[type="color"] {
  -webkit-appearance: none;
  appearance: none;
  width: 26px;
  height: 26px;
  border: 2px solid rgba(255, 255, 255, 0.22);
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  background: none;
  transition: border-color 0.15s;
}
.color-control input[type="color"]:hover {
  border-color: rgba(255, 255, 255, 0.45);
}
.color-control input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}
.color-control input[type="color"]::-webkit-color-swatch {
  border: none;
  border-radius: 50%;
}

.opacity-steps {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  flex: 1;
  min-width: 0;
  height: 18px;
}

.step-btn {
  --step-alpha: 0;
  flex: 1;
  min-width: 0;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  padding: 0;
  transition: transform 0.15s, box-shadow 0.15s, filter 0.15s;
  height: calc(5px + var(--step-alpha) * 13px);
  background: rgba(255, 255, 255, calc(0.12 + var(--step-alpha) * 0.88));
}

.step-btn.filled {
  background: rgba(255, 255, 255, calc(0.15 + var(--step-alpha) * 0.85));
  box-shadow: 0 0 3px rgba(255, 255, 255, 0.08);
}

.step-btn.active {
  box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.5);
}

.step-btn:not(.filled) {
  opacity: 0.25;
}

.step-btn:hover {
  transform: scaleX(1.15);
  filter: brightness(1.3);
}
.step-btn:not(.filled):hover {
  opacity: 0.55;
}
</style>
