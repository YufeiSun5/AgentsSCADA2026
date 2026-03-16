import { createComponentNode, createEmptyPageSchema, type PageSchema } from '../schema/pageSchema';

const overviewPage = createEmptyPageSchema('产线总览看板');
overviewPage.status = 'enabled';
overviewPage.description = '用于展示关键设备状态、指标与事件入口。';

const headerPanel = createComponentNode('container');
headerPanel.title = '顶部信息带';
headerPanel.props = {
  ...headerPanel.props,
  x: 32,
  y: 20,
  width: 1536,
  height: 80,
  zIndex: 1,
  background: '#0d2436',
  borderRadius: 18,
};

const leftPanel = createComponentNode('container');
leftPanel.title = '设备表格区';
leftPanel.props = {
  ...leftPanel.props,
  x: 32,
  y: 116,
  width: 680,
  height: 332,
  zIndex: 1,
  background: '#0d2436',
  borderRadius: 18,
};

const rightPanel = createComponentNode('container');
rightPanel.title = '趋势图区';
rightPanel.props = {
  ...rightPanel.props,
  x: 736,
  y: 116,
  width: 832,
  height: 332,
  zIndex: 1,
  background: '#0d2436',
  borderRadius: 18,
};

const footerPanel = createComponentNode('container');
footerPanel.title = '运行摘要区';
footerPanel.props = {
  ...footerPanel.props,
  x: 32,
  y: 480,
  width: 1536,
  height: 360,
  zIndex: 1,
  background: '#0d2436',
  borderRadius: 18,
};

const titleNode = createComponentNode('text');
titleNode.title = '页面标题';
titleNode.props = {
  ...titleNode.props,
  x: 56,
  y: 34,
  width: 520,
  height: 56,
  text: '三号产线运行总览',
  color: '#f8fafc',
  fontSize: 28,
  zIndex: 3,
};

const statusText = createComponentNode('text');
statusText.title = '运行状态';
statusText.props = {
  ...statusText.props,
  x: 56,
  y: 72,
  width: 320,
  height: 28,
  text: '系统状态：运行中 / 网络正常 / 采集周期 5s',
  color: '#7dd3fc',
  fontSize: 14,
  zIndex: 3,
};

const buttonNode = createComponentNode('button');
buttonNode.title = '刷新按钮';
buttonNode.props = {
  ...buttonNode.props,
  x: 1320,
  y: 34,
  width: 140,
  height: 40,
  text: '刷新状态',
  buttonType: 'primary',
  zIndex: 3,
};
buttonNode.scripts.onClick = "Ctx.message.success('已触发刷新脚本');";

const tableNode = createComponentNode('table');
tableNode.title = '设备状态表';
tableNode.props = {
  ...tableNode.props,
  x: 56,
  y: 120,
  width: 620,
  height: 300,
  zIndex: 2,
  columns: [
    { title: '设备', dataIndex: 'device' },
    { title: '点位', dataIndex: 'tag' },
    { title: '当前值', dataIndex: 'value' },
    { title: '状态', dataIndex: 'status' },
  ],
  dataSource: [
    { key: '1', device: '循环泵 P-101', tag: 'P101-SPD', value: '1480 rpm', status: '运行' },
    { key: '2', device: '冷却塔风机 F-202', tag: 'F202-AMP', value: '18.6 A', status: '运行' },
    { key: '3', device: '换热器 E-03', tag: 'E03-TEMP', value: '48.1 ℃', status: '预警' },
    { key: '4', device: '阀门 V-09', tag: 'V09-OPEN', value: '62 %', status: '正常' },
  ],
};

