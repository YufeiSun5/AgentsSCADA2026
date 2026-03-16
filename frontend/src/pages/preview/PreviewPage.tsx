import { Button, Empty, Space, Spin, Typography, message } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SchemaRenderer from '../../components/renderer/SchemaRenderer';
import { flattenNodes, type PageSchema } from '../../schema/pageSchema';
import { getPage } from '../../services/pageService';
import { executeScript } from '../../utils/scriptSandbox';

function buildPageVariableMap(page: PageSchema) {
  return Object.fromEntries(
    page.variables.map((item) => [item.name, item.initialValue]),
  );
}

export default function PreviewPage() {
  const navigate = useNavigate();
  const { pageId = 'demo' } = useParams();
  const [page, setPage] = useState<PageSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageVariables, setPageVariables] = useState<Record<string, unknown>>({});
  const pageVariablesRef = useRef<Record<string, unknown>>({});
  const variableChangeRef = useRef<{
    name: string;
    value: unknown;
  } | null>(null);

  const runtimePage = useMemo(() => {
    if (!page) {
      return null;
    }

    return {
      ...page,
      variables: page.variables.map((item) => ({
        ...item,
        initialValue: String(pageVariables[item.name] ?? item.initialValue ?? ''),
      })),
    };
  }, [page, pageVariables]);

  const setPageVariable = (name: string, value: unknown) => {
    setPageVariables((previous) => {
      if (previous[name] === value) {
        return previous;
      }

      variableChangeRef.current = {
        name,
        value,
      };

      return {
        ...previous,
        [name]: value,
      };
    });
  };

  const runPageScript = (script: string | undefined, errorLabel: string) => {
    if (!runtimePage) {
      return Promise.resolve();
    }

    return executeScript(script, {
      message,
      page: runtimePage,
      node: runtimePage.root,
      pageVariables: pageVariablesRef.current,
      setPageVariable,
      variableChange: variableChangeRef.current || undefined,
    }).catch(() => {
      message.error(errorLabel);
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
      setPageVariables({});
      pageVariablesRef.current = {};
      return;
    }

    const nextVariables = buildPageVariableMap(page);
    setPageVariables(nextVariables);
    pageVariablesRef.current = nextVariables;
    variableChangeRef.current = null;
  }, [page]);

  useEffect(() => {
    pageVariablesRef.current = pageVariables;
  }, [pageVariables]);

  useEffect(() => {
    if (!runtimePage) {
      return;
    }

    void runPageScript(runtimePage.scripts.onOpen, '页面 onOpen 脚本执行失败');

    const open_nodes = flattenNodes(runtimePage.root)
      .map((node) => ({
        node,
        script: node.scripts.onOpen || node.scripts.onLoad,
      }))
      .filter((item) => item.script);

    open_nodes.forEach((item) => {
      void executeScript(item.script, {
        message,
        page: runtimePage,
        node: item.node,
        pageVariables: pageVariablesRef.current,
        setPageVariable,
      }).catch(() => {
        message.error(`组件 ${item.node.title} 的 onOpen 脚本执行失败`);
      });
    });

    return () => {
      void runPageScript(runtimePage.scripts.onClose, '页面 onClose 脚本执行失败');

      flattenNodes(runtimePage.root)
        .filter((node) => node.scripts.onClose)
        .forEach((node) => {
          void executeScript(node.scripts.onClose, {
            message,
            page: runtimePage,
            node,
            pageVariables: pageVariablesRef.current,
            setPageVariable,
          }).catch(() => {
            message.error(`组件 ${node.title} 的 onClose 脚本执行失败`);
          });
        });
    };
  }, [runtimePage]);

  useEffect(() => {
    if (!runtimePage) {
      return;
    }

    const timerIntervalMs = Number(runtimePage.root.props.timerIntervalMs || 0);
    if (!runtimePage.scripts.onTimer || timerIntervalMs <= 0) {
      return;
    }

    const timerId = window.setInterval(() => {
      void runPageScript(runtimePage.scripts.onTimer, '页面 onTimer 脚本执行失败');
    }, timerIntervalMs);

    return () => {
      window.clearInterval(timerId);
    };
  }, [runtimePage]);

  useEffect(() => {
    if (!runtimePage || !variableChangeRef.current) {
      return;
    }

    void runPageScript(
      runtimePage.scripts.onVariableChange,
      '页面 onVariableChange 脚本执行失败',
    ).finally(() => {
      variableChangeRef.current = null;
    });
  }, [pageVariables, runtimePage]);

  if (loading) {
    return <Spin size="large" />;
  }

  if (!page) {
    return <Empty description="未找到预览页面" />;
  }

  const previewPage = runtimePage || page;

  return (
    <div className="preview-page">
      <div className="preview-head">
        <div>
          <Typography.Text className="app-kicker">Preview Page</Typography.Text>
          <Typography.Title>{previewPage.name}</Typography.Title>
          <Typography.Paragraph>{previewPage.description}</Typography.Paragraph>
        </div>
        <Space>
          <Button onClick={() => navigate(`/editor/${previewPage.id}`)}>返回编辑器</Button>
        </Space>
      </div>
      <div className="preview-stage">
        <div className="preview-stage-scroll">
          <SchemaRenderer
            page={previewPage}
            interactive
            onRunScript={(script, node) => {
              void executeScript(script, {
                message,
                page: previewPage,
                node,
                pageVariables: pageVariablesRef.current,
                setPageVariable,
              }).catch(() => {
                message.error(`组件 ${node.title} 的 onClick 脚本执行失败`);
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}