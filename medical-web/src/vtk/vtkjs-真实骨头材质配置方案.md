# vtk.js 真实骨头材质配置方案（可直接落地）

更新时间：2026-02-28  
适用场景：医学可视化（骨组织）

---

## 1. 结论先行（推荐基线）

真实骨头在 vtk.js 里通常分两类：

- **A. 表面网格渲染**（STL/OBJ/PolyData）
- **B. CT 体渲染**（最接近“真实骨头”）

如果目标是“尽量像真实骨头”，优先使用 **B（CT 体渲染）**，并使用 HU 分段传输函数 + 光照参数微调。

---

## 2. 方案 A：表面网格骨头（快速稳定）

> 用于：你只有骨头网格模型，没有原始 CT 体数据。

### 2.1 推荐参数（Phong）

```js
const p = actor.getProperty();

// 颜色：偏暖骨白（避免纯白塑料感）
p.setColor(0.93, 0.89, 0.82);

// 光照：骨头应“有漫反射、轻微高光”
p.setAmbient(0.12);
p.setDiffuse(0.78);
p.setSpecular(0.18);
p.setSpecularPower(20);

p.setInterpolationToPhong();
```

### 2.2 若版本支持 PBR（可选）

```js
const p = actor.getProperty();
p.setInterpolationToPBR();
p.setColor(0.93, 0.89, 0.82);

// 非金属骨组织：metallic 设 0
p.setMetallic(0.0);

// 粗糙度中高，防止“抛光塑料”
p.setRoughness(0.45); // 可在 0.35~0.60 间调
```

### 2.3 视觉微调建议

- 高光太假：`specular` 降到 0.10~0.16，或 `roughness` 提高。
- 发灰不通透：适当提高 `diffuse`，并检查灯光方向。
- 太“白板”：颜色改为暖白（R/G/B 略偏黄）。

---

## 3. 方案 B：CT 体渲染骨头（真实感最佳，推荐）

> 用于：你有 CT 数据（HU 标度）。

### 3.1 推荐参数（VolumeProperty）

```js
const vp = volume.getProperty();

vp.setShade(true);
vp.setAmbient(0.10);
vp.setDiffuse(0.90);
vp.setSpecular(0.20);
vp.setSpecularPower(12);
```

### 3.2 推荐透明度传输函数（骨组织强化）

```js
const ofun = vtkPiecewiseFunction.newInstance();

// 空气到软组织：几乎透明
ofun.addPoint(-1000, 0.00);
ofun.addPoint(   80, 0.00);
ofun.addPoint(  150, 0.02);

// 松质骨过渡
ofun.addPoint(  300, 0.12);
ofun.addPoint(  500, 0.30);

// 皮质骨强化
ofun.addPoint(  700, 0.55);
ofun.addPoint( 1000, 0.78);
ofun.addPoint( 1200, 0.92);
```

### 3.3 推荐颜色传输函数（骨白层次）

```js
const cfun = vtkColorTransferFunction.newInstance();

cfun.addRGBPoint( 150, 0.78, 0.72, 0.66); // 低密度骨/软组织过渡
cfun.addRGBPoint( 300, 0.86, 0.80, 0.74); // 松质骨
cfun.addRGBPoint( 700, 0.93, 0.88, 0.82); // 骨主体
cfun.addRGBPoint(1200, 0.98, 0.95, 0.90); // 高密度皮质骨
```

### 3.4 真实感提升要点

- **关键不在“一个固定阈值”**，而在你的数据 HU 分布（不同设备/重建核会偏移）。
- 先看直方图，再微调 300/500/700/1000 这几个关键点。
- 增加一点阴影/环境光变化，真实感会明显上升。

---

## 4. 动态更新“真实骨头”时的正确刷新链路

无论网格还是体渲染，更新后都按以下顺序：

```js
// 1) 更新底层数据（points/scalars/volume array 等）

// 2) 标记修改
sourceData.modified();
mapper.modified();
actorOrVolume.modified();

// 3) 触发重绘
renderWindow.render();
```

如果“改了数据画面没变”，优先排查：
1. 有没有 `modified()`
2. 有没有最终 `renderWindow.render()`
3. 传输函数是否仍落在旧范围（尤其 CT window/level 或 HU 范围）

---

## 5. 一套可复用的“最像真实骨头”默认模板

### 5.1 表面骨模型（默认）
- `Color = (0.93, 0.89, 0.82)`
- `Ambient = 0.12`
- `Diffuse = 0.78`
- `Specular = 0.18`
- `SpecularPower = 20`
- Interpolation: Phong（或 PBR + metallic=0 + roughness=0.45）

### 5.2 CT 体渲染骨头（默认）
- `Shade = true`
- `Ambient = 0.10`
- `Diffuse = 0.90`
- `Specular = 0.20`
- `SpecularPower = 12`
- Opacity/Color transfer function 使用第 3 节模板，并按数据做小范围校准

---

## 6. 参考资料（官方优先）

- vtk.js VolumeMapper API  
  https://kitware.github.io/vtk-js/api/Rendering_Core_VolumeMapper.html
- vtk.js VolumeProperty API  
  https://kitware.github.io/vtk-js/api/Rendering_Core_VolumeProperty.html
- vtk.js Property API（表面材质/PBR）  
  https://kitware.github.io/vtk-js/api/Rendering_Core_Property.html
- vtk.js VolumeViewer 示例  
  https://kitware.github.io/vtk-js/examples/VolumeViewer.html
- Kitware: VTK.js WebGPU PBR  
  https://www.kitware.com/introducing-physically-based-rendering-to-vtk-js-webgpu/

---

如果你愿意，我可以下一步按你的数据类型（STL/OBJ 或 DICOM/NIfTI）给你产出一份“项目可直接粘贴”的初始化代码（含 renderer、light、camera、transfer function、交互参数）。