const chartNode = createComponentNode('chart');
chartNode.title = '温度趋势图';
chartNode.props = {
  ...chartNode.props,
  x: 760,
  y: 136,
  width: 784,
  height: 272,
  zIndex: 2,
  option: {
    tooltip: { trigger: 'axis' },
    legend: { textStyle: { color: '#cbd5e1' } },
    grid: { top: 40, right: 24, bottom: 32, left: 40 },
    xAxis: {
      type: 'category',
      data: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00'],
      axisLabel: { color: '#94a3b8' },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#94a3b8' },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
    series: [
      {
        name: '供水温度',
        type: 'line',
        smooth: true,
        data: [45, 47, 49, 48, 50, 51],
        lineStyle: { color: '#38bdf8' },
        areaStyle: { color: 'rgba(56, 189, 248, 0.18)' },
      },
      {
        name: '回水温度',
        type: 'line',
        smooth: true,
        data: [39, 40, 42, 43, 44, 45],
        lineStyle: { color: '#f59e0b' },
        areaStyle: { color: 'rgba(245, 158, 11, 0.12)' },
      },
    ],
  },
};

const summaryTitle = createComponentNode('text');
summaryTitle.title = '运行摘要标题';
summaryTitle.props = {
  ...summaryTitle.props,
  x: 56,
  y: 500,
  width: 300,
  height: 30,
  text: '运行摘要与联动建议',
  color: '#f8fafc',
  fontSize: 22,
  zIndex: 3,
};

const summaryInput = createComponentNode('input');
summaryInput.title = '报警检索输入框';
summaryInput.props = {
  ...summaryInput.props,
  x: 56,
  y: 548,
  width: 320,
  height: 40,
  placeholder: '输入设备名、报警编码或点位',
  zIndex: 3,
};

const summaryButton = createComponentNode('button');
summaryButton.title = '确认联动按钮';
summaryButton.props = {
  ...summaryButton.props,
  x: 400,
  y: 548,
  width: 140,
  height: 40,
  text: '确认联动',
  buttonType: 'default',
  zIndex: 3,
};

const summaryText = createComponentNode('text');
summaryText.title = '联动建议说明';
summaryText.props = {
  ...summaryText.props,
  x: 56,
  y: 620,
  width: 980,
  height: 120,
  text: '当前建议：优先检查 E-03 换热器温度偏高原因，若持续 10 分钟超限，则联动降低循环泵频率并派发巡检任务。',
  color: '#cbd5e1',
  fontSize: 20,
  zIndex: 3,
};

overviewPage.root.props = {
  ...overviewPage.root.props,
  canvasWidth: 1600,
  canvasHeight: 900,
  background: '#071723',
  gridSize: 20,
};

overviewPage.root.children.push(
  headerPanel,
  leftPanel,
  rightPanel,
  footerPanel,
  titleNode,
  statusText,
  buttonNode,
  tableNode,
  chartNode,
  summaryTitle,
  summaryInput,
  summaryButton,
  summaryText,
);

const alarmPage = createEmptyPageSchema('报警联动页');
alarmPage.status = 'disabled';
alarmPage.description = '用于展示报警清单与处置状态。';

const alarmPanel = createComponentNode('container');
alarmPanel.title = '报警主区域';
alarmPanel.props = {
  ...alarmPanel.props,
  x: 28,
  y: 24,
  width: 1310,
  height: 720,
  zIndex: 1,
  background: '#172234',
  borderRadius: 18,
};

const alarmText = createComponentNode('text');
alarmText.props = {
  ...alarmText.props,
  x: 48,
  y: 36,
  width: 420,
  height: 52,
  text: '报警联动处置中心',
  color: '#fde68a',
  fontSize: 24,
  zIndex: 3,
};

const inputNode = createComponentNode('input');
inputNode.title = '报警筛选';
inputNode.props = {
  ...inputNode.props,
  x: 48,
  y: 112,
  width: 320,
  height: 40,
  placeholder: '请输入报警编码或设备名',
  zIndex: 3,
};

const alarmTable = createComponentNode('table');
alarmTable.title = '报警清单';
alarmTable.props = {
  ...alarmTable.props,
  x: 48,
  y: 184,
  width: 1240,
  height: 500,
  zIndex: 2,
  columns: [
    { title: '报警时间', dataIndex: 'time' },
    { title: '报警编码', dataIndex: 'code' },
    { title: '设备', dataIndex: 'device' },
    { title: '等级', dataIndex: 'level' },
    { title: '状态', dataIndex: 'status' },
  ],
  dataSource: [
    { key: '1', time: '10:15:24', code: 'ALM-E03-001', device: '换热器 E-03', level: '高', status: '待确认' },
    { key: '2', time: '10:17:08', code: 'ALM-P101-003', device: '循环泵 P-101', level: '中', status: '处理中' },
    { key: '3', time: '10:22:44', code: 'ALM-F202-006', device: '冷却塔风机 F-202', level: '低', status: '已抑制' },
  ],
};

const alarmAction = createComponentNode('button');
alarmAction.title = '派发工单';
alarmAction.props = {
  ...alarmAction.props,
  x: 1160,
  y: 112,
  width: 128,
  height: 40,
  text: '派发工单',
  buttonType: 'primary',
  zIndex: 3,
};

alarmPage.root.props = {
  ...alarmPage.root.props,
  canvasWidth: 1366,
  canvasHeight: 768,
  background: '#101826',
  gridSize: 16,
};

alarmPage.root.children.push(alarmPanel, alarmText, inputNode, alarmAction, alarmTable);

export const mockPages: PageSchema[] = [overviewPage, alarmPage];