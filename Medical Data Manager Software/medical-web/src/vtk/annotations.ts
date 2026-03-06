/**
 * 3D 标注系统：距离测量、角度测量、文字标签
 *
 * 原理：
 * 1. 用 vtkCellPicker 在模型表面拾取 3D 点
 * 2. 将 3D 世界坐标投影到 2D 屏幕坐标
 * 3. 用 HTML/CSS overlay 渲染标注（线、文字、角度弧线）
 * 4. 每帧（相机变化时）重新投影，保持标注跟随视角
 */
import vtkCellPicker from '@kitware/vtk.js/Rendering/Core/CellPicker';
import vtkCoordinate from '@kitware/vtk.js/Rendering/Core/Coordinate';

/* ── 类型定义 ── */

export type AnnotationType = 'distance' | 'angle' | 'label';

/** 标注颜色调色板，每条测量线自动循环分配不同颜色 */
const ANN_COLORS = [
  '#ffcc00', // 黄
  '#00ccff', // 青
  '#ff6699', // 粉
  '#66ff66', // 绿
  '#ff9933', // 橙
  '#cc99ff', // 紫
  '#00ffcc', // 藄绿
  '#ff5555', // 红
];

export interface AnnotationPoint {
  world: [number, number, number]; // 世界坐标
  normal: [number, number, number]; // 拾取点表面法线（用于背面剔除）
}

export interface DistanceAnnotation {
  type: 'distance';
  id: number;
  color: string;
  points: [AnnotationPoint, AnnotationPoint];
  distance: number; // mm
}

export interface AngleAnnotation {
  type: 'angle';
  id: number;
  color: string;
  points: [AnnotationPoint, AnnotationPoint, AnnotationPoint];
  angle: number; // 度
}

export interface LabelAnnotation {
  type: 'label';
  id: number;
  color: string;
  point: AnnotationPoint;
  text: string;
}

export type Annotation = DistanceAnnotation | AngleAnnotation | LabelAnnotation;

export type AnnotationMode = 'distance' | 'angle' | 'label' | null;

/* ── 辅助计算 ── */

