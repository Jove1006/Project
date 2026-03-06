# style.css 全局样式文档

> 文件路径：`medical-web/src/style.css`  
> 作用：Vue 3 应用的全局样式表  
> 日期：2026-02-28

---

## 文件概述

这是医学数据管理系统前端应用的**全局 CSS 样式文件**，在 `main.ts` 中被引入，应用于整个 Vue 3 应用。该文件定义了基础的布局重置和字体配置。

---

## 代码详解

### 1. 全局重置样式（Universal Selector）

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
```

**作用：** CSS 重置，移除浏览器默认样式

**详细说明：**
- **选择器 `*`**：通配符选择器，匹配页面中的所有元素
- **`margin: 0`**：移除所有元素的外边距
  - 浏览器默认会给 `<h1>`, `<p>`, `<ul>` 等元素添加不同的外边距
  - 统一设为 0，确保布局从零开始，避免不同浏览器的差异
- **`padding: 0`**：移除所有元素的内边距
  - 同样移除浏览器默认的内边距，比如 `<ul>` 的左侧缩进
- **`box-sizing: border-box`**：改变盒模型计算方式
  - 默认值是 `content-box`：元素宽度 = 内容宽度
  - 设为 `border-box`：元素宽度 = 内容 + 内边距 + 边框
  - 好处：设置 `width: 100%` 时不会因为 padding/border 而溢出容器

**为什么需要重置？**
不同浏览器对 HTML 元素有不同的默认样式（User Agent Stylesheet），重置样式可以：
- 消除浏览器差异，确保跨浏览器一致性
- 提供干净的样式基础，便于后续开发
- 避免意外的样式继承问题

---

### 2. Body 基础样式

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

**作用：** 设置全局字体族和字体渲染优化

**详细说明：**

#### `font-family` 字体栈

这是一个**系统原生字体栈（System Font Stack）**，按优先级从左到右尝试：

| 字体名称 | 适用系统 | 说明 |
|---------|---------|------|
| **`-apple-system`** | macOS/iOS | 苹果系统字体（San Francisco），优先使用 |
| **`BlinkMacSystemFont`** | macOS | Chrome/Edge 在 macOS 上使用的系统字体别名 |
| **`'Segoe UI'`** | Windows | Windows 10/11 的默认 UI 字体，现代清晰 |
| **`Roboto`** | Android | Android 系统默认字体，Google 设计 |
| **`'Helvetica Neue'`** | macOS（旧版） | 早期 macOS 版本的默认字体 |
| **`Arial`** | 所有系统 | 经典无衬线字体，几乎所有系统都有 |
| **`sans-serif`** | 通用回退 | 通用无衬线字体族，确保总能显示 |

**优势：**
- ✅ **性能优化**：使用系统自带字体，无需下载字体文件，加载速度快
- ✅ **原生体验**：与操作系统 UI 保持一致，用户体验更自然
- ✅ **跨平台兼容**：覆盖 Windows、macOS、Linux、iOS、Android

#### `-webkit-font-smoothing: antialiased`

**作用：** 在 WebKit 浏览器（Safari、Chrome）上启用字体抗锯齿

**详细说明：**
- WebKit 浏览器默认使用 `subpixel-antialiased`（次像素平滑）
- 设为 `antialiased`（灰度平滑）可以让字体看起来更细更清晰
- 特别适用于细字重（light weight）的字体
- **缺点**：在某些情况下可能让文字看起来稍微虚一点

**可选值：**
- `none`：无抗锯齿
- `antialiased`：灰度抗锯齿（单色平滑）
- `subpixel-antialiased`：次像素抗锯齿（利用 RGB 次像素）

#### `-moz-osx-font-smoothing: grayscale`

**作用：** 在 Firefox 浏览器（macOS）上启用字体平滑

**详细说明：**
- 这是 Firefox 在 macOS 上的字体渲染属性
- `grayscale`：灰度抗锯齿，与 `-webkit-font-smoothing: antialiased` 效果类似
- 只在 macOS 的 Firefox 上生效
- 确保 Firefox 的字体渲染与 Chrome/Safari 保持一致

**可选值：**
- `auto`：浏览器默认行为
- `grayscale`：灰度平滑

---

### 3. App 根元素样式

```css
#app {
  width: 100%;
  height: 100vh;
}
```

**作用：** 设置 Vue 应用根容器的尺寸

**详细说明：**
- **`#app`**：ID 选择器，匹配 `<div id="app"></div>`
  - 这是 Vue 应用的挂载点，在 `index.html` 中定义
  - 在 `main.ts` 中通过 `app.mount('#app')` 挂载 Vue 应用
