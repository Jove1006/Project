/** 模型卡片展示信息 */
export interface ModelCardInfo {
  /** 模型索引 */
  index: number;
  /** 模型名称 */
  name: string;
  /** 模型体积 (mm³) */
  volume: number;
  /** 当前颜色 HEX */
  colorHex: string;
  /** 当前透明度 0-1 (1=完全不透明) */
  opacity: number;
}

/** loadSTL 返回的模型信息 */
export interface LoadedModelInfo {
  /** 模型体积 (mm³)，封闭网格为正值，非封闭时可能不准确 */
  volume: number;
  /** 此模型在 actors 数组中的索引 */
  index: number;
}
