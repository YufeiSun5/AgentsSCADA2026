/*
 * 图片物料组件。
 * 负责渲染设备图、工艺图和资产图片，支持本地资产 ID 与普通 URL。
 */
import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { usePageRuntime } from '../../runtime/pageRuntime';
import type { MaterialRenderProps } from './materialTypes';

export default function ImageMaterial({ node }: MaterialRenderProps) {
    const runtime = usePageRuntime();
    const [runtimeSrc, setRuntimeSrc] = useState<string | null>(null);
    const [runtimeBackground, setRuntimeBackground] = useState<string | null>(null);
    const [runtimeObjectFit, setRuntimeObjectFit] = useState<CSSProperties['objectFit'] | null>(null);
    const assetId = String(node.props.assetId || '').trim();
    const configuredSrc = assetId
        ? `/api/assets/${encodeURIComponent(assetId)}/file`
        : String(node.props.src || '');
    const src = runtimeSrc ?? configuredSrc;
    const alt = String(node.props.alt || node.title || '图片');
    const objectFit = runtimeObjectFit ?? String(node.props.objectFit || 'cover') as CSSProperties['objectFit'];

    useEffect(() => {
        setRuntimeSrc(null);
        setRuntimeBackground(null);
        setRuntimeObjectFit(null);
    }, [node.props.src, node.props.assetId, node.props.background, node.props.objectFit]);

    useEffect(() => {
        return runtime?.registerComponent(node.id, {
            setSrc: (value) => setRuntimeSrc(String(value || '')),
            clearSrc: () => setRuntimeSrc(null),
            setBackground: (value) => setRuntimeBackground(String(value || '')),
            setObjectFit: (value) => setRuntimeObjectFit(String(value || 'cover') as CSSProperties['objectFit']),
        }, [node.name]);
    }, [runtime, node.id, node.name]);

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                borderRadius: Number(node.props.borderRadius || 6),
                background: runtimeBackground ?? String(node.props.background || '#0d2436'),
            }}
        >
            {src ? (
                <img
                    src={src}
                    alt={alt}
                    draggable={false}
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'block',
                        objectFit,
                    }}
                />
            ) : null}
        </div>
    );
}
