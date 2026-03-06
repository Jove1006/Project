// API 响应类型定义
export interface ModelFile {
  id: number;
  original_name: string;
  file_size: number;
  file_size_str: string;
  color_hex: string | null;
}

export interface ModelListResponse {
  record_no: string;
  files: ModelFile[];
}

/**
 * 获取指定病历的模型文件列表
 * @param recordNo 病历编号，如 "MR-2026-000001"
 * @returns 模型文件列表
 */
export async function fetchModelList(recordNo: string): Promise<ModelListResponse> {
  const response = await fetch(`/api/records/${recordNo}/models`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch model list: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * 获取文件的二进制数据
 * @param fileId 文件 ID
 * @returns 文件的 ArrayBuffer 数据
 */
export async function fetchFileData(fileId: number): Promise<ArrayBuffer> {
  const response = await fetch(`/api/files/${fileId}/data`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch file data: ${response.statusText}`);
  }
  
  return response.arrayBuffer();
}

/** bundle 中每个文件的元数据 */
export interface BundleFileItem {
  id: number;
  original_name: string;
  file_size: number;
  color_hex: string | null;
  offset: number;
  length: number;
}

/** 解析后的 bundle 结果 */
export interface BundleResult {
  file: BundleFileItem;
  buffer: ArrayBuffer;
}

/**
 * 批量获取指定病历的所有模型文件（单次请求）
 * 响应格式: [4B JSON长度][JSON manifest][file1 data][file2 data]...
 */
export async function fetchModelBundle(recordNo: string): Promise<BundleResult[]> {
  const response = await fetch(`/api/records/${recordNo}/models/bundle`);
  if (!response.ok) {
    throw new Error(`Failed to fetch model bundle: ${response.statusText}`);
  }

  const buf = await response.arrayBuffer();
  const view = new DataView(buf);

  // 读取 JSON manifest 长度（little-endian u32）
  const jsonLen = view.getUint32(0, true);
  const jsonBytes = new Uint8Array(buf, 4, jsonLen);
  const manifest: { files: BundleFileItem[] } = JSON.parse(
    new TextDecoder().decode(jsonBytes),
  );

  // 二进制数据起始偏移
  const dataStart = 4 + jsonLen;

  return manifest.files.map(file => ({
    file,
    buffer: buf.slice(dataStart + file.offset, dataStart + file.offset + file.length),
  }));
}
