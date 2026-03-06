<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{ cardsVisible?: boolean; rotating?: boolean; dragging?: boolean; exploded?: boolean; annotationMode?: string | null }>();
const emit = defineEmits<{ (e: 'reset'): void; (e: 'toggle-bg'): void; (e: 'toggle-cards'): void; (e: 'toggle-rotate'): void; (e: 'toggle-drag'): void; (e: 'reset-positions'): void; (e: 'toggle-explode'): void; (e: 'measure-distance'): void; (e: 'measure-angle'): void; (e: 'add-label'): void; (e: 'delete-annotation'): void }>();
const goBack = () => window.history.back();
const resetView = () => emit('reset');
const toggleBg = () => emit('toggle-bg');
const toggleCards = () => emit('toggle-cards');

const toolsOpen = ref(false);
const toggleTools = () => { toolsOpen.value = !toolsOpen.value; };
</script>

<template>
  <!-- 返回按钮（始终显示） -->
  <button class="top-btn back" @click="goBack" title="返回">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
  </button>

  <!-- 工具箱按钮（始终显示） -->
  <button class="top-btn tools" :class="{ active: toolsOpen }" @click="toggleTools" title="工具箱">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
    </svg>
  </button>

  <!-- 水平弹出：重置 / 背景 / 卡片 -->
  <TransitionGroup name="hpop" tag="div" class="h-row">
    <button v-if="toolsOpen" class="top-btn hbtn" style="--j:0" key="toggle-cards"
      :class="{ 'is-off': !props.cardsVisible }"
      @click="toggleCards" :title="props.cardsVisible ? '隐藏卡片' : '显示卡片'">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    </button>
    <button v-if="toolsOpen" class="top-btn hbtn" style="--j:1" key="toggle-bg"
      @click="toggleBg" title="切换背景">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>
    </button>
    <button v-if="toolsOpen" class="top-btn hbtn" style="--j:2" key="reset"
      @click="resetView" title="重置视图">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 4v6h6"/>
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
      </svg>
    </button>
  </TransitionGroup>

  <!-- 垂直弹出：截图 / 测量 / 剖面 / 全屏 -->
  <TransitionGroup name="vpop" tag="div" class="v-col">
    <button v-if="toolsOpen" class="top-btn vbtn" :class="{ 'is-active': props.rotating }" style="--i:0" key="auto-rotate" title="自动旋转" @click="emit('toggle-rotate')">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21.5 2v6h-6"/>
        <path d="M2.5 22v-6h6"/>
        <path d="M2.5 11.5a10 10 0 0 1 18.42-4L21.5 8"/>
        <path d="M21.5 12.5a10 10 0 0 1-18.42 4L2.5 16"/>
      </svg>
    </button>
    <button v-if="toolsOpen" class="top-btn vbtn" :class="{ 'is-active': props.dragging }" style="--i:1" key="drag-mode" title="拖拽模式" @click="emit('toggle-drag')">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 9l-3 3 3 3"/>
        <path d="M9 5l3-3 3 3"/>
        <path d="M15 19l-3 3-3-3"/>
        <path d="M19 9l3 3-3 3"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <line x1="12" y1="2" x2="12" y2="22"/>
      </svg>
    </button>
    <button v-if="toolsOpen" class="top-btn vbtn" style="--i:2" key="reset-positions" title="复位模型" @click="emit('reset-positions')">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9"/>
        <polyline points="3 7 3 3 7 3"/>
      </svg>
    </button>
    <button v-if="toolsOpen" class="top-btn vbtn" :class="{ 'is-active': props.exploded }" style="--i:3" key="explode" title="爆炸视图" @click="emit('toggle-explode')">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 12h4M18 12h4M12 2v4M12 18v4"/>
        <path d="M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"/>
        <path d="M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
    </button>
    <button v-if="toolsOpen" class="top-btn vbtn" style="--i:4" key="fullscreen" title="全屏">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
      </svg>
    </button>

    <!-- 标注工具 -->
    <button v-if="toolsOpen" class="top-btn vbtn" :class="{ 'is-active': props.annotationMode === 'distance' }" style="--i:5" key="measure-distance" title="距离测量" @click="emit('measure-distance')">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0z"/>
        <path d="m14.5 12.5 2-2M10.5 16.5l2-2M6.5 12.5l2-2M10.5 8.5l2-2"/>
      </svg>
    </button>
    <button v-if="toolsOpen" class="top-btn vbtn" :class="{ 'is-active': props.annotationMode === 'angle' }" style="--i:6" key="measure-angle" title="角度测量" @click="emit('measure-angle')">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 20h16"/>
        <path d="M4 20L16 4"/>
        <path d="M4 20c0 0 3-0.5 6-3"/>
      </svg>
    </button>
    <button v-if="toolsOpen" class="top-btn vbtn" :class="{ 'is-active': props.annotationMode === 'label' }" style="--i:7" key="add-label" title="标签标注" @click="emit('add-label')">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2v8"/>
        <circle cx="12" cy="14" r="4"/>
        <path d="M3.5 20.5l5-5M20.5 20.5l-5-5"/>
      </svg>
    </button>
    <button v-if="toolsOpen" class="top-btn vbtn" style="--i:8" key="delete-annotation" title="删除标注" @click="emit('delete-annotation')">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        <line x1="10" y1="11" x2="10" y2="17"/>
        <line x1="14" y1="11" x2="14" y2="17"/>
      </svg>
    </button>
  </TransitionGroup>
</template>

<style scoped>
/* 通用圆形按钮 */
.top-btn {
  position: fixed;
  z-index: 1000;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  color: #444;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 0;
}
.top-btn:hover {
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
  transform: scale(1.08);
}
.top-btn:active { transform: scale(0.94); }
.top-btn svg { width: 20px; height: 20px; }

/* 固定按钮定位 */
.back  { top: 16px; left: 16px; }
.tools { top: 16px; right: 16px; }
.tools.active {
  background: rgba(80, 80, 80, 0.85);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.12);
}

/* 水平弹出行 */
.h-row {
  position: fixed;
  top: 16px;
  right: 64px;
  z-index: 999;
  display: flex;
  flex-direction: row-reverse;
  gap: 8px;
}
.top-btn.hbtn {
  position: relative;
  width: 38px;
  height: 38px;
}
.top-btn.hbtn.is-off { opacity: 0.45; }

/* 垂直弹出列 */
.v-col {
  position: fixed;
  top: 64px;
  right: 16px;
  z-index: 999;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.top-btn.vbtn {
  position: relative;
  width: 38px;
  height: 38px;
}
.top-btn.vbtn svg { width: 18px; height: 18px; }
.top-btn.vbtn.is-active {
  background: rgba(59, 130, 246, 0.85);
  color: #fff;
  border-color: rgba(59, 130, 246, 0.3);
}

/* 水平弹出动画 */
.hpop-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
  transition-delay: calc(var(--j, 0) * 0.04s);
}
.hpop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
  transition-delay: calc((2 - var(--j, 0)) * 0.03s);
}
.hpop-enter-from { opacity: 0; transform: scale(0.3) translateX(12px); }
.hpop-leave-to   { opacity: 0; transform: scale(0.3) translateX(12px); }

/* 垂直弹出动画 */
.vpop-enter-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
  transition-delay: calc(var(--i, 0) * 0.05s);
}
.vpop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
  transition-delay: calc((3 - var(--i, 0)) * 0.03s);
}
.vpop-enter-from { opacity: 0; transform: scale(0.3) translateY(-8px); }
.vpop-leave-to   { opacity: 0; transform: scale(0.3) translateY(-8px); }
</style>
