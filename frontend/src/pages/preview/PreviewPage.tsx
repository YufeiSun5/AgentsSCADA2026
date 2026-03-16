import { Button, Empty, Space, Spin, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SchemaRenderer from '../../components/renderer/SchemaRenderer';
import { flattenNodes, type PageSchema } from '../../schema/pageSchema';
import { getPage } from '../../services/pageService';
import { executeScript } from '../../utils/scriptSandbox';

export default function PreviewPage() {
  const navigate = useNavigate();
  const { pageId = 'demo' } = useParams();
  const [page, setPage] = useState<PageSchema | null>(null);
  const [loading, setLoading] = useState(true);

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
      return;
    }

    const open_nodes = flattenNodes(page.root)
      .map((node) => ({
        node,
        script: node.scripts.onOpen || node.scripts.onLoad,
      }))
      .filter((item) => item.script);

    open_nodes.forEach((item) => {
      void executeScript(item.script, {
        message,
        page,
        node: item.node,
      }).catch(() => {
        message.error(`组件 ${item.node.title} 的 onOpen 脚本执行失败`);
      });
    });

    return () => {
      flattenNodes(page.root)
        .filter((node) => node.scripts.onClose)
        .forEach((node) => {
          void executeScript(node.scripts.onClose, {
            message,
            page,
            node,
          }).catch(() => {
            message.error(`组件 ${node.title} 的 onClose 脚本执行失败`);
          });
        });
    };
  }, [page]);

  if (loading) {
    return <Spin size="large" />;
  }

  if (!page) {
    return <Empty description="未找到预览页面" />;
  }

  return (
    <div className="preview-page">
      <div className="preview-head">
        <div>
          <Typography.Text className="app-kicker">Preview Page</Typography.Text>
          <Typography.Title>{page.name}</Typography.Title>
          <Typography.Paragraph>{page.description}</Typography.Paragraph>
        </div>
        <Space>
          <Button onClick={() => navigate(`/editor/${page.id}`)}>返回编辑器</Button>
        </Space>
      </div>
      <div className="preview-stage">
        <div className="preview-stage-scroll">
          <SchemaRenderer
            page={page}
            interactive
            onRunScript={(script, node) => {
              void executeScript(script, { message, page, node }).catch(() => {
                message.error(`组件 ${node.title} 的 onClick 脚本执行失败`);
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}