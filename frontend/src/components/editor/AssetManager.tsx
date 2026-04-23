/*
 * 资产管理器组件。
 * 在 ConfigPanel 中嵌入，用于上传、管理 customHtml 组件关联的图片、JS/CSS 库文件。
 */
import { Button, Empty, List, Modal, Space, Tag, Typography, Upload, message } from 'antd';
import { CopyOutlined, DeleteOutlined, FileOutlined, PictureOutlined, UploadOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useState } from 'react';
import { type AssetInfo, deleteAsset, getAssetFileUrl, listAssets, uploadAsset } from '../../services/assetService';

const assetTypeColorMap: Record<string, string> = {
  image: 'green',
  javascript: 'orange',
  stylesheet: 'blue',
  other: 'default',
};

const assetTypeIconMap: Record<string, React.ReactNode> = {
  image: <PictureOutlined />,
  javascript: <FileOutlined />,
  stylesheet: <FileOutlined />,
  other: <FileOutlined />,
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AssetManagerProps {
  pageId?: number | string;
  /** 选中的资产 ID 列表（库文件关联） */
  selectedIds?: number[];
  /** 切换库文件关联时触发 */
  onSelectedChange?: (ids: number[]) => void;
}

export default function AssetManager({ pageId, selectedIds, onSelectedChange }: AssetManagerProps) {
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAssets(pageId, 'page');
      setAssets(data);
    } catch {
      // 后端未就绪时静默忽略
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // 上传处理
  const handleUpload = useCallback(async (file: File) => {
    try {
      await uploadAsset(file, pageId, 'page');
      message.success(`${file.name} 上传成功`);
      fetchAssets();
    } catch (error) {
      message.error(`上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
    return false; // 阻止 antd 默认上传
  }, [pageId, fetchAssets]);

  // 删除处理
  const handleDelete = useCallback((asset: AssetInfo) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除 ${asset.name} 吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteAsset(asset.id);
          message.success('已删除');
          fetchAssets();
        } catch (error) {
          message.error(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      },
    });
  }, [fetchAssets]);

  // 复制 URL
  const handleCopyUrl = useCallback((asset: AssetInfo) => {
    const url = getAssetFileUrl(asset.id);
    navigator.clipboard.writeText(url).then(
      () => message.success('URL 已复制'),
      () => message.error('复制失败'),
    );
  }, []);

  // 切换库关联
  const toggleSelected = useCallback((id: number) => {
    if (!onSelectedChange || !selectedIds) return;
    const next = selectedIds.includes(id)
      ? selectedIds.filter((item) => item !== id)
      : [...selectedIds, id];
    onSelectedChange(next);
  }, [selectedIds, onSelectedChange]);

  // 仅 JS/CSS 类型可作为库文件关联
  const isLibraryAsset = (asset: AssetInfo) =>
    asset.assetType === 'javascript' || asset.assetType === 'stylesheet';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Upload.Dragger
        showUploadList={false}
        multiple
        beforeUpload={(file) => {
          handleUpload(file);
          return false;
        }}
        style={{ padding: '8px 0' }}
      >
        <p style={{ margin: 0, color: '#656d76', fontSize: 13 }}>
          <UploadOutlined style={{ marginRight: 6 }} />
          拖拽文件到此处或点击上传
        </p>
        <p style={{ margin: 0, color: '#8b949e', fontSize: 12 }}>
          支持图片、JS、CSS、字体文件，单文件最大 20MB
        </p>
      </Upload.Dragger>

      {assets.length === 0 && !loading ? (
        <Empty description="暂无资产文件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          size="small"
          loading={loading}
          dataSource={assets}
          renderItem={(asset) => {
            const isSelected = selectedIds?.includes(asset.id);
            const canSelect = isLibraryAsset(asset) && onSelectedChange;

            return (
              <List.Item
                style={{
                  padding: '6px 8px',
                  borderLeft: isSelected ? '3px solid #0969da' : '3px solid transparent',
                  background: isSelected ? 'rgba(9,105,218,0.04)' : undefined,
                  cursor: canSelect ? 'pointer' : undefined,
                }}
                onClick={() => canSelect && toggleSelected(asset.id)}
                actions={[
                  <Button
                    key="copy"
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    title="复制 URL"
                    onClick={(event) => { event.stopPropagation(); handleCopyUrl(asset); }}
                  />,
                  <Button
                    key="delete"
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    title="删除"
                    onClick={(event) => { event.stopPropagation(); handleDelete(asset); }}
                  />,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    asset.assetType === 'image' ? (
                      <img
                        src={getAssetFileUrl(asset.id)}
                        alt={asset.name}
                        style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, border: '1px solid #d0d7de' }}
                      />
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 4, background: '#f6f8fa', border: '1px solid #d0d7de', color: '#656d76' }}>
                        {assetTypeIconMap[asset.assetType] || <FileOutlined />}
                      </span>
                    )
                  }
                  title={
                    <Space size={4}>
                      <Typography.Text ellipsis style={{ maxWidth: 120, fontSize: 12 }}>
                        {asset.name}
                      </Typography.Text>
                      <Tag color={assetTypeColorMap[asset.assetType]} style={{ fontSize: 11, lineHeight: '18px', padding: '0 4px' }}>
                        {asset.assetType}
                      </Tag>
                      {isSelected ? (
                        <Tag color="blue" style={{ fontSize: 11, lineHeight: '18px', padding: '0 4px' }}>已关联</Tag>
                      ) : null}
                    </Space>
                  }
                  description={
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      {formatFileSize(asset.fileSize)}
                    </Typography.Text>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </div>
  );
}
