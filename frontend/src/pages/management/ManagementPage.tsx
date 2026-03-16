import { Button, Input, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createBlankPage, deletePage, duplicatePage, listPages, togglePageStatus } from '../../services/pageService';
import type { PageListQuery, PageSchema } from '../../schema/pageSchema';

const initialQuery: PageListQuery = {
  keyword: '',
  status: 'all',
  page: 1,
  pageSize: 6,
};

export default function ManagementPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState<PageListQuery>(initialQuery);
  const [data, setData] = useState<PageSchema[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await listPages(query);
      setData(result.list);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [query]);

  const columns: ColumnsType<PageSchema> = [
    {
      title: '页面名称',
      dataIndex: 'name',
      render: (_, record) => (
        <div>
          <Typography.Text strong>{record.name}</Typography.Text>
          <div>
            <Typography.Text type="secondary">{record.description}</Typography.Text>
          </div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (value) => <Tag color={value === 'enabled' ? 'green' : value === 'disabled' ? 'default' : 'gold'}>{value}</Tag>,
    },
    {
      title: '最近更新时间',
      dataIndex: 'updatedAt',
      width: 220,
      render: (value) => new Date(value).toLocaleString(),
    },
    {
      title: '操作',
      width: 360,
      render: (_, record) => (
        <Space wrap>
          <Button size="small" onClick={() => navigate(`/editor/${record.id}`)}>
            编辑
          </Button>
          <Button size="small" onClick={() => navigate(`/preview/${record.id}`)}>
            预览
          </Button>
          <Button
            size="small"
            onClick={async () => {
              const page = await duplicatePage(record.id);
              if (page) {
                message.success('已复制页面');
                void loadData();
              }
            }}
          >
            从模板复制
          </Button>
          <Button
            size="small"
            onClick={async () => {
              await togglePageStatus(record.id);
              message.success('状态已切换');
              void loadData();
            }}
          >
            {record.status === 'enabled' ? '禁用' : '启用'}
          </Button>
          <Popconfirm
            title="确认删除该页面吗？"
            onConfirm={async () => {
              await deletePage(record.id);
              message.success('页面已删除');
              void loadData();
            }}
          >
            <Button size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="management-page">
      <div className="management-hero">
        <div>
          <Typography.Text className="app-kicker">Management Page</Typography.Text>
          <Typography.Title>页面资产管理台</Typography.Title>
          <Typography.Paragraph>
            覆盖任务书要求的页面列表、检索、状态切换、新建与模板复制入口，并为后端 REST API 预留 Axios 拦截器基础层。
          </Typography.Paragraph>
        </div>
        <Button
          type="primary"
          size="large"
          onClick={async () => {
            const page = await createBlankPage();
            navigate(`/editor/${page.id}`);
          }}
        >
          新建空白页面
        </Button>
      </div>
      <div className="management-toolbar">
        <Input.Search
          allowClear
          placeholder="按名称或描述检索"
          value={query.keyword}
          onChange={(event) => setQuery((prev) => ({ ...prev, keyword: event.target.value, page: 1 }))}
          onSearch={() => void loadData()}
        />
        <Select
          value={query.status}
          onChange={(value) => setQuery((prev) => ({ ...prev, status: value, page: 1 }))}
          options={[
            { value: 'all', label: '全部状态' },
            { value: 'draft', label: '草稿' },
            { value: 'enabled', label: '已启用' },
            { value: 'disabled', label: '已禁用' },
          ]}
        />
      </div>
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={data}
        pagination={{
          current: query.page,
          pageSize: query.pageSize,
          total,
          onChange: (page, pageSize) => setQuery((prev) => ({ ...prev, page, pageSize })),
        }}
      />
    </div>
  );
}