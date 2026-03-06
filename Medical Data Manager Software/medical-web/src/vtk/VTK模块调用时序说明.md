# VTK 模块调用时序与流程说明

> 文件夹：`medical-web/src/vtk/`  
> 作用：3D 模型渲染核心模块  
> 日期：2026-02-28

---

## 📋 目录

1. [完整调用流程图](#完整调用流程图)
2. [模块调用时序表](#模块调用时序表)
3. [各模块详细调用时机](#各模块详细调用时机)
4. [代码执行时间线](#代码执行时间线)
5. [用户操作触发流程](#用户操作触发流程)
6. [生命周期总结](#生命周期总结)

---

## 完整调用流程图

```
用户点击"模型文件展示"按钮
    ↓
浏览器导航到 /viewer/?record_no=MR-2026-000001
    ↓
加载 index.html + main.ts + App.vue
    ↓
┌─────────────────────────────────────────────────────────────┐
│ App.vue - onMounted()                                       │
│ 时间：页面加载后约 10-50ms                                   │
├─────────────────────────────────────────────────────────────┤
│ 1. 解析 URL 参数 record_no                                   │
│ 2. 调用 fetchModelList(record_no)                            │
│    → GET /api/records/{record_no}/models                    │
│    → 返回：[{id:16, name:"scapula_left.stl"}, ...] (6个文件)│
│ 3. 等待 VtkRenderer 组件挂载完成                             │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ VtkRenderer.vue - onMounted()                               │
│ 时间：App.vue 渲染后约 50-100ms                              │
├─────────────────────────────────────────────────────────────┤
│ ① pipeline.ts :: createRenderPipeline()                     │
│    ├─ 创建 Renderer（渲染器）                                │
│    ├─ 设置背景色 #0f172a                                     │
│    ├─ 创建 RenderWindow（渲染窗口）                           │
│    ├─ 创建 OpenGLRenderWindow（WebGL 上下文）                │
│    ├─ 挂载到 DOM <div class="vtk-renderer">                  │
│    ├─ 创建 Interactor（交互器）                               │
│    └─ 绑定轨迹球相机控制                                      │
│                                                             │
│ ② lights.ts :: setupLights()                                │
│    ├─ createKeyLight()    → 主光源 (1, 1, 1)                 │
│    ├─ createFillLight()   → 补光 (-1, 0.5, 0)                │
│    └─ createBackLight()   → 背光 (0, -1, -1)                 │
│                                                             │
│ ③ loader.ts :: new STLLoader()                              │
│    └─ 创建加载器实例（暂时没有模型）                          │
│                                                             │
│ ④ window.addEventListener('resize')                         │
│    └─ 监听窗口大小变化                                        │
│                                                             │
│ ⑤ renderWindow.render()                                     │
│    └─ 初始渲染（显示空场景 + 背景色）                          │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ App.vue - loadAllModels()                                   │
│ 时间：VTK 初始化完成后，开始加载模型数据                      │
├─────────────────────────────────────────────────────────────┤
│ 并行执行 6 次（每个文件一次）：                                │
│                                                             │
│ 文件1: scapula_left.stl (442 KB)                             │
│   ↓                                                         │
│   fetchFileData(16)                                         │
│   → GET /api/files/16/data                                  │
│   → 返回 ArrayBuffer (453,184 字节)                          │
│   ↓                                                         │
│   vtkRendererRef.loadModel(arrayBuffer)                     │
│   ↓                                                         │
│   ┌───────────────────────────────────────────────┐         │
│   │ VtkRenderer.vue :: loadModel()                │         │
│   ├───────────────────────────────────────────────┤         │
│   │ loader.ts :: STLLoader.loadSTL()              │         │
│   │   ① vtkSTLReader.newInstance()                │         │
│   │      └─ 解析 STL 二进制数据                    │         │
│   │   ② vtkMapper.newInstance()                   │         │
│   │      └─ 连接 reader 输出                       │         │
│   │   ③ vtkActor.newInstance()                    │         │
│   │      └─ 连接 mapper                            │         │
│   │   ④ material.ts :: applyMaterial()            │         │
│   │      ├─ setColor(0.85, 0.79, 0.68) 骨骼米色    │         │
│   │      ├─ setAmbient(0.2)                       │         │
│   │      ├─ setDiffuse(0.8)                       │         │
│   │      ├─ setSpecular(0.3)                      │         │
│   │      └─ setSpecularPower(20)                  │         │
│   │   ⑤ renderer.addActor(actor)                  │         │
│   │      └─ 添加模型到场景                         │         │
│   │   ⑥ renderWindow.render()                     │         │
│   │      └─ 触发 WebGL 渲染                        │         │
│   └───────────────────────────────────────────────┘         │
│                                                             │
│ 文件2-6: 同样的流程并行执行...                                │
│                                                             │
│ ✓ 所有 6 个模型加载完成                                       │
│   ↓                                                         │
│   vtkRendererRef.resetCamera()                              │
│   ↓                                                         │
│   ┌───────────────────────────────────────────────┐         │
│   │ VtkRenderer.vue :: resetCamera()              │         │
│   ├───────────────────────────────────────────────┤         │
│   │ renderer.resetCamera()                        │         │
│   │   └─ 调整相机位置，使所有模型在视野内          │         │
│   │ renderWindow.render()                         │         │
│   │   └─ 最终渲染                                  │         │
│   └───────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
    ↓
用户看到完整的 3D 场景（6 个骨骼模型）
    ↓
┌─────────────────────────────────────────────────────────────┐
│ 用户交互阶段                                                  │
├─────────────────────────────────────────────────────────────┤
│ • 鼠标左键拖拽 → 旋转模型                                     │
│ • 鼠标滚轮      → 缩放                                        │
│ • 鼠标右键拖拽 → 平移                                         │
│                                                             │
│ 每次交互都会自动调用 renderWindow.render() 重新渲染           │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ 窗口大小调整（如果用户调整浏览器窗口）                         │
├─────────────────────────────────────────────────────────────┤
│ window 'resize' 事件触发                                     │
│   ↓                                                         │
│ pipeline.ts :: handleResize()                               │
│   ├─ 读取新的容器尺寸                                         │
│   ├─ openGLRenderWindow.setSize(width, height)              │
│   └─ renderWindow.render()                                  │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ 用户关闭页面或导航到其他页面                                   │
├─────────────────────────────────────────────────────────────┤
│ VtkRenderer.vue - onUnmounted()                             │
│   ↓                                                         │
│ ① 移除 resize 事件监听器                                      │
│ ② loader.ts :: STLLoader.cleanup()                          │
│    └─ 删除所有 6 个模型的 actor/mapper/reader                 │
│ ③ pipeline.cleanup()                                        │
│    ├─ interactor.unbindEvents()                             │
│    ├─ interactor.delete()                                   │
│    ├─ openGLRenderWindow.delete()                           │
│    ├─ renderWindow.delete()                                 │
│    └─ renderer.delete()                                     │
│                                                             │
│ ✓ 释放所有 GPU/内存资源                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 模块调用时序表

| 时间点 | 阶段 | 调用的模块 | 主要函数 | 目的 |
|-------|------|-----------|---------|------|
| **T0** | 页面加载 | - | index.html → main.ts → App.vue | 初始化 Vue 应用 |
| **T1** | App 挂载 | - | App.vue :: onMounted() | 解析 URL，获取文件列表 |
| **T2** | VTK 初始化 | **pipeline.ts** | createRenderPipeline() | 创建 WebGL 渲染环境 |
| **T3** | 设置光照 | **lights.ts** | setupLights() | 配置三点光源系统 |
| **T4** | 创建加载器 | **loader.ts** | new STLLoader() | 初始化模型加载器 |
| **T5** | 加载模型 | **loader.ts** | STLLoader.loadSTL() × 6 | 解析 STL 文件，创建 Actor |
| **T6** | 应用材质 | **material.ts** | applyMaterial() × 6 | 设置骨骼颜色和光照属性 |
| **T7** | 调整视角 | **pipeline.ts** | renderer.resetCamera() | 使所有模型在视野内 |
| **T8** | 用户交互 | **pipeline.ts** | interactor（轨迹球相机） | 旋转、缩放、平移 |
| **T9** | 窗口调整 | **pipeline.ts** | handleResize() | 响应窗口大小变化 |
| **T10** | 清理资源 | **pipeline.ts** + **loader.ts** | cleanup() | 释放 GPU 资源 |

---

## 各模块详细调用时机

### 1. pipeline.ts - 渲染管线

#### 🕐 何时调用？

**初始化：** VtkRenderer.vue 的 `onMounted()` 生命周期钩子
```typescript
// VtkRenderer.vue - 组件挂载时（页面加载后约 50-100ms）
onMounted(() => {
  pipeline = createRenderPipeline(containerRef.value);  // ← 这里调用
});
```

**窗口调整：** 用户调整浏览器窗口大小时
```typescript
// 监听 window resize 事件
window.addEventListener('resize', () => {
  handleResize(pipeline.openGLRenderWindow, containerRef.value);  // ← 这里调用
});
```

**清理：** 用户关闭页面或导航到其他页面时
```typescript
// VtkRenderer.vue - 组件卸载时
onUnmounted(() => {
  pipeline.cleanup();  // ← 这里调用
});
```

#### 📌 作用
- 创建 WebGL 渲染上下文
- 设置相机控制（轨迹球）
- 管理渲染循环

---

### 2. lights.ts - 三点光源

#### 🕐 何时调用？

**唯一调用时机：** VtkRenderer.vue 的 `onMounted()` 中，在创建管线后立即调用
```typescript
// VtkRenderer.vue - 组件挂载时
onMounted(() => {
  pipeline = createRenderPipeline(containerRef.value);
  setupLights(pipeline.renderer);  // ← 这里调用，仅一次
});
```

#### 📌 作用
- 配置专业级三点光源系统
- 让骨骼模型有良好的立体感和细节展示
- **只在初始化时设置一次，之后不再改变**

#### 💡 为什么只调用一次？
光源属于场景的全局配置，设置后会一直生效，不需要重复设置。

---

### 3. material.ts - 材质配置

#### 🕐 何时调用？

**每次加载模型时调用：** 在 `STLLoader.loadSTL()` 中为每个模型应用材质
```typescript
// loader.ts - STLLoader.loadSTL()
loadSTL(arrayBuffer: ArrayBuffer): void {
  const actor = vtkActor.newInstance();
  actor.setMapper(mapper);
  
  applyMaterial(actor.getProperty());  // ← 这里调用，每个模型一次
}
```

#### 📌 调用次数
- 本项目中：**6 次**（每个肩胛骨模型文件一次）
- 如果只有 1 个文件：**1 次**
- 如果有 10 个文件：**10 次**

#### 📌 作用
- 设置骨骼的颜色（米色）
- 配置光照反射属性（环境光、漫反射、镜面反射）
- 让模型看起来像真实的骨骼

---

### 4. loader.ts - 模型加载器

#### 🕐 何时调用？

**创建加载器实例：** VtkRenderer.vue 的 `onMounted()` 中
```typescript
// VtkRenderer.vue - 组件挂载时
onMounted(() => {
  stlLoader = new STLLoader(pipeline.renderer);  // ← 这里创建实例
});
```

**加载每个模型：** App.vue 中加载所有模型时
```typescript
// App.vue - loadAllModels()
const loadPromises = files.value.map(file => 
  fetchFileData(file.id).then(arrayBuffer => {
    vtkRendererRef.value?.loadModel(arrayBuffer);  // ← 触发加载
  })
);
```

**触发的内部调用链：**
```
VtkRenderer.loadModel(arrayBuffer)
  ↓
STLLoader.loadSTL(arrayBuffer)  // ← 每个模型调用一次
  ↓
applyMaterial()  // ← material.ts 在这里被调用
```

**清理：** 页面卸载时
```typescript
// VtkRenderer.vue - 组件卸载时
onUnmounted(() => {
  stlLoader.cleanup();  // ← 删除所有模型
});
```

#### 📌 作用
- 解析 STL 文件格式
- 为每个模型创建独立的渲染对象（Actor）
- 管理多个模型的显示

---

## 代码执行时间线

### 详细时间序列（以加载 6 个模型为例）

```
时间轴：0ms                500ms              1000ms             1500ms
        |                  |                  |                  |
        ↓                  ↓                  ↓                  ↓
        
0-50ms:   加载 HTML/JS/CSS
50-100ms: Vue 应用初始化
          App.vue onMounted()
          解析 URL → record_no = "MR-2026-000001"

100ms:    VtkRenderer.vue onMounted() 开始
          ┌─────────────────────────────────┐
          │ pipeline.ts :: createRenderPipeline() │
          │   - 创建 Renderer              │
          │   - 创建 RenderWindow          │
          │   - 创建 OpenGLRenderWindow    │
          │   - 初始化 Interactor          │
          │   - 绑定轨迹球相机             │
          │   耗时：约 20-30ms             │
          └─────────────────────────────────┘

130ms:    ┌─────────────────────────────────┐
          │ lights.ts :: setupLights()     │
          │   - createKeyLight()           │
          │   - createFillLight()          │
          │   - createBackLight()          │
          │   耗时：约 5-10ms              │
          └─────────────────────────────────┘

140ms:    ┌─────────────────────────────────┐
          │ loader.ts :: new STLLoader()   │
          │   耗时：< 1ms                  │
          └─────────────────────────────────┘

150ms:    初始渲染（空场景 + 背景色）
          用户看到深蓝色背景 #0f172a

200ms:    API 请求 /api/records/MR-2026-000001/models
          等待服务器响应...

250ms:    收到文件列表响应
          files = [
            {id: 16, name: "scapula_left.stl", size: 442KB},
            {id: 17, name: "scapula_right.stl", size: 206KB},
            ... // 共 6 个文件
          ]

300ms:    开始并行下载 6 个模型文件
          GET /api/files/16/data  ─┐
          GET /api/files/17/data   │
          GET /api/files/18/data   │ 并行执行
          GET /api/files/19/data   │
          GET /api/files/20/data   │
          GET /api/files/21/data  ─┘

700ms:    第一个文件下载完成（最小的 138KB）
          ┌─────────────────────────────────┐
          │ loader.ts :: loadSTL()         │
          │   - vtkSTLReader 解析 STL       │
          │   - vtkMapper 创建映射          │
          │   - vtkActor 创建演员           │
          │ material.ts :: applyMaterial() │
          │   - 设置骨骼颜色和材质          │
          │   - 添加到场景                  │
          │   耗时：约 50-100ms             │
          └─────────────────────────────────┘
          renderWindow.render() → 用户看到第一个模型！

800ms:    第二个文件加载完成 → 渲染
          用户看到 2 个模型

900ms:    第三个文件加载完成 → 渲染
          用户看到 3 个模型

1000ms:   第四个文件加载完成 → 渲染
1100ms:   第五个文件加载完成 → 渲染
1200ms:   第六个文件加载完成（最大的 493KB）→ 渲染

1300ms:   所有模型加载完成！
          ┌─────────────────────────────────┐
          │ VtkRenderer :: resetCamera()   │
          │   - 调整相机位置和角度          │
          │   - 使所有 6 个模型都在视野内   │
          │   耗时：< 10ms                 │
          └─────────────────────────────────┘

1350ms:   最终渲染完成
          ✓ 用户看到完整的 3D 场景
          ✓ 可以开始交互（旋转、缩放、平移）
```

---

## 用户操作触发流程

### 场景 1：用户旋转模型

```
用户按住鼠标左键拖拽
    ↓
浏览器触发 mousedown/mousemove 事件
    ↓
pipeline.ts 中的 Interactor 捕获事件
    ↓
TrackballCamera 样式处理交互
    ↓
更新相机的 position/focalPoint/viewUp
    ↓
自动调用 renderWindow.render()
    ↓
WebGL 重新渲染场景
    ↓
用户看到模型旋转（60fps 流畅动画）
```

**涉及模块：** `pipeline.ts` (Interactor + TrackballCamera)

---

### 场景 2：用户调整浏览器窗口大小

```
用户拖拽浏览器窗口边缘
    ↓
浏览器触发 window resize 事件
    ↓
VtkRenderer.vue 的 resize 监听器触发
    ↓
pipeline.ts :: handleResize()
    ├─ 读取新的容器尺寸 (width, height)
    ├─ openGLRenderWindow.setSize(width, height)
    └─ renderWindow.render()
    ↓
WebGL 画布调整大小并重新渲染
    ↓
用户看到场景适应新窗口大小
```

**涉及模块：** `pipeline.ts` (handleResize)

---

### 场景 3：用户刷新页面

```
用户按 F5 或点击刷新按钮
    ↓
浏览器触发页面卸载事件
    ↓
VtkRenderer.vue :: onUnmounted()
    ├─ loader.ts :: STLLoader.cleanup()
    │   └─ 删除 6 个模型的 actor/mapper/reader
    │
    ├─ pipeline.ts :: pipeline.cleanup()
    │   ├─ interactor.unbindEvents()
    │   ├─ interactor.delete()
    │   ├─ openGLRenderWindow.delete()
    │   ├─ renderWindow.delete()
    │   └─ renderer.delete()
    │
    └─ 移除 resize 事件监听器
    ↓
GPU 资源释放，内存回收
    ↓
页面重新加载，回到 T0 时刻
```

**涉及模块：** `loader.ts` (cleanup), `pipeline.ts` (cleanup)

---

## 生命周期总结

### 各模块的生命周期

```
pipeline.ts:
  ┌─── onMounted: createRenderPipeline()
  │    持续运行，处理交互和渲染
  │    响应 resize 事件
  └─── onUnmounted: cleanup()

lights.ts:
  ┌─── onMounted: setupLights()
  │    光源一直存在，无需更新
  └─── onUnmounted: 随 renderer 一起删除

material.ts:
  ├─── 加载模型1: applyMaterial()
  ├─── 加载模型2: applyMaterial()
  ├─── 加载模型3: applyMaterial()
  ├─── 加载模型4: applyMaterial()
  ├─── 加载模型5: applyMaterial()
  └─── 加载模型6: applyMaterial()
       材质属性存储在 actor 中
       onUnmounted: 随 actor 一起删除

loader.ts:
  ┌─── onMounted: new STLLoader()
  │    ├─── loadSTL() - 模型1
  │    ├─── loadSTL() - 模型2
  │    ├─── loadSTL() - 模型3
  │    ├─── loadSTL() - 模型4
  │    ├─── loadSTL() - 模型5
  │    └─── loadSTL() - 模型6
  └─── onUnmounted: cleanup()
```

---

## 关键时刻快照

### 时刻 A：页面刚加载（150ms）
- ✅ pipeline.ts 已执行：渲染环境就绪
- ✅ lights.ts 已执行：三点光源配置完成
- ✅ loader.ts 已执行：加载器创建完成
- ❌ material.ts 未执行：还没有模型
- **用户看到：** 深蓝色空场景

### 时刻 B：第一个模型加载（700ms）
- ✅ pipeline.ts：正在运行
- ✅ lights.ts：照亮场景
- ✅ loader.ts：loadSTL() 第 1 次调用
- ✅ material.ts：applyMaterial() 第 1 次调用
- **用户看到：** 1 个骨骼模型

### 时刻 C：所有模型加载完成（1300ms）
- ✅ pipeline.ts：正在运行
- ✅ lights.ts：照亮场景
- ✅ loader.ts：loadSTL() 已调用 6 次
- ✅ material.ts：applyMaterial() 已调用 6 次
- ✅ resetCamera() 已调用
- **用户看到：** 完整的 6 个骨骼模型

### 时刻 D：用户交互中（任意时刻）
- ✅ pipeline.ts：处理鼠标事件，更新相机
- ✅ lights.ts：持续照亮
- ✅ loader.ts：管理 6 个模型
- ✅ material.ts：材质持续有效
- **帧率：** 约 60fps

### 时刻 E：页面关闭
- ✅ pipeline.ts：cleanup() 执行
- ✅ lights.ts：随 renderer 删除
- ✅ loader.ts：cleanup() 执行，删除所有模型
- ✅ material.ts：随 actor 删除
- **GPU 内存：** 完全释放

---

## 总结

### 📊 调用频率统计

| 模块 | 函数 | 调用次数 | 调用时机 |
|-----|------|---------|---------|
| **pipeline.ts** | createRenderPipeline | 1 | 页面加载时 |
| **pipeline.ts** | handleResize | 0-N | 窗口调整时（可选） |
| **pipeline.ts** | cleanup | 1 | 页面关闭时 |
| **lights.ts** | setupLights | 1 | 初始化时 |
| **material.ts** | applyMaterial | 6 | 每个模型加载时 |
| **loader.ts** | new STLLoader | 1 | 初始化时 |
| **loader.ts** | loadSTL | 6 | 每个模型加载时 |
| **loader.ts** | cleanup | 1 | 页面关闭时 |

### 🎯 核心要点

1. **pipeline.ts** 是基础设施，最先初始化，最后清理
2. **lights.ts** 只在初始化时设置一次，之后一直有效
3. **material.ts** 是最频繁调用的模块（每个模型一次）
4. **loader.ts** 负责具体的模型加载，调用 material.ts

### 💡 记忆技巧

可以把这 4 个模块比作搭建舞台上演戏剧：

1. **pipeline.ts** = 搭建舞台（舞台、幕布、座椅）
2. **lights.ts** = 安装灯光（主光、补光、背光）
3. **loader.ts** = 导演（控制演员入场）
4. **material.ts** = 化妆师（给每个演员化妆）

演出顺序：
- 先搭好舞台 → 安装灯光 → 演员依次上场（每人都要化妆）→ 演出开始 → 演出结束拆台

就是这样！ 🎭
