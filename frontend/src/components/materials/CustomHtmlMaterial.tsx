import { useEffect, useRef, useMemo, useCallback } from 'react';
import type { MaterialRenderProps } from './materialTypes';
import { SCADA_BRIDGE_SDK_SOURCE } from '../../utils/scadaBridge';
import { BridgeManager } from '../../utils/bridgeManager';
import { usePageRuntime } from '../../runtime/pageRuntime';

/**
 * 自定义 HTML 物料组件。
 * 通过 iframe srcdoc 渲染用户自定义的 HTML/CSS/JS，
 * ScadaBridge SDK 自动注入，提供实时变量访问能力。
 */
export default function CustomHtmlMaterial({ node, interactive }: MaterialRenderProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<BridgeManager | null>(null);
  const runtime = usePageRuntime();

  const htmlContent = String(node.props.htmlContent ?? '');
  const cssContent = String(node.props.cssContent ?? '');
  const jsContent = String(node.props.jsContent ?? '');
  const transparent = node.props.transparent !== false;
  const libraryAssetIds = (node.props.libraryAssetIds as string[]) ?? [];
  const sandboxPermissions = String(node.props.sandboxPermissions ?? 'allow-scripts');

  // 组装 srcdoc：SDK + 库 + CSS + HTML + JS
  const srcdoc = useMemo(() => {
    const transparentStyle = transparent
      ? 'html, body { background: transparent; margin: 0; padding: 0; }'
      : 'html, body { margin: 0; padding: 0; }';

    // 第三方库引用标签
    const libraryTags = libraryAssetIds
      .map((id) => {
        const url = `/api/assets/${id}/file`;
        // 简单判断：如果 id 对应的文件是 CSS 则用 link，否则用 script
        return `<script src="${encodeURI(url)}"><\/script>`;
      })
      .join('\n    ');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>${transparentStyle}</style>
  <style>${cssContent}</style>
  ${libraryTags}
  <script>${SCADA_BRIDGE_SDK_SOURCE}<\/script>
</head>
<body>
  ${htmlContent}
  <script>${jsContent}<\/script>
</body>
</html>`;
  }, [htmlContent, cssContent, jsContent, transparent, libraryAssetIds]);

  // 初始化 BridgeManager
  const handleIframeLoad = useCallback(() => {
    if (!iframeRef.current || !interactive) return;

    // 清理旧的 bridge
    bridgeRef.current?.destroy();

    const bridge = new BridgeManager(node.id, runtime);
    bridge.attach(iframeRef.current);
    // iframe 内的 SDK 可能在父窗口 attach 之前已经发出 loaded 消息。
    // attach 后补发 ready，保证 ScadaBridge.onReady 回调一定能被触发。
    bridge.sendReady();
    bridgeRef.current = bridge;
  }, [node.id, interactive, runtime]);

  // 卸载时清理
  useEffect(() => {
    return () => {
      bridgeRef.current?.destroy();
      bridgeRef.current = null;
    };
  }, []);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcdoc}
      sandbox={sandboxPermissions}
      onLoad={handleIframeLoad}
      title={node.title || '自定义HTML组件'}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        background: transparent ? 'transparent' : '#ffffff',
        display: 'block',
        // 编辑模式禁用 iframe 交互，让鼠标事件穿透到画布层
        pointerEvents: interactive ? 'auto' : 'none',
      }}
    />
  );
}