- **`width: 100%`**：宽度占满父元素（即 `<body>`）
  - 因为 `<body>` 默认宽度是视口宽度，所以 `#app` 也会占满整个屏幕宽度
- **`height: 100vh`**：高度为视口高度的 100%
  - `vh` = Viewport Height，1vh = 视口高度的 1%
  - `100vh` = 整个浏览器窗口的高度（不包括工具栏）
  - 这样设置可以让应用占满整个屏幕，无需滚动

**为什么不用 `height: 100%`？**
- `height: 100%` 依赖父元素的高度
- 如果 `<body>` 没有明确高度，`100%` 会失效
- `100vh` 是绝对单位，直接参照视口，更可靠

**应用场景：**
这种设置适合**全屏应用**（SPA），比如：
- 数据可视化面板
- 3D 模型查看器（本项目）
- 管理后台系统
- 设计工具

---

## 样式作用流程

```
用户打开浏览器
    ↓
加载 index.html
    ↓
执行 main.ts（引入 style.css）
    ↓
应用全局样式：
  1. 所有元素重置（*, margin/padding/box-sizing）
  2. body 设置字体（系统原生字体 + 抗锯齿）
  3. #app 占满视口（100% x 100vh）
    ↓
Vue 组件继承这些样式
    ↓
最终呈现：干净、现代、全屏的 UI
```

---

## 与其他文件的关系

### main.ts 中引入
```typescript
import './style.css'  // 全局样式
```

### App.vue 中继承
```vue
<template>
  <div id="app">  <!-- 应用 #app 样式 -->
    <!-- 内部所有元素继承 body 的字体设置 -->
  </div>
</template>
```

### 组件中的覆盖
各个组件可以通过 `<style scoped>` 覆盖全局样式：
```vue
<style scoped>
.my-component {
  /* 这里的样式只影响当前组件 */
  font-family: 'Custom Font', sans-serif;
}
</style>
```

---

## 最佳实践建议

### ✅ 当前文件做得好的地方

1. **简洁**：只包含全局必需的样式，不臃肿
2. **重置**：使用通配符重置，确保跨浏览器一致性
3. **性能**：使用系统字体，无需加载外部字体文件
4. **现代化**：使用 `100vh` 等现代 CSS 单位

### 🔧 可选的改进方向

如果未来需要扩展，可以考虑：

1. **字体大小基准**：
   ```css
   html {
     font-size: 16px; /* 设置基准字体大小 */
   }
   ```

2. **CSS 变量（CSS Custom Properties）**：
   ```css
   :root {
     --color-primary: #3b82f6;
     --color-text: #1f2937;
     --font-size-base: 14px;
   }
   ```

3. **暗色模式支持**：
   ```css
   @media (prefers-color-scheme: dark) {
     body {
       background-color: #1a1a1a;
       color: #e5e5e5;
     }
   }
   ```

4. **更完整的重置（normalize.css）**：
   - 当前使用简单的通配符重置
   - 可以考虑引入 [normalize.css](https://necolas.github.io/normalize.css/) 或 [CSS Reset](https://meyerweb.com/eric/tools/css/reset/)

---

## 技术术语解释

| 术语 | 英文全称 | 说明 |
|-----|---------|------|
| **CSS Reset** | CSS 重置 | 消除浏览器默认样式的技术 |
| **System Font Stack** | 系统字体栈 | 优先使用操作系统自带字体的字体列表 |
| **Antialiasing** | 抗锯齿 | 平滑字体边缘，消除锯齿状像素 |
| **Subpixel Rendering** | 次像素渲染 | 利用 RGB 子像素提高文字清晰度 |
| **Viewport Units** | 视口单位 | 相对于浏览器视口的 CSS 单位（vh、vw） |
| **Box Model** | 盒模型 | CSS 元素的布局模型（content + padding + border + margin） |
| **User Agent Stylesheet** | 用户代理样式表 | 浏览器内置的默认样式 |

---

## 总结

这个 `style.css` 文件虽然只有 **16 行代码**，但它为整个应用提供了：

1. **一致的起点**：通过 CSS Reset 消除浏览器差异
2. **优雅的字体**：使用系统原生字体栈 + 抗锯齿优化
3. **全屏布局**：让应用占满整个视口，适合 3D 模型查看器

它遵循了**现代 Web 开发的最佳实践**，是一个简洁、高效、实用的全局样式基础。

---

## 参考资料

- [CSS Box Model](https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_Box_Model)
- [System Font Stack](https://systemfontstack.com/)
- [CSS Viewport Units](https://developer.mozilla.org/zh-CN/docs/Web/CSS/length#viewport-percentage_lengths)
- [Font Smoothing](https://developer.mozilla.org/en-US/docs/Web/CSS/font-smooth)
