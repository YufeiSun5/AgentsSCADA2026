import { Button, Empty, InputNumber, Select, Space, Spin, Typography, message } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import SchemaRenderer from '../../components/renderer/SchemaRenderer';
import { flattenNodes, type ComponentNode, type PageSchema } from '../../schema/pageSchema';
import {
  normalizeRuntimeVariableKey,
  PageRuntime,
  PageRuntimeProvider,
  type RuntimeChangeSource,
  type RuntimeVariableChange,
  type SetRuntimeVariableOptions,
} from '../../runtime/pageRuntime';
import { getPage } from '../../services/pageService';
import { executeScript } from '../../utils/scriptSandbox';

export default function PreviewPage() {
  const { pageId = 'demo' } = useParams();
  const [page, setPage] = useState<PageSchema | null>(null);
  const [runtime, setRuntime] = useState<PageRuntime | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);
  const [previewHeight, setPreviewHeight] = useState<number | null>(null);
  const runtimeRef = useRef<PageRuntime | null>(null);
  const variableChangeQueueRef = useRef<RuntimeVariableChange[]>([]);
  const variableChangeFlushRef = useRef(false);

  // 预览尺寸覆盖：将用户调整后的宽高覆盖到 root.props。
  const displayPage = useMemo(() => {
    if (!page) return null;
    if (previewWidth === null && previewHeight === null) return page;

    return {
      ...page,
      root: {
        ...page.root,
        props: {
          ...page.root.props,
          ...(previewWidth !== null ? { canvasWidth: previewWidth } : {}),
          ...(previewHeight !== null ? { canvasHeight: previewHeight } : {}),
        },
      },
    };
  }, [page, previewWidth, previewHeight]);

  const buildScriptContext = (
    activePage: PageSchema,
    activeNode: ComponentNode,
    scriptSource: RuntimeChangeSource,
    change?: RuntimeVariableChange,
  ) => {
    const activeRuntime = runtimeRef.current;

    return {
      message,
      page: activePage,
      node: activeNode,
      pageVariables: activeRuntime?.getAllValues() || {},
      setPageVariable: (
        name: string,
        value: unknown,
        options?: SetRuntimeVariableOptions,
      ) =>
        activeRuntime?.setVar(name, value, options),
      vars: activeRuntime?.getVarsApi(),
      components: activeRuntime?.getComponentsApi(),
      change,
      variableChange: change
        ? {
          name: change.key,
          value: change.value,
        }
        : undefined,
      onVariableChange: activeRuntime
        ? activeRuntime.subscribeChanges.bind(activeRuntime)
        : undefined,
      scriptSource,
    };
  };

  const runScript = (
    script: string | undefined,
    activePage: PageSchema,
    activeNode: ComponentNode,
    errorLabel: string,
    scriptSource: RuntimeChangeSource,
    change?: RuntimeVariableChange,
  ) => executeScript(
    script,
    buildScriptContext(activePage, activeNode, scriptSource, change),
  ).catch(() => {
    message.error(errorLabel);
  });

  const enqueueVariableChange = (change: RuntimeVariableChange) => {
    variableChangeQueueRef.current.push(change);

    if (variableChangeFlushRef.current) {
      return;
    }

    variableChangeFlushRef.current = true;
    window.queueMicrotask(async () => {
      while (variableChangeQueueRef.current.length > 0) {
        const nextChange = variableChangeQueueRef.current.shift();
        const activePage = page;

        if (!nextChange || !activePage) {
          continue;
        }

        const matchedVariable = activePage.variables.find((item) =>
          normalizeRuntimeVariableKey(item.name, 'page') === nextChange.key,
        );

        if (matchedVariable?.scripts?.onChange) {
          await runScript(
            matchedVariable.scripts.onChange,
            activePage,
            activePage.root,
            `页面变量 ${matchedVariable.displayName || matchedVariable.name} 的 onChange 脚本执行失败`,
            'page_script',
            nextChange,
          );
        }

        if (!activePage.scripts.onVariableChange) {
          continue;
        }

        await runScript(
          activePage.scripts.onVariableChange,
          activePage,
          activePage.root,
          '页面 onVariableChange 脚本执行失败',
          'page_script',
          nextChange,
        );
      }

      variableChangeFlushRef.current = false;
    });
  };

  useEffect(() => {
    const loadPage = async () => {
      setLoading(true);
      try {
        const result = await getPage(pageId);
        setPage(result);
      } finally {
        setLoading(false);
      }
    };

    void loadPage();
  }, [pageId]);

  useEffect(() => {
    if (!page) {
      setRuntime(null);
      runtimeRef.current = null;
      return;
    }

    const nextRuntime = new PageRuntime(page);
    runtimeRef.current = nextRuntime;
    setRuntime(nextRuntime);
    variableChangeQueueRef.current = [];
    variableChangeFlushRef.current = false;
    setPreviewWidth(Number(page.root.props.canvasWidth || 1600));
    setPreviewHeight(Number(page.root.props.canvasHeight || 900));
  }, [page]);

  useEffect(() => {
    if (!runtime) {
      return undefined;
    }

    return runtime.subscribeChanges((change) => {
      enqueueVariableChange(change);
    });
  }, [runtime, page]);

  useEffect(() => {
    if (!page || !runtime) {
      return undefined;
    }

    void runScript(
      page.scripts.onOpen,
      page,
      page.root,
      '页面 onOpen 脚本执行失败',
      'page_script',
    );

    const open_nodes = flattenNodes(page.root)
      .map((node) => ({
        node,
        script: node.scripts.onOpen || node.scripts.onLoad,
      }))
      .filter((item) => item.script);

    open_nodes.forEach((item) => {
      void runScript(
        item.script,
        page,
        item.node,
        `组件 ${item.node.title} 的 onOpen 脚本执行失败`,
        'component_script',
      );
    });

    return () => {
      void runScript(
        page.scripts.onClose,
        page,
        page.root,
        '页面 onClose 脚本执行失败',
        'page_script',
      );

      flattenNodes(page.root)
        .filter((node) => node.scripts.onClose)
        .forEach((node) => {
          void runScript(
            node.scripts.onClose,
            page,
            node,
            `组件 ${node.title} 的 onClose 脚本执行失败`,
            'component_script',
          );
        });
    };
  }, [page, runtime]);

  useEffect(() => {
    if (!page || !runtime) {
      return undefined;
    }

    const timerIntervalMs = Number(page.root.props.timerIntervalMs || 0);
    if (!page.scripts.onTimer || timerIntervalMs <= 0) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      void runScript(
        page.scripts.onTimer,
        page,
        page.root,
        '页面 onTimer 脚本执行失败',
        'page_script',
      );
    }, timerIntervalMs);

    return () => {
      window.clearInterval(timerId);
    };
  }, [page, runtime]);

  if (loading) {
    return <Spin size="large" />;
  }

  if (!page) {
    return <Empty description="未找到预览页面" />;
  }

  const previewPage = displayPage || page;

  // 常用分辨率预设。
  const resolutionPresets = [
    { label: '1920 × 1080（FHD）', width: 1920, height: 1080 },
    { label: '1600 × 900', width: 1600, height: 900 },
    { label: '1440 × 900', width: 1440, height: 900 },
    { label: '1366 × 768', width: 1366, height: 768 },
    { label: '2560 × 1440（QHD）', width: 2560, height: 1440 },
    { label: '3840 × 2160（4K）', width: 3840, height: 2160 },
  ];

  return (
    <PageRuntimeProvider runtime={runtime}>
      <div className="preview-page">
        <div className="preview-head">
          <div>
            <Typography.Text className="app-kicker">Preview Page</Typography.Text>
            <Typography.Title>{previewPage.name}</Typography.Title>
            <Typography.Paragraph>{previewPage.description}</Typography.Paragraph>
          </div>
          <Space direction="vertical" align="end" size={8}>
            <Button onClick={() => window.close()}>关闭预览</Button>
            <Space size={6} wrap>
              <Select
                placeholder="预设分辨率"
                style={{ width: 200 }}
                size="small"
                options={resolutionPresets.map((item) => ({ label: item.label, value: item.label }))}
                onChange={(label) => {
                  const preset = resolutionPresets.find((item) => item.label === label);
                  if (preset) {
                    setPreviewWidth(preset.width);
                    setPreviewHeight(preset.height);
                  }
                }}
              />
              <InputNumber
                size="small"
                min={320}
                max={7680}
                value={previewWidth ?? undefined}
                onChange={(v) => setPreviewWidth(v ?? null)}
                addonBefore="W"
                style={{ width: 110 }}
              />
              <Typography.Text type="secondary">×</Typography.Text>
              <InputNumber
                size="small"
                min={240}
                max={4320}
                value={previewHeight ?? undefined}
                onChange={(v) => setPreviewHeight(v ?? null)}
                addonBefore="H"
                style={{ width: 110 }}
              />
            </Space>
          </Space>
        </div>
        <div className="preview-stage">
          <div className="preview-stage-scroll">
            <SchemaRenderer
              page={previewPage}
              interactive
              onRunScript={(script, node) => {
                void runScript(
                  script,
                  previewPage,
                  node,
                  `组件 ${node.title} 的 onClick 脚本执行失败`,
                  'component_script',
                );
              }}
            />
          </div>
        </div>
      </div>
    </PageRuntimeProvider>
  );
}
