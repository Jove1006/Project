# Draco 对比方案计划（仅文档，不实施）

更新时间：2026-02-28

## 目标
- 保留现有 vtk.js STL 渲染流程不变
- 新增 three.js + Draco 渲染路径用于对比效果与性能
- 输出对比结论：视觉效果、加载速度、交互流畅度、工程复杂度

## 现状简述
- 前端 medical-web 使用 vtk.js，当前仅支持 STL（vtkSTLReader）
- three.js 相关 Draco 代码存在于 3D platform 目录（非 medical-web）

## 方案范围
- 新增一条 three.js 渲染链路，独立于现有 vtk.js
- 数据仍从后端取 ArrayBuffer（或直接静态资源）
- 先支持 Draco 解码 + 网格展示，不做体渲染
- 由于只有 STL，需要在后端在线转换为 DRC

## 技术方案（对比）
### A. 现有 vtk.js（保留）
- STL -> vtkSTLReader -> mapper/actor -> renderer
- 主要用于稳定、可控的医学网格展示

### B. three.js + Draco（新增）
- STL -> (PLY/OBJ) -> DRC -> DRACOLoader -> BufferGeometry -> Mesh
- 需要 draco decoder (js/wasm) 资源托管
- 可选：支持 glTF + Draco 压缩

## 在线转换流程（后端）
1. 上传 STL（现有上传流程不改或新增专用接口）
2. 后端保存原始 STL 到 MinIO
3. 后端调用 draco_encoder 将 STL 转为 DRC
4. 生成的 DRC 保存到 MinIO（现有 bucket 下的 drc/ 子目录）
5. 记录元信息：format、source_id、size、created_at
6. 前端按 format 选择渲染引擎（STL 走 vtk.js，DRC 走 three.js）

## 实施步骤（仅规划）
1. STL 到 DRC 转换准备
2. three.js 渲染模块骨架
3. Draco 解码器接入
4. DRC 模型加载与显示
5. 渲染引擎切换入口
6. 性能与效果对比记录

## 小任务拆分
### 1. 在线 STL 到 DRC 转换准备
- 1.1 选定 STL 样例（大小、面数、部位明确）
- 1.2 明确后端转换链路（STL -> PLY/OBJ -> DRC）
- 1.3 约定 DRC 命名与存储路径
- 1.4 记录模型元信息（STL/DRC 大小、面数、来源）
- 产出：在线转换流程说明 + 参数记录

### 2. three.js 渲染模块骨架
- 2.1 在 medical-web 新增 three 渲染容器与初始化管线
- 2.2 独立渲染生命周期（初始化/销毁）
- 产出：three 渲染骨架代码（不影响 vtk.js）

### 3. Draco 解码器接入
- 3.1 选择解码器资源来源（本地静态资源或 CDN）
- 3.2 配置 DRACOLoader 路径与 wasm 加载
- 产出：可成功初始化的 DRACOLoader

### 4. DRC 模型加载与显示
- 4.1 读取 DRC ArrayBuffer
- 4.2 解码为 BufferGeometry 并生成 Mesh
- 4.3 添加基础光照与材质
- 产出：可渲染的 DRC 模型画面

### 5. 渲染引擎切换入口
- 5.1 增加 URL 参数或 UI 开关
- 5.2 切换时确保旧渲染器释放
- 产出：可切换 vtk.js / three.js 的入口

### 6. 性能与效果对比记录
- 6.1 指标定义：首帧时间、帧率、内存、包体
- 6.2 记录截图/录屏与数据
- 产出：对比结论表 + 备注

## 关键问题与验证点
- Draco 解码是否可在目标浏览器稳定运行
- 模型法线与材质效果是否满足骨骼展示要求
- 性能：首帧时间、帧率、内存占用
- 资源体积：DRC 与 STL 对比

## 依赖与资源
- three.js + DRACOLoader
- draco_decoder.js / draco_decoder.wasm
- draco_encoder（离线转换）
- 若干 STL 样例模型

## 交付物
- 仅输出对比报告（效果截图/视频 + 指标）
- 不替换现有 vtk.js 主路径

## 不在本阶段做的事情
- 不做大范围接口重构
- 不做模型格式转换服务
- 不做 UI 细节打磨