function vecSub(a: number[], b: number[]): [number, number, number] {
  return [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
}

function vecLen(v: number[]): number {
  return Math.sqrt(v[0]! ** 2 + v[1]! ** 2 + v[2]! ** 2);
}

function vecDot(a: number[], b: number[]): number {
  return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
}

function vecCross(a: number[], b: number[]): [number, number, number] {
  return [
    a[1]! * b[2]! - a[2]! * b[1]!,
    a[2]! * b[0]! - a[0]! * b[2]!,
    a[0]! * b[1]! - a[1]! * b[0]!,
  ];
}

function vecNormalize(v: [number, number, number]): [number, number, number] {
  const len = vecLen(v);
  if (len === 0) return [0, 0, 1];
  return [v[0] / len, v[1] / len, v[2] / len];
}

function calcDistance(a: number[], b: number[]): number {
  return vecLen(vecSub(a, b));
}

function calcAngle(p1: number[], vertex: number[], p3: number[]): number {
  const v1 = vecSub(p1, vertex);
  const v2 = vecSub(p3, vertex);
  const len1 = vecLen(v1);
  const len2 = vecLen(v2);
  if (len1 === 0 || len2 === 0) return 0;
  const cosA = Math.max(-1, Math.min(1, vecDot(v1, v2) / (len1 * len2)));
  return (Math.acos(cosA) * 180) / Math.PI;
}

/**
 * 从 picker 拾取结果中计算三角面法线。
 * 优先从三角形顶点计算（最可靠），回退到 getPickNormal。
 */
function computePickNormal(picker: any): [number, number, number] {
  try {
    const ds = picker.getDataSet?.();
    const cellId = picker.getCellId?.();
    if (ds && cellId != null && cellId >= 0) {
      const points = ds.getPoints?.();
      const polys = ds.getPolys?.();
      if (points && polys) {
        const cellData = polys.getData();
        // 遍历 cell 找到对应 cellId 的三角形
        let offset = 0;
        let curCell = 0;
        while (offset < cellData.length && curCell < cellId) {
          const nPts = cellData[offset];
          offset += nPts + 1;
          curCell++;
        }
        if (offset < cellData.length) {
          const nPts = cellData[offset];
          if (nPts >= 3) {
            const pData = points.getData();
            const i0 = cellData[offset + 1] * 3;
            const i1 = cellData[offset + 2] * 3;
            const i2 = cellData[offset + 3] * 3;
            const p0 = [pData[i0], pData[i0 + 1], pData[i0 + 2]];
            const p1 = [pData[i1], pData[i1 + 1], pData[i1 + 2]];
            const p2 = [pData[i2], pData[i2 + 1], pData[i2 + 2]];
            const e1 = vecSub(p1, p0);
            const e2 = vecSub(p2, p0);
            const n = vecCross(e1, e2);
            const len = vecLen(n);
            if (len > 0) return vecNormalize(n);
          }
        }
      }
    }
  } catch (_) { /* 回退 */ }

  // 回退：尝试 getPickNormal
  try {
    const pn = picker.getPickNormal?.();
    if (pn && (pn[0] !== 0 || pn[1] !== 0 || pn[2] !== 0)) {
      return [pn[0], pn[1], pn[2]];
    }
  } catch (_) { /* 忽略 */ }

  return [0, 0, 1]; // 最后回退：默认朝前
}

/* ── 世界坐标 → 屏幕坐标投影（使用 vtkCoordinate，最可靠） ── */

// 复用同一个 vtkCoordinate 实例，避免每帧大量创建/销毁
let _coord: any = null;
function getCoord() {
  if (!_coord) {
    _coord = vtkCoordinate.newInstance();
    _coord.setCoordinateSystemToWorld();
  }
  return _coord;
}

export function worldToScreen(
  worldPos: [number, number, number],
  renderer: any,
  container: HTMLElement,
): [number, number] | null {
  const coord = getCoord();
  coord.setValue(worldPos[0], worldPos[1], worldPos[2]);

  // getComputedDoubleDisplayValue 返回 [displayX, displayY]
  // 坐标系：左下角原点，单位与 openGLRenderWindow.getSize() 一致
  const display = coord.getComputedDoubleDisplayValue(renderer);
  if (!display || display.length < 2) return null;

  // overlay 的 CSS 尺寸（左上角原点）
  const { height } = container.getBoundingClientRect();

  return [display[0], height - display[1]];
}

/* ── 标注管理器 ── */

export interface AnnotationManagerOptions {
  renderer: any;
  interactor: any;
  openGLRenderWindow?: any; // 保留兼容，已不使用
  overlay: HTMLElement;   // overlay DOM 容器
  onModeEnd?: () => void; // 模式结束时回调
  onLabelInput?: (resolve: (text: string | null) => void) => void; // 请求输入标签文字
}

export class AnnotationManager {
  private renderer: any;
  private interactor: any;
  private overlay: HTMLElement;
  private picker: any;

  private annotations: Annotation[] = [];
  private nextId = 1;
  private colorIndex = 0;
  private mode: AnnotationMode = null;
  private pendingPoints: AnnotationPoint[] = [];
  private selectedId: number | null = null;

  private clickSub: { unsubscribe: () => void } | null = null;
  private moveSub: { unsubscribe: () => void } | null = null;
  private cameraSub: { unsubscribe: () => void } | null = null;
  private onModeEnd: (() => void) | null;
  private onLabelInput: ((resolve: (text: string | null) => void) => void) | null;
  private disposed = false;

  constructor(opts: AnnotationManagerOptions) {
    this.renderer = opts.renderer;
    this.interactor = opts.interactor;
    this.overlay = opts.overlay;
    this.onModeEnd = opts.onModeEnd ?? null;
    this.onLabelInput = opts.onLabelInput ?? null;

    this.picker = vtkCellPicker.newInstance();
    this.picker.setPickFromList(false);
    this.picker.setTolerance(0.005);

    // 监听相机变化，重绘标注（仅做廖价的 2D 投影 + 点积，零开销）
    this.cameraSub = this.interactor.onAnimation?.(() => this.render());
    // onEndAnimation 也同步
    const endSub = this.interactor.onEndAnimation?.(() => this.render());
    if (endSub) {
      const origUnsub = this.cameraSub?.unsubscribe;
      this.cameraSub = {
        unsubscribe: () => {
          origUnsub?.();
          endSub.unsubscribe();
        },
      };
    }
  }

  /* ── 进入测量模式 ── */

  enterDistanceMode(): void {
    this.exitMode();
    this.mode = 'distance';
    this.pendingPoints = [];
    this.bindPicking();
  }

  enterAngleMode(): void {
    this.exitMode();
    this.mode = 'angle';
    this.pendingPoints = [];
    this.bindPicking();
  }

  enterLabelMode(): void {
    this.exitMode();
    this.mode = 'label';
    this.pendingPoints = [];
    this.bindPicking();
  }

  exitMode(): void {
    this.unbindPicking();
    this.mode = null;
    this.pendingPoints = [];
    this.render();
  }

  getMode(): AnnotationMode {
    return this.mode;
  }

  /* ── 删除 ── */

  deleteSelected(): void {
    if (this.selectedId !== null) {
      this.annotations = this.annotations.filter(a => a.id !== this.selectedId);
      this.selectedId = null;
      this.render();
    }
  }

  clearAll(): void {
    this.annotations = [];
    this.selectedId = null;
    this.pendingPoints = [];
    this.render();
  }

  /** 获取下一个标注颜色（循环） */
  private nextColor(): string {
    const c = ANN_COLORS[this.colorIndex % ANN_COLORS.length]!;
    this.colorIndex++;
    return c;
  }

  /* ── 拾取 & 创建标注 ── */

  private bindPicking(): void {
    this.unbindPicking();
    let downX = 0, downY = 0;

    this.clickSub = this.interactor.onLeftButtonPress((callData: any) => {
      downX = callData.position.x;
      downY = callData.position.y;
    });

    this.moveSub = this.interactor.onLeftButtonRelease((callData: any) => {
      const { x, y } = callData.position;
      // 区分拖拽 — 只有接近点击才视为拾取
      if (Math.sqrt((x - downX) ** 2 + (y - downY) ** 2) > 5) return;

      this.picker.pick([x, y, 0], this.renderer);
      const pos = this.picker.getPickPosition?.() as [number, number, number] | null;
      const actors = this.picker.getActors?.() ?? [];
      if (!pos || actors.length === 0) return;

      // 从拾取的三角面计算法线，渲染时用于廖价背面剔除
      const normal = computePickNormal(this.picker);

      this.addPendingPoint({ world: [...pos] as [number, number, number], normal });
    });
  }

  private unbindPicking(): void {
    this.clickSub?.unsubscribe();
    this.moveSub?.unsubscribe();
    this.clickSub = null;
    this.moveSub = null;
  }

  private addPendingPoint(pt: AnnotationPoint): void {
    this.pendingPoints.push(pt);

    if (this.mode === 'distance' && this.pendingPoints.length === 2) {
      const [p1, p2] = this.pendingPoints;
      const dist = calcDistance(p1!.world, p2!.world);
      this.annotations.push({
        type: 'distance',
        id: this.nextId++,
        color: this.nextColor(),
        points: [p1!, p2!],
        distance: dist,
      });
      // 保持模式，清空临时点即可继续下一条测量
      this.pendingPoints = [];
    } else if (this.mode === 'angle' && this.pendingPoints.length === 3) {
      const [p1, p2, p3] = this.pendingPoints;
      const angle = calcAngle(p1!.world, p2!.world, p3!.world);
      this.annotations.push({
        type: 'angle',
        id: this.nextId++,
        color: this.nextColor(),
        points: [p1!, p2!, p3!],
        angle,
      });
      // 保持模式，清空临时点即可继续下一条测量
      this.pendingPoints = [];
    } else if (this.mode === 'label' && this.pendingPoints.length === 1) {
      const pt0 = this.pendingPoints[0]!;
      // 请求文字输入
      if (this.onLabelInput) {
        this.onLabelInput((text) => {
          if (text && text.trim()) {
            this.annotations.push({
              type: 'label',
              id: this.nextId++,
              color: this.nextColor(),
              point: pt0,
              text: text.trim(),
            });
          }
          this.pendingPoints = [];
          this.exitMode();
          this.onModeEnd?.();
          this.render();
        });
      } else {
        const text = prompt('输入标签文字：');
        if (text && text.trim()) {
          this.annotations.push({
            type: 'label',
            id: this.nextId++,
            color: this.nextColor(),
            point: pt0,
            text: text.trim(),
          });
        }
        this.pendingPoints = [];
        this.exitMode();
        this.onModeEnd?.();
      }
    }

    this.render();
  }

  /* ── 渲染标注到 HTML overlay ── */

  render(): void {
    if (this.disposed) return;
    const html: string[] = [];

    // 渲染已确认的标注（每帧廖价点积背面剔除）
    for (const ann of this.annotations) {
      if (!this.isAnnotationFacing(ann)) continue;

      const isSelected = ann.id === this.selectedId;
      const selClass = isSelected ? ' ann-selected' : '';
      const color = ann.color;

      if (ann.type === 'distance') {
        const s1 = this.project(ann.points[0].world);
        const s2 = this.project(ann.points[1].world);
        if (s1 && s2) {
          html.push(this.renderLine(s1, s2, selClass, color));
          html.push(this.renderDot(s1, ann.id, selClass, color));
          html.push(this.renderDot(s2, ann.id, selClass, color));
          const mx = (s1[0] + s2[0]) / 2;
          const my = (s1[1] + s2[1]) / 2;
          html.push(this.renderLabel(mx, my, `${ann.distance.toFixed(2)} mm`, ann.id, selClass, 'ann-distance', color));
        }
      } else if (ann.type === 'angle') {
        const s1 = this.project(ann.points[0].world);
        const s2 = this.project(ann.points[1].world); // vertex
        const s3 = this.project(ann.points[2].world);
        if (s1 && s2 && s3) {
          html.push(this.renderLine(s1, s2, selClass, color));
          html.push(this.renderLine(s2, s3, selClass, color));
          html.push(this.renderDot(s1, ann.id, selClass, color));
          html.push(this.renderDot(s2, ann.id, selClass, color));
          html.push(this.renderDot(s3, ann.id, selClass, color));
          html.push(this.renderAngleArc(s1, s2, s3, ann.angle, ann.id, selClass, color));
        }
      } else if (ann.type === 'label') {
        const s = this.project(ann.point.world);
        if (s) {
          html.push(this.renderDot(s, ann.id, selClass, color));
          html.push(this.renderLabel(s[0] + 12, s[1] - 12, ann.text, ann.id, selClass, 'ann-label', color));
        }
      }
    }

    // 渲染正在收集的临时点
    for (let i = 0; i < this.pendingPoints.length; i++) {
      const pt = this.pendingPoints[i]!;
      if (!this.isPointFacing(pt)) continue;
      const s = this.project(pt.world);
      if (s) {
        html.push(this.renderDot(s, -1, ' ann-pending'));
      }
    }
    // 临时点之间连线
    if (this.pendingPoints.length >= 2) {
      for (let i = 0; i < this.pendingPoints.length - 1; i++) {
        const sa = this.project(this.pendingPoints[i]!.world);
        const sb = this.project(this.pendingPoints[i + 1]!.world);
        if (sa && sb) html.push(this.renderLine(sa, sb, ' ann-pending'));
      }
    }

    this.overlay.innerHTML = html.join('');

    // 绑定点击选择
    this.overlay.querySelectorAll('[data-ann-id]').forEach(el => {
      (el as HTMLElement).addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt((el as HTMLElement).dataset.annId!, 10);
        if (!isNaN(id) && id > 0) {
          this.selectedId = this.selectedId === id ? null : id;
          this.render();
        }
      });
    });
  }

  private project(world: [number, number, number]): [number, number] | null {
    return worldToScreen(world, this.renderer, this.overlay);
  }

  /**
   * 廖价背面剔除：法线·(点→相机) 的点积 > 0 表示面向相机。
   * 仅用乘法，每帧每点开销约 10 次乘法，完全不卡。
   */
  private isPointFacing(pt: AnnotationPoint): boolean {
    const cam = this.renderer.getActiveCamera().getPosition();
    const toCamera = [
      cam[0] - pt.world[0],
      cam[1] - pt.world[1],
      cam[2] - pt.world[2],
    ];
    return vecDot(toCamera, pt.normal) > 0;
  }

  /** 标注可见：至少有一个点朝向相机即显示（避免测量线在棱线边缘时完全消失） */
  private isAnnotationFacing(ann: Annotation): boolean {
    if (ann.type === 'distance') {
      return this.isPointFacing(ann.points[0]) || this.isPointFacing(ann.points[1]);
    } else if (ann.type === 'angle') {
      return this.isPointFacing(ann.points[0]) || this.isPointFacing(ann.points[1]) || this.isPointFacing(ann.points[2]);
    } else if (ann.type === 'label') {
      return this.isPointFacing(ann.point);
    }
    return true;
  }

  /* ── HTML 片段生成 ── */

  private renderDot(pos: [number, number], annId: number, extraClass: string, color?: string): string {
    const style = color
      ? `left:${pos[0]}px;top:${pos[1]}px;background:${color};border-color:#fff`
      : `left:${pos[0]}px;top:${pos[1]}px`;
    return `<div class="ann-dot${extraClass}" data-ann-id="${annId}" style="${style}"></div>`;
  }

  private renderLine(a: [number, number], b: [number, number], extraClass: string, color?: string): string {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const bg = color ? `background:${color};` : '';
    return `<div class="ann-line${extraClass}" style="left:${a[0]}px;top:${a[1]}px;width:${len}px;transform:rotate(${angle}deg);${bg}"></div>`;
  }

  private renderLabel(x: number, y: number, text: string, annId: number, extraClass: string, typeClass: string, color?: string): string {
    const colorStyle = color ? `color:${color};border-color:${color}60;` : '';
    return `<div class="ann-text ${typeClass}${extraClass}" data-ann-id="${annId}" style="left:${x}px;top:${y}px;${colorStyle}">${text}</div>`;
  }

  private renderAngleArc(
    s1: [number, number], vertex: [number, number], s3: [number, number],
    angleDeg: number, annId: number, extraClass: string, color?: string,
  ): string {
    // 在顶点画弧线 + 角度标注
    const r = 30;
    const a1 = Math.atan2(s1[1] - vertex[1], s1[0] - vertex[0]);
    const a2 = Math.atan2(s3[1] - vertex[1], s3[0] - vertex[0]);

    // SVG arc
    const startX = vertex[0] + r * Math.cos(a1);
    const startY = vertex[1] + r * Math.sin(a1);
    const endX = vertex[0] + r * Math.cos(a2);
    const endY = vertex[1] + r * Math.sin(a2);

    const largeArc = angleDeg > 180 ? 1 : 0;
    // 判断弧线方向
    const cross = (s1[0] - vertex[0]) * (s3[1] - vertex[1]) - (s1[1] - vertex[1]) * (s3[0] - vertex[0]);
    const sweep = cross > 0 ? 1 : 0;

    const midAngle = (a1 + a2) / 2;
    // 如果需要修正中间角度方向
    const labelR = r + 16;
    const lx = vertex[0] + labelR * Math.cos(midAngle);
    const ly = vertex[1] + labelR * Math.sin(midAngle);

    const strokeColor = color || '#ffcc00';
    const colorStyle = color ? `color:${color};border-color:${color}60;` : '';

    return `<svg class="ann-arc-svg${extraClass}" style="position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible">
      <path d="M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} ${sweep} ${endX} ${endY}" fill="none" stroke="${strokeColor}" stroke-width="2"/>
    </svg>
    <div class="ann-text ann-angle${extraClass}" data-ann-id="${annId}" style="left:${lx}px;top:${ly}px;${colorStyle}">${angleDeg.toFixed(1)}°</div>`;
  }

  /* ── 清理 ── */

  dispose(): void {
    this.disposed = true;
    this.exitMode();
    this.cameraSub?.unsubscribe();
    this.cameraSub = null;
    this.picker?.delete();
    this.picker = null;
    this.overlay.innerHTML = '';
  }
}
