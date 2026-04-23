/**
 * 资产文件管理服务。
 * 负责图片、JS 库、CSS 等文件的上传、列表、删除。
 */
import http from './http';

/** 资产元数据（与后端 SysAsset 对应） */
export interface AssetInfo {
  id: number;
  name: string;
  assetType: string;
  mimeType: string;
  filePath: string;
  fileSize: number;
  pageId: number | null;
  scope: string;
  createdAt: string;
}

/** 上传资产文件 */
export async function uploadAsset(
  file: File,
  pageId?: number | string,
  scope: string = 'page',
): Promise<AssetInfo> {
  const formData = new FormData();
  formData.append('file', file);
  if (pageId != null) formData.append('pageId', String(pageId));
  formData.append('scope', scope);

  const response = await http.post<{ data: AssetInfo }>('/assets/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return response.data.data;
}

/** 查询资产列表 */
export async function listAssets(
  pageId?: number | string,
  scope?: string,
): Promise<AssetInfo[]> {
  const params: Record<string, string> = {};
  if (pageId != null) params.pageId = String(pageId);
  if (scope) params.scope = scope;

  const response = await http.get<{ data: AssetInfo[] }>('/assets', { params });
  return response.data.data;
}

/** 删除资产（逻辑删除） */
export async function deleteAsset(id: number): Promise<void> {
  await http.delete(`/assets/${id}`);
}

/** 获取资产文件访问 URL */
export function getAssetFileUrl(id: number): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  return `${baseUrl}/assets/${id}/file`;
}
