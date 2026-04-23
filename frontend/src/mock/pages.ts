/*
 * 前端本地 Demo 页面。
 * 后端未接入时用于验证 HTML、文本、按钮、ECharts、表格、图片六类物料。
 */
import { createComponentNode, createEmptyPageSchema, type PageSchema } from '../schema/pageSchema';

const overviewPage = createEmptyPageSchema('前端实时组件 Demo');
overviewPage.status = 'enabled';
overviewPage.description = '使用 Mock 实时数据验证文本绑定、点击回写、按钮控制、HTML 桥接、图表、表格和图片组件。';

overviewPage.root.props = {
  ...overviewPage.root.props,
  canvasWidth: 1600,
  canvasHeight: 900,
  background: '#071723',
  gridSize: 20,
};
overviewPage.variables = [
  {
    id: 'page-var-mode',
    name: '页面模式',
    displayName: '页面运行模式',
    type: 'string',
    dataType: 'STRING',
    rwMode: 'RW',
    unit: '',
    initialValue: 'auto',
    summary: '当前页面自己的局部运行模式',
    displayExtra: {
      group: '页面局部变量',
    },
    customExtra: {},
  },
];
overviewPage.scripts.onVariableChange = `
// 页面模式变化后，直接把顶部文本同步成最新值。
if (change?.key === 'page.页面模式') {
  components.call('text_mode', 'setText', '页面模式：' + change.value);
}
`;

const titleNode = createComponentNode('text');
titleNode.title = '页面标题';
titleNode.props = {
  ...titleNode.props,
  x: 48,
  y: 32,
  width: 520,
  height: 54,
  text: 'SCADA 前端组件 Demo',
  color: '#f8fafc',
  fontSize: 30,
  zIndex: 3,
};

const statusText = createComponentNode('text');
statusText.title = '实时温度文本';
statusText.props = {
  ...statusText.props,
  x: 48,
  y: 112,
  width: 320,
  height: 72,
  text: '温度：--',
  color: '#7dd3fc',
  fontSize: 28,
  zIndex: 3,
  binding: {
    enabled: true,
    tagName: 'temperature',
    template: '温度：{value} {unit}',
    precision: 1,
    fallback: '温度：--',
  },
};

const setpointText = createComponentNode('text');
setpointText.title = '可回写设定值';
setpointText.props = {
  ...setpointText.props,
  x: 400,
  y: 112,
  width: 340,
  height: 72,
  text: '设定值：--',
  color: '#fde68a',
  fontSize: 28,
  zIndex: 3,
  binding: {
    enabled: true,
    tagName: 'setpoint',
    template: '设定值：{value} {unit}',
    precision: 1,
    fallback: '设定值：--',
  },
  writeBack: {
    enabled: true,
    tagName: 'setpoint',
    valueType: 'number',
    title: '写入温度设定值',
    placeholder: '请输入新的设定值',
  },
};

const startButton = createComponentNode('button');
startButton.title = '启动泵按钮';
startButton.props = {
  ...startButton.props,
  x: 780,
  y: 120,
  width: 140,
  height: 48,
  text: '启动泵',
  buttonType: 'primary',
  zIndex: 3,
  writeBack: {
    enabled: true,
    tagName: 'pump_run',
    value: 1,
    action: 'set',
    confirmRequired: true,
    confirmTitle: '确认启动循环泵？',
    successMessage: '启动指令已下发',
    errorMessage: '启动指令下发失败',
  },
};

const stopButton = createComponentNode('button');
stopButton.title = '停止泵按钮';
stopButton.props = {
  ...stopButton.props,
  x: 940,
  y: 120,
  width: 140,
  height: 48,
  text: '停止泵',
  buttonType: 'default',
  zIndex: 3,
  writeBack: {
    enabled: true,
    tagName: 'pump_run',
    value: 0,
    action: 'set',
    confirmRequired: true,
    confirmTitle: '确认停止循环泵？',
    successMessage: '停止指令已下发',
    errorMessage: '停止指令下发失败',
  },
};

const modeText = createComponentNode('text');
modeText.name = 'text_mode';
modeText.title = '页面局部变量文本';
modeText.props = {
  ...modeText.props,
  x: 1120,
  y: 104,
  width: 280,
  height: 40,
  text: '页面模式：--',
  color: '#a7f3d0',
  fontSize: 22,
  zIndex: 3,
  binding: {
    enabled: true,
    source: 'page',
    variableName: 'page.页面模式',
    template: '页面模式：{value}',
    fallback: '页面模式：--',
  },
};

const modeButton = createComponentNode('button');
modeButton.title = '切换页面模式';
modeButton.props = {
  ...modeButton.props,
  x: 1120,
  y: 152,
  width: 150,
  height: 40,
  text: '切到手动',
  buttonType: 'default',
  zIndex: 3,
  writeBack: {
    enabled: true,
    source: 'page',
    variableName: 'page.页面模式',
    value: 'manual',
    confirmRequired: false,
    successMessage: '页面变量已更新',
  },
};

const imageNode = createComponentNode('image');
imageNode.title = '设备图片';
imageNode.props = {
  ...imageNode.props,
  x: 48,
  y: 220,
  width: 430,
  height: 250,
  objectFit: 'cover',
  zIndex: 2,
};

const tableNode = createComponentNode('table');
tableNode.title = '实时点位表';
tableNode.props = {
  ...tableNode.props,
  x: 512,
  y: 220,
  width: 500,
  height: 250,
  zIndex: 2,
  gridEngine: 'ag-grid',
  pagination: {
    enabled: true,
    pageSize: 10,
  },
  theme: {
    compact: true,
    striped: true,
  },
  columnDefs: [
    { field: 'tag', headerName: '点位', width: 150, cellType: 'tag' },
    { field: 'name', headerName: '说明', width: 120 },
    { field: 'value', headerName: 'Mock 值', width: 120, editable: true, cellType: 'input' },
    { field: 'usage', headerName: '用途', width: 220 },
  ],
  rowData: [
    { key: '1', tag: 'temperature', name: '温度', value: '45.2 ℃', usage: '文本绑定 / HTML 绑定' },
    { key: '2', tag: 'setpoint', name: '温度设定值', value: '75 ℃', usage: '文本点击回写' },
    { key: '3', tag: 'pump_run', name: '循环泵运行', value: '1', usage: '按钮控制回写' },
    { key: '4', tag: 'pressure', name: '压力', value: '1.013 MPa', usage: '后续图表绑定预留' },
  ],
};

const chartNode = createComponentNode('chart');
chartNode.title = 'ECharts 趋势图';
chartNode.props = {
  ...chartNode.props,
  x: 1040,
  y: 220,
  width: 500,
  height: 250,
  zIndex: 2,
  option: {
    tooltip: { trigger: 'axis' },
    legend: { textStyle: { color: '#cbd5e1' } },
    grid: { top: 40, right: 24, bottom: 32, left: 42 },
    xAxis: {
      type: 'category',
      data: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00'],
      axisLabel: { color: '#94a3b8' },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#94a3b8' },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.16)' } },
    },
    series: [
      {
        name: '温度',
        type: 'line',
        smooth: true,
        data: [45.2, 46.1, 45.8, 47.3, 46.6, 48.1],
        lineStyle: { color: '#38bdf8' },
        areaStyle: { color: 'rgba(56, 189, 248, 0.18)' },
      },
      {
        name: '设定值',
        type: 'line',
        smooth: true,
        data: [75, 75, 75, 75, 75, 75],
        lineStyle: { color: '#fde68a' },
      },
    ],
  },
};

const htmlNode = createComponentNode('customHtml');
htmlNode.title = 'HTML 实时卡片';
htmlNode.props = {
  ...htmlNode.props,
  x: 48,
  y: 520,
  width: 500,
  height: 250,
  zIndex: 2,
};

const noteNode = createComponentNode('text');
noteNode.title = '测试说明';
noteNode.props = {
  ...noteNode.props,
  x: 590,
  y: 540,
  width: 700,
  height: 150,
  text: '测试路径：预览页观察温度文本自动变化；点击“设定值”文本输入新值；点击启动/停止泵按钮确认回写；点击“切到手动”写入页面局部变量；HTML 卡片使用 ScadaBridge.bindText 和 bindWriteDialog。',
  color: '#cbd5e1',
  fontSize: 20,
  zIndex: 3,
};

overviewPage.root.children.push(
  titleNode,
  statusText,
  setpointText,
  startButton,
  stopButton,
  modeText,
  modeButton,
  imageNode,
  tableNode,
  chartNode,
  htmlNode,
  noteNode,
);

const alarmPage = createEmptyPageSchema('组件精简验证页');
alarmPage.status = 'draft';
alarmPage.description = '只保留目标组件集合，用于验证新建、拖拽、属性编辑和预览运行。';
alarmPage.root.props = {
  ...alarmPage.root.props,
  canvasWidth: 1366,
  canvasHeight: 768,
  background: '#101826',
  gridSize: 16,
};

const alarmTitle = createComponentNode('text');
alarmTitle.props = {
  ...alarmTitle.props,
  x: 40,
  y: 36,
  width: 420,
  height: 52,
  text: '精简物料验证',
  color: '#fde68a',
  fontSize: 26,
  zIndex: 3,
};

const alarmTable = createComponentNode('table');
alarmTable.title = '组件清单';
alarmTable.props = {
  ...alarmTable.props,
  x: 40,
  y: 120,
  width: 640,
  height: 340,
  zIndex: 2,
  gridEngine: 'ag-grid',
  pagination: {
    enabled: true,
    pageSize: 10,
  },
  theme: {
    compact: true,
    striped: true,
  },
  columnDefs: [
    { field: 'name', headerName: '组件', width: 120 },
    { field: 'status', headerName: '状态', width: 100, cellType: 'tag' },
    { field: 'summary', headerName: '说明', flex: 1 },
  ],
  rowData: [
    { key: '1', name: 'HTML', status: '保留', summary: '主力自定义组件' },
    { key: '2', name: '文本', status: '保留', summary: '实时显示与弹窗回写' },
    { key: '3', name: '按钮', status: '保留', summary: '控制命令下发' },
    { key: '4', name: 'ECharts', status: '保留', summary: '趋势与统计图' },
    { key: '5', name: '表格', status: '保留', summary: '列表展示' },
    { key: '6', name: '图片', status: '新增', summary: '设备图和工艺图' },
  ],
};

const alarmChart = createComponentNode('chart');
alarmChart.title = '验证图表';
alarmChart.props = {
  ...alarmChart.props,
  x: 720,
  y: 120,
  width: 560,
  height: 340,
  zIndex: 2,
};

alarmPage.root.children.push(alarmTitle, alarmTable, alarmChart);

const variableRuntimePage = createEmptyPageSchema('页面变量运行时演示');
variableRuntimePage.id = 'page-runtime-variable-demo';
variableRuntimePage.status = 'enabled';
variableRuntimePage.description = '演示页面局部变量富结构、变量变化脚本、组件方法调用和 HTML ScadaBridge 页面变量 API。';
variableRuntimePage.root.props = {
  ...variableRuntimePage.root.props,
  canvasWidth: 1920,
  canvasHeight: 1080,
  background: '#081722',
  gridSize: 20,
  timerIntervalMs: 2000,
};
variableRuntimePage.variables = [
  {
    id: 'page-var-temperature',
    name: '温度',
    displayName: '页面温度',
    type: 'number',
    dataType: 'DOUBLE',
    rwMode: 'RW',
    unit: '℃',
    initialValue: '42.5',
    summary: '页面内模拟温度变量，演示 value / previousValue / 时间戳变化。',
    displayExtra: { group: '工艺状态', color: '#7dd3fc' },
    customExtra: { owner: 'demo' },
    scripts: {
      onChange: `
// 温度变化后单独计算报警等级，派生逻辑不再堆进页面总线脚本。
const temp = Number(change?.value || vars.getValue('page.温度') || 0);
const nextAlarmLevel = temp >= 80 ? 3 : temp >= 65 ? 2 : temp >= 55 ? 1 : 0;

if (Number(vars.getValue('page.报警等级') || 0) !== nextAlarmLevel) {
  vars.set('page.报警等级', nextAlarmLevel);
}
`,
    },
  },
  {
    id: 'page-var-pump-enabled',
    name: '循环泵运行',
    displayName: '循环泵运行',
    type: 'boolean',
    dataType: 'BOOL',
    rwMode: 'RW',
    unit: '',
    initialValue: 'false',
    summary: '页面内模拟布尔变量。',
    displayExtra: { group: '控制状态' },
    writeExtra: { requiresConfirm: false },
    scripts: {
      onChange: `
// 泵状态变化时补一条更直观的运行日志。
vars.set('page.操作日志', change?.value === true ? '循环泵已启动' : '循环泵已停止');
`,
    },
  },
  {
    id: 'page-var-mode',
    name: '页面模式',
    displayName: '页面模式',
    type: 'string',
    dataType: 'STRING',
    rwMode: 'RW',
    unit: '',
    initialValue: 'auto',
    summary: '页面局部字符串变量。',
    displayExtra: { group: '页面状态' },
    scripts: {
      onChange: `
// 页面模式变化时记录当前模式，方便和全局联动结果对照。
vars.set('page.操作日志', '页面模式切换为 ' + String(change?.value || 'auto'));
`,
    },
  },
  {
    id: 'page-var-alarm-level',
    name: '报警等级',
    displayName: '报警等级',
    type: 'number',
    dataType: 'INT32',
    rwMode: 'RW',
    unit: '',
    initialValue: '0',
    summary: '由温度变量的 onChange 脚本计算。',
    alarmExtra: { levelText: ['正常', '提示', '高温', '严重'] },
    scripts: {
      onChange: `
// 报警等级上升时记录日志，便于观察变量专属脚本与页面总线脚本的职责边界。
const level = Number(change?.value || 0);
if (level >= 2) {
  vars.set('page.操作日志', '温度报警升级到等级 ' + level);
}
`,
    },
  },
  {
    id: 'page-var-batch',
    name: '批次信息',
    displayName: '批次信息',
    type: 'json',
    dataType: 'JSON',
    rwMode: 'RW',
    unit: '',
    initialValue: '{"name":"A班","target":120,"actual":87}',
    summary: '页面局部 JSON 变量。',
    customExtra: { schema: 'demo.batch' },
    scripts: {
      onChange: `
// 批次推进时在变量自己的脚本里处理完成态提示。
const batch = change?.value && typeof change.value === 'object' ? change.value : {};
const target = Math.max(1, Number(batch.target || 120));
const actual = Math.max(0, Number(batch.actual || 0));

if (actual >= target) {
  vars.set('page.操作日志', '当前批次已完成：' + actual + '/' + target);
}
`,
    },
  },
  {
    id: 'page-var-action-log',
    name: '操作日志',
    displayName: '操作日志',
    type: 'string',
    dataType: 'STRING',
    rwMode: 'RW',
    unit: '',
    initialValue: '等待操作',
    summary: '记录按钮、HTML 和脚本对页面变量的写入行为。',
    displayExtra: { group: '操作反馈' },
  },
  {
    id: 'page-var-action-count',
    name: '操作次数',
    displayName: '操作次数',
    type: 'number',
    dataType: 'INT32',
    rwMode: 'RW',
    unit: '次',
    initialValue: '0',
    summary: '统计当前页面运行态内用户触发的操作次数。',
    displayExtra: { group: '操作反馈' },
  },
  {
    id: 'page-var-trend-buffer',
    name: '趋势样本',
    displayName: '趋势样本',
    type: 'json',
    dataType: 'JSON',
    rwMode: 'RW',
    unit: '',
    initialValue: '{"labels":["启动"],"temperature":[42.5],"alarm":[0],"batchProgress":[73],"actions":[0]}',
    summary: '缓存最近一段时间的趋势样本，供图表直接展示。',
    customExtra: { schema: 'demo.trend' },
  },
  {
    id: 'page-var-recent-events',
    name: '最近事件',
    displayName: '最近事件',
    type: 'json',
    dataType: 'JSON',
    rwMode: 'RW',
    unit: '',
    initialValue: '[]',
    summary: '缓存最近触发的变量事件和组件联动结果。',
    customExtra: { schema: 'demo.events' },
  },
];
variableRuntimePage.scripts.onOpen = `
// 页面打开时，初始化图表缓冲区和最近事件列表。
vars.set('page.趋势样本', {
  labels: ['启动'],
  temperature: [Number(vars.getValue('page.温度') || 42.5)],
  alarm: [Number(vars.getValue('page.报警等级') || 0)],
  batchProgress: [73],
  actions: [Number(vars.getValue('page.操作次数') || 0)]
}, {
  silent: true
});
vars.set('page.最近事件', [
  {
    key: 'boot-1',
    time: new Date().toLocaleTimeString(),
    variable: 'page.onOpen',
    value: '页面初始化',
    source: 'page_script',
    note: '演示页已装载文本、按钮、图表、表格、图片和 HTML 组件'
  }
], {
  silent: true
});

// 初始化首页状态文案，便于观察后续脚本和按钮是否生效。
vars.set('page.操作日志', '页面已打开，等待用户操作或定时刷新');
`;
variableRuntimePage.scripts.onTimer = `
// 定时器负责模拟温度和批次进度的自然变化。
const current = Number(vars.getValue('page.温度') || 42.5);
const pumpEnabled = vars.getValue('page.循环泵运行') === true;
const mode = String(vars.getValue('page.页面模式') || 'auto');
const delta = pumpEnabled ? (mode === 'manual' ? -0.8 : -1.4) : (mode === 'manual' ? 1.2 : 0.9);
const nextValue = Math.max(28, Math.min(92, Math.round((current + delta) * 10) / 10));
vars.set('page.温度', nextValue);

// 批次信息跟随定时器推进，模拟产线持续生产。
const batch = vars.getValue('page.批次信息');
if (batch && typeof batch === 'object') {
  vars.set('page.批次信息', {
    ...batch,
    actual: Math.max(0, Number(batch.actual || 0) + (pumpEnabled ? 2 : 1)),
    lastTemp: nextValue
  });
}
`;
variableRuntimePage.scripts.onVariableChange = `
// 页面 onVariableChange 现在只保留全局汇总、趋势采样和组件分发。
if (change && change.key !== 'page.趋势样本' && change.key !== 'page.最近事件') {
  const callComponent = (componentName, methodName, ...args) => {
    try {
      return components.call(componentName, methodName, ...args);
    } catch (error) {
      console.warn('组件方法调用失败', componentName, methodName, error);
      return null;
    }
  };
  const formatValue = (value) => {
    if (value === null || value === undefined) return '--';
    if (typeof value === 'number') return String(Math.round(value * 10) / 10);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };
  const formatTime = (ts) => ts ? new Date(ts).toLocaleTimeString() : '--';
  const takeTail = (list, max = 8) => Array.isArray(list) ? list.slice(Math.max(list.length - max, 0)) : [];
  const toNumberList = (list) => Array.isArray(list) ? list.map((item) => Number(item || 0)) : [];
  const buildStateImage = (tempValue, pumpValue, alarmValue, modeValue) => {
    const alarmColor = alarmValue >= 2 ? '#ef4444' : '#22c55e';
    const pumpColor = pumpValue ? '#1f883d' : '#64748b';
    const label = alarmValue >= 2 ? 'ALARM' : 'NORMAL';

    return '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">'
      + '<rect width="640" height="360" fill="#0d2436"/>'
      + '<rect x="56" y="70" width="528" height="188" rx="8" fill="#161b22" stroke="#30363d" stroke-width="4"/>'
      + '<circle cx="160" cy="164" r="56" fill="' + pumpColor + '"/>'
      + '<circle cx="480" cy="164" r="56" fill="' + alarmColor + '"/>'
      + '<path d="M222 164h196" stroke="#e6edf3" stroke-width="18" stroke-linecap="round"/>'
      + '<text x="160" y="170" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="26">' + (pumpValue ? 'RUN' : 'STOP') + '</text>'
      + '<text x="480" y="170" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="24">' + label + '</text>'
      + '<text x="320" y="305" text-anchor="middle" fill="#e6edf3" font-family="Arial" font-size="28">温度 ' + tempValue + ' ℃ / 模式 ' + modeValue + '</text>'
      + '</svg>';
  };

  // 页面总线脚本只读取当前快照并刷新组件，不再负责单变量派生。
  const tempVar = vars.get('page.温度');
  const pumpVar = vars.get('page.循环泵运行');
  const modeVar = vars.get('page.页面模式');
  const alarmVar = vars.get('page.报警等级');
  const batchVar = vars.get('page.批次信息');
  const logVar = vars.get('page.操作日志');
  const countVar = vars.get('page.操作次数');
  const temp = Number(tempVar?.value || 0);
  const pumpEnabled = pumpVar?.value === true;
  const mode = String(modeVar?.value || 'auto');
  const nextAlarmLevel = Number(alarmVar?.value || 0);
  const alarmText = ['正常', '提示', '高温', '严重'][nextAlarmLevel] || '未知';
  const actionCount = Number(countVar?.value || 0);
  const actionLog = String(logVar?.value || '等待操作');
  const batch = batchVar?.value && typeof batchVar.value === 'object' ? batchVar.value : {};
  const batchActual = Number(batch.actual || 0);
  const batchTarget = Math.max(1, Number(batch.target || 120));
  const batchProgress = Math.max(0, Math.min(100, Math.round((batchActual / batchTarget) * 100)));

  const trendValue = vars.getValue('page.趋势样本');
  const trend = trendValue && typeof trendValue === 'object' ? trendValue : {};
  const nextTrend = {
    labels: takeTail([...(Array.isArray(trend.labels) ? trend.labels : []), formatTime(change.ts)]),
    temperature: takeTail([...(toNumberList(trend.temperature)), temp]),
    alarm: takeTail([...(toNumberList(trend.alarm)), nextAlarmLevel]),
    batchProgress: takeTail([...(toNumberList(trend.batchProgress)), batchProgress]),
    actions: takeTail([...(toNumberList(trend.actions)), actionCount])
  };
  vars.set('page.趋势样本', nextTrend, {
    silent: true
  });

  const recentEventsValue = vars.getValue('page.最近事件');
  const recentEvents = Array.isArray(recentEventsValue) ? recentEventsValue : [];
  const nextEvents = takeTail([
    ...recentEvents,
    {
      key: 'evt-' + change.seq,
      time: formatTime(change.ts),
      variable: change.key,
      value: formatValue(change.value),
      source: change.source || '--',
      note: '当前模式 ' + mode + '，泵 ' + (pumpEnabled ? '运行' : '停止') + '，报警 ' + alarmText
    }
  ], 10);
  vars.set('page.最近事件', nextEvents, {
    silent: true
  });

  const statusText = '模式：' + mode + ' / 泵：' + (pumpEnabled ? '运行' : '停止') + ' / 温度：' + temp + ' ℃ / 报警：' + alarmText + '(' + nextAlarmLevel + ')';
  const realtimeRows = [
    {
      key: 'rt-temp',
      metric: '页面温度',
      current: temp + ' ℃',
      previous: formatValue(tempVar?.previousValue),
      quality: tempVar?.quality || 'GOOD',
      progress: Math.max(0, Math.min(100, Math.round((temp / 90) * 100))),
      note: nextAlarmLevel >= 2 ? '高温联动已触发图表和图片报警态' : (pumpEnabled ? '泵运行中，温度趋稳' : '泵停止后温度回升')
    },
    {
      key: 'rt-pump',
      metric: '循环泵',
      current: pumpEnabled ? '运行' : '停止',
      previous: formatValue(pumpVar?.previousValue),
      quality: pumpVar?.quality || 'GOOD',
      progress: pumpEnabled ? 100 : 0,
      note: '按钮写入、HTML 写入和定时脚本都会读取这个状态'
    },
    {
      key: 'rt-mode',
      metric: '页面模式',
      current: mode,
      previous: formatValue(modeVar?.previousValue),
      quality: modeVar?.quality || 'GOOD',
      progress: mode === 'auto' ? 100 : 55,
      note: mode === 'auto' ? '定时脚本自动调节温度和批次' : '允许人工干预演示'
    },
    {
      key: 'rt-alarm',
      metric: '报警等级',
      current: alarmText + ' (' + nextAlarmLevel + ')',
      previous: formatValue(alarmVar?.previousValue),
      quality: alarmVar?.quality || 'GOOD',
      progress: nextAlarmLevel * 33,
      note: nextAlarmLevel >= 2 ? '图片转红、图表柱形拉高、状态表变更' : '系统处于正常演示区'
    },
    {
      key: 'rt-batch',
      metric: '批次进度',
      current: batchActual + ' / ' + batchTarget,
      previous: batchVar?.previousValue && typeof batchVar.previousValue === 'object'
        ? String(Number(batchVar.previousValue.actual || 0))
        : '--',
      quality: 'GOOD',
      progress: batchProgress,
      note: '班组 ' + String(batch.name || 'A班') + '，当前最近温度 ' + temp + ' ℃'
    },
    {
      key: 'rt-action',
      metric: '操作次数',
      current: actionCount + ' 次',
      previous: formatValue(countVar?.previousValue),
      quality: countVar?.quality || 'GOOD',
      progress: Math.max(0, Math.min(100, actionCount * 10)),
      note: actionLog
    }
  ];
  const componentRows = [
    {
      key: 'comp-text',
      component: '文本组件',
      type: 'Text',
      status: '联动中',
      coverage: 100,
      current: '温度文本支持绑定和点击写入，状态/日志文本通过 setText 同步刷新',
      methods: 'binding / writeBack / setText',
      time: formatTime(tempVar?.valueTs || change.ts)
    },
    {
      key: 'comp-button',
      component: '按钮组件',
      type: 'Button',
      status: actionCount > 0 ? '已交互' : '待操作',
      coverage: 100,
      current: 'writeBack 负责主写入，onClick 负责补充日志和计数，当前模式 ' + mode,
      methods: 'writeBack / onClick',
      time: formatTime(countVar?.valueTs || change.ts)
    },
    {
      key: 'comp-table',
      component: '表格组件',
      type: 'Table',
      status: '实时刷新',
      coverage: 96,
      current: '实时表 ' + realtimeRows.length + ' 行，事件表 ' + nextEvents.length + ' 行，状态表 6 行',
      methods: 'setRows / setDataSource / autoSizeColumns',
      time: formatTime(change.ts)
    },
    {
      key: 'comp-chart',
      component: '图表组件',
      type: 'Chart',
      status: nextAlarmLevel >= 2 ? '报警态' : '趋势态',
      coverage: 94,
      current: '最近 ' + nextTrend.labels.length + ' 个样本，温度曲线与报警/批次/操作次数同屏展示',
      methods: 'setOption',
      time: formatTime(change.ts)
    },
    {
      key: 'comp-image',
      component: '图片组件',
      type: 'Image',
      status: pumpEnabled ? '运行图' : '待机图',
      coverage: 92,
      current: nextAlarmLevel >= 2 ? '报警背景高亮，工艺示意图切换到红色告警态' : '根据泵和模式切换背景与铺满方式',
      methods: 'setSrc / setBackground / setObjectFit',
      time: formatTime(change.ts)
    },
    {
      key: 'comp-html',
      component: 'HTML 组件',
      type: 'HTML',
      status: '桥接在线',
      coverage: 100,
      current: 'ScadaBridge 正在订阅变量、写变量并回调页面组件，最近日志：' + actionLog,
      methods: 'bindVarText / subscribeVar / writeVar / callComponent',
      time: formatTime(change.ts)
    }
  ];
  const svg = buildStateImage(temp, pumpEnabled, nextAlarmLevel, mode);

  callComponent('runtime_status_text', 'setText', statusText);
  callComponent('runtime_action_log', 'setText', '最近变更：' + change.key + ' = ' + formatValue(change.value) + ' / ' + actionLog);
  callComponent('runtime_counter_text', 'setText', '操作次数：' + actionCount + ' 次 / 批次进度：' + batchActual + '/' + batchTarget + ' / 最近样本：' + nextTrend.labels.length + ' 个');
  callComponent('runtime_realtime_table', 'setRows', realtimeRows);
  callComponent('runtime_component_table', 'setRows', componentRows);
  callComponent('runtime_event_table', 'setRows', nextEvents);
  callComponent('runtime_state_image', 'setSrc', 'data:image/svg+xml;utf8,' + encodeURIComponent(svg));
  callComponent('runtime_state_image', 'setBackground', nextAlarmLevel >= 2 ? '#2d0b12' : (pumpEnabled ? '#081b12' : '#0d2436'));
  callComponent('runtime_state_image', 'setObjectFit', mode === 'manual' ? 'contain' : 'cover');
  callComponent('runtime_chart', 'setOption', {
  title: {
    text: '页面变量趋势',
    subtext: '最近变化：' + change.key + ' / ' + formatTime(change.ts) + ' / 模式 ' + mode,
    textStyle: { color: '#e6edf3' },
    subtextStyle: { color: '#94a3b8' }
  },
  legend: {
    top: 28,
    textStyle: { color: '#cbd5e1' }
  },
  tooltip: { trigger: 'axis' },
  grid: { top: 78, right: 56, bottom: 32, left: 42 },
  xAxis: {
    type: 'category',
    data: nextTrend.labels,
    axisLabel: { color: '#94a3b8' }
  },
  yAxis: [
    {
      type: 'value',
      name: '温度',
      axisLabel: { color: '#94a3b8' },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.16)' } }
    },
    {
      type: 'value',
      name: '百分比/次数',
      min: 0,
      max: 100,
      axisLabel: { color: '#94a3b8' },
      splitLine: { show: false }
    }
  ],
  series: [
    {
      name: '温度',
      type: 'line',
      smooth: true,
      data: nextTrend.temperature,
      lineStyle: { color: '#38bdf8' },
      areaStyle: { color: 'rgba(56, 189, 248, 0.12)' }
    },
    {
      name: '报警等级',
      type: 'bar',
      yAxisIndex: 1,
      data: nextTrend.alarm.map((value) => Number(value || 0) * 25),
      itemStyle: { color: nextAlarmLevel >= 2 ? '#ef4444' : '#f59e0b' }
    },
    {
      name: '批次完成',
      type: 'line',
      yAxisIndex: 1,
      smooth: true,
      data: nextTrend.batchProgress,
      lineStyle: { color: '#22c55e' }
    },
    {
      name: '操作次数',
      type: 'line',
      yAxisIndex: 1,
      smooth: true,
      data: nextTrend.actions,
      lineStyle: { color: '#c084fc' }
    }
  ]
  });
}
`;

const runtimeTitle = createComponentNode('text');
runtimeTitle.title = '运行时页面标题';
runtimeTitle.props = {
  ...runtimeTitle.props,
  x: 72,
  y: 36,
  width: 680,
  height: 56,
  text: '页面变量运行时演示',
  color: '#f8fafc',
  fontSize: 32,
  zIndex: 4,
};

const runtimeTempText = createComponentNode('text');
runtimeTempText.title = '页面温度文本';
runtimeTempText.props = {
  ...runtimeTempText.props,
  x: 72,
  y: 124,
  width: 300,
  height: 64,
  color: '#7dd3fc',
  fontSize: 26,
  zIndex: 4,
  binding: {
    enabled: true,
    source: 'page',
    variableName: 'page.温度',
    template: '页面温度（点我写入）：{value} {unit}',
    precision: 1,
    fallback: '页面温度：--',
  },
  writeBack: {
    enabled: true,
    source: 'page',
    variableName: 'page.温度',
    valueType: 'number',
    title: '写入页面温度',
    placeholder: '输入新的温度值',
  },
};

const runtimeModeText = createComponentNode('text');
runtimeModeText.title = '页面模式文本';
runtimeModeText.props = {
  ...runtimeModeText.props,
  x: 392,
  y: 124,
  width: 240,
  height: 64,
  color: '#a7f3d0',
  fontSize: 24,
  zIndex: 4,
  binding: {
    enabled: true,
    source: 'page',
    variableName: 'page.页面模式',
    template: '页面模式：{value}',
    fallback: '页面模式：--',
  },
};

const runtimePumpText = createComponentNode('text');
runtimePumpText.title = '页面泵状态文本';
runtimePumpText.props = {
  ...runtimePumpText.props,
  x: 656,
  y: 124,
  width: 236,
  height: 64,
  color: '#fca5a5',
  fontSize: 24,
  zIndex: 4,
  binding: {
    enabled: true,
    source: 'page',
    variableName: 'page.循环泵运行',
    template: '循环泵：{value}',
    fallback: '循环泵：--',
  },
};

const runtimeAlarmText = createComponentNode('text');
runtimeAlarmText.title = '报警等级文本';
runtimeAlarmText.props = {
  ...runtimeAlarmText.props,
  x: 916,
  y: 124,
  width: 236,
  height: 64,
  color: '#fde68a',
  fontSize: 24,
  zIndex: 4,
  binding: {
    enabled: true,
    source: 'page',
    variableName: 'page.报警等级',
    template: '报警等级：{value}',
    fallback: '报警等级：--',
  },
};

const runtimeStatusText = createComponentNode('text');
runtimeStatusText.name = 'runtime_status_text';
runtimeStatusText.title = '变量变化脚本状态文本';
runtimeStatusText.props = {
  ...runtimeStatusText.props,
  x: 72,
  y: 192,
  width: 860,
  height: 42,
  text: '等待变量变化脚本刷新状态',
  color: '#fde68a',
  fontSize: 18,
  zIndex: 4,
};

const runtimeActionLog = createComponentNode('text');
runtimeActionLog.name = 'runtime_action_log';
runtimeActionLog.title = '操作日志文本';
runtimeActionLog.props = {
  ...runtimeActionLog.props,
  x: 964,
  y: 192,
  width: 884,
  height: 40,
  text: '操作日志：等待操作',
  color: '#c4b5fd',
  fontSize: 18,
  zIndex: 4,
};

const runtimeCounterText = createComponentNode('text');
runtimeCounterText.name = 'runtime_counter_text';
runtimeCounterText.title = '操作计数与批次进度';
runtimeCounterText.props = {
  ...runtimeCounterText.props,
  x: 1190,
  y: 124,
  width: 658,
  height: 64,
  text: '操作次数：0 次 / 批次进度：87/120 / 最近样本：1 个',
  color: '#cbd5e1',
  fontSize: 18,
  zIndex: 4,
};

const runtimeTopComment = createComponentNode('text');
runtimeTopComment.title = '注释：文本和按钮';
runtimeTopComment.props = {
  ...runtimeTopComment.props,
  x: 72,
  y: 92,
  width: 1776,
  height: 24,
  text: '注释：顶部是变量概览与操作入口；温度/泵/模式/报警/批次都带变量专属 onChange 脚本；页面 onVariableChange 只负责总线汇总、组件分发和趋势刷新。',
  color: '#94a3b8',
  fontSize: 16,
  zIndex: 4,
};

const runtimePumpStart = createComponentNode('button');
runtimePumpStart.title = '启动页面泵变量';
runtimePumpStart.props = {
  ...runtimePumpStart.props,
  x: 72,
  y: 252,
  width: 144,
  height: 40,
  text: '页面泵启动',
  buttonType: 'primary',
  zIndex: 4,
  writeBack: {
    enabled: true,
    source: 'page',
    variableName: 'page.循环泵运行',
    value: true,
    confirmRequired: false,
    successMessage: '页面变量 循环泵运行=true',
  },
};
runtimePumpStart.scripts.onClick = `
// 配置式 writeBack 已负责主写入，这里只补充操作计数和日志。
const count = Number(vars.getValue('page.操作次数') || 0) + 1;
vars.set('page.操作次数', count);
vars.set('page.操作日志', '配置式按钮已启动页面泵，writeBack 先写 page.循环泵运行，onClick 再记录日志');
`;

const runtimePumpStop = createComponentNode('button');
runtimePumpStop.title = '停止页面泵变量';
runtimePumpStop.props = {
  ...runtimePumpStop.props,
  x: 232,
  y: 252,
  width: 144,
  height: 40,
  text: '页面泵停止',
  buttonType: 'default',
  zIndex: 4,
  writeBack: {
    enabled: true,
    source: 'page',
    variableName: 'page.循环泵运行',
    value: false,
    confirmRequired: false,
    successMessage: '页面变量 循环泵运行=false',
  },
};
runtimePumpStop.scripts.onClick = `
// 停泵按钮同样只负责补充说明性状态，不重复写主变量。
const count = Number(vars.getValue('page.操作次数') || 0) + 1;
vars.set('page.操作次数', count);
vars.set('page.操作日志', '配置式按钮已停止页面泵，简单功能不需要在 onClick 手写主逻辑');
`;

const runtimeManualButton = createComponentNode('button');
runtimeManualButton.title = '切换手动模式';
runtimeManualButton.props = {
  ...runtimeManualButton.props,
  x: 392,
  y: 252,
  width: 144,
  height: 40,
  text: '切手动',
  buttonType: 'default',
  zIndex: 4,
  writeBack: {
    enabled: true,
    source: 'page',
    variableName: 'page.页面模式',
    value: 'manual',
    confirmRequired: false,
    successMessage: '页面变量 页面模式=manual',
  },
};
runtimeManualButton.scripts.onClick = `
// 模式切换的真正写入由 writeBack 完成，脚本仅记录操作轨迹。
const count = Number(vars.getValue('page.操作次数') || 0) + 1;
vars.set('page.操作次数', count);
vars.set('page.操作日志', '配置式按钮已切换为手动模式');
`;

const runtimeAutoButton = createComponentNode('button');
runtimeAutoButton.title = '切换自动模式';
runtimeAutoButton.props = {
  ...runtimeAutoButton.props,
  x: 552,
  y: 252,
  width: 144,
  height: 40,
  text: '切自动',
  buttonType: 'primary',
  zIndex: 4,
  writeBack: {
    enabled: true,
    source: 'page',
    variableName: 'page.页面模式',
    value: 'auto',
    confirmRequired: false,
    successMessage: '页面变量 页面模式=auto',
  },
};
runtimeAutoButton.scripts.onClick = `
// 切回自动模式后，后续定时器会重新接管温度变化。
const count = Number(vars.getValue('page.操作次数') || 0) + 1;
vars.set('page.操作次数', count);
vars.set('page.操作日志', '配置式按钮已切换为自动模式');
`;

const runtimeBoostButton = createComponentNode('button');
runtimeBoostButton.title = '脚本升温按钮';
runtimeBoostButton.props = {
  ...runtimeBoostButton.props,
  x: 72,
  y: 304,
  width: 144,
  height: 40,
  text: '脚本升温',
  buttonType: 'dashed',
  zIndex: 4,
  writeBack: {
    enabled: false,
  },
};
runtimeBoostButton.scripts.onClick = `
// 这是纯脚本按钮示例：直接改页面变量，不依赖 writeBack。
const current = Number(vars.getValue('page.温度') || 0);
vars.set('page.温度', Math.round((current + 5) * 10) / 10);
const count = Number(vars.getValue('page.操作次数') || 0) + 1;
vars.set('page.操作次数', count);
vars.set('page.操作日志', '脚本按钮直接执行 onClick：温度 +5℃');
`;

const runtimeResetButton = createComponentNode('button');
runtimeResetButton.title = '脚本复位按钮';
runtimeResetButton.props = {
  ...runtimeResetButton.props,
  x: 232,
  y: 304,
  width: 144,
  height: 40,
  text: '脚本复位',
  buttonType: 'default',
  zIndex: 4,
  writeBack: {
    enabled: false,
  },
};
runtimeResetButton.scripts.onClick = `
// 一次性恢复所有核心页面变量，便于反复演示整套联动流程。
vars.set('page.温度', 42.5);
vars.set('page.循环泵运行', false);
vars.set('page.页面模式', 'auto');
vars.set('page.批次信息', {
  name: 'A班',
  target: 120,
  actual: 87
});
vars.set('page.操作次数', 0);
vars.set('page.操作日志', '脚本复位：页面变量已恢复初始状态');
`;

const runtimeBatchButton = createComponentNode('button');
runtimeBatchButton.title = '脚本推进批次 +20';
runtimeBatchButton.props = {
  ...runtimeBatchButton.props,
  x: 392,
  y: 304,
  width: 144,
  height: 40,
  text: '批次 +20',
  buttonType: 'dashed',
  zIndex: 4,
  writeBack: {
    enabled: false,
  },
};
runtimeBatchButton.scripts.onClick = `
// 读取 JSON 结构的批次信息，在现有基础上推进 20。
const batch = vars.getValue('page.批次信息') || {};
vars.set('page.批次信息', {
  ...batch,
  actual: Math.min(Number(batch.target || 120), Number(batch.actual || 0) + 20)
});
const count = Number(vars.getValue('page.操作次数') || 0) + 1;
vars.set('page.操作次数', count);
vars.set('page.操作日志', '脚本按钮推进批次进度 +20');
`;

const runtimeAlarmButton = createComponentNode('button');
runtimeAlarmButton.title = '脚本触发高温';
runtimeAlarmButton.props = {
  ...runtimeAlarmButton.props,
  x: 552,
  y: 304,
  width: 144,
  height: 40,
  text: '触发高温',
  buttonType: 'primary',
  zIndex: 4,
  writeBack: {
    enabled: false,
  },
};
runtimeAlarmButton.scripts.onClick = `
// 人工拉高温度，快速触发报警链路，便于检查图表和图片联动。
vars.set('page.温度', 82);
const count = Number(vars.getValue('page.操作次数') || 0) + 1;
vars.set('page.操作次数', count);
vars.set('page.操作日志', '脚本按钮将温度设置为 82℃，触发报警联动');
`;

const runtimeImage = createComponentNode('image');
runtimeImage.title = '变量运行示意图';
runtimeImage.name = 'runtime_state_image';
runtimeImage.props = {
  ...runtimeImage.props,
  x: 72,
  y: 372,
  width: 460,
  height: 284,
  zIndex: 2,
};

const runtimeChart = createComponentNode('chart');
runtimeChart.name = 'runtime_chart';
runtimeChart.title = '页面变量图表';
runtimeChart.props = {
  ...runtimeChart.props,
  x: 556,
  y: 372,
  width: 760,
  height: 284,
  zIndex: 2,
  option: {
    title: {
      text: '页面变量趋势',
      subtext: '等待变量变化',
      textStyle: { color: '#e6edf3' },
      subtextStyle: { color: '#94a3b8' },
    },
    legend: {
      top: 28,
      textStyle: { color: '#cbd5e1' },
    },
    tooltip: { trigger: 'axis' },
    grid: { top: 78, right: 56, bottom: 32, left: 42 },
    xAxis: {
      type: 'category',
      data: ['启动'],
      axisLabel: { color: '#94a3b8' },
    },
    yAxis: [
      {
        type: 'value',
        name: '温度',
        axisLabel: { color: '#94a3b8' },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.16)' } },
      },
      {
        type: 'value',
        name: '百分比/次数',
        min: 0,
        max: 100,
        axisLabel: { color: '#94a3b8' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '温度',
        type: 'line',
        smooth: true,
        data: [42.5],
        lineStyle: { color: '#38bdf8' },
        areaStyle: { color: 'rgba(56, 189, 248, 0.12)' },
      },
      {
        name: '报警等级',
        type: 'bar',
        yAxisIndex: 1,
        data: [0],
        itemStyle: { color: '#f59e0b' },
      },
      {
        name: '批次完成',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: [73],
        lineStyle: { color: '#22c55e' },
      },
      {
        name: '操作次数',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: [0],
        lineStyle: { color: '#c084fc' },
      },
    ],
  },
};

const runtimeRealtimeTable = createComponentNode('table');
runtimeRealtimeTable.title = '实时数据表';
runtimeRealtimeTable.name = 'runtime_realtime_table';
runtimeRealtimeTable.props = {
  ...runtimeRealtimeTable.props,
  x: 1340,
  y: 372,
  width: 508,
  height: 284,
  zIndex: 2,
  gridEngine: 'ag-grid',
  pagination: {
    enabled: true,
    pageSize: 10,
  },
  theme: {
    compact: true,
    striped: true,
    oddRowBackground: '#f6f8fa',
    evenRowBackground: '#ffffff',
    hoverRowBackground: '#eef6ff',
  },
  columnDefs: [
    { field: 'metric', headerName: '实时项', width: 100 },
    { field: 'current', headerName: '当前值', width: 100 },
    { field: 'previous', headerName: '上次值', width: 90 },
    { field: 'quality', headerName: '质量', width: 90, cellType: 'tag' },
    { field: 'progress', headerName: '负荷', width: 110, cellType: 'progress' },
    { field: 'note', headerName: '联动说明', flex: 1 },
  ],
  rowData: [
    { key: 'rt-temp', metric: '页面温度', current: '42.5 ℃', previous: '--', quality: 'GOOD', progress: 47, note: '等待定时脚本刷新' },
    { key: 'rt-pump', metric: '循环泵', current: '停止', previous: '--', quality: 'GOOD', progress: 0, note: '等待按钮或 HTML 写入' },
    { key: 'rt-mode', metric: '页面模式', current: 'auto', previous: '--', quality: 'GOOD', progress: 100, note: '等待切换模式' },
  ],
};

const runtimeComponentTable = createComponentNode('table');
runtimeComponentTable.title = '组件状态表';
runtimeComponentTable.name = 'runtime_component_table';
runtimeComponentTable.props = {
  ...runtimeComponentTable.props,
  x: 72,
  y: 692,
  width: 650,
  height: 292,
  zIndex: 2,
  gridEngine: 'ag-grid',
  pagination: {
    enabled: true,
    pageSize: 10,
  },
  theme: {
    compact: true,
    striped: true,
    oddRowBackground: '#f6f8fa',
    evenRowBackground: '#ffffff',
    hoverRowBackground: '#eef6ff',
  },
  columnDefs: [
    { field: 'component', headerName: '组件', width: 100 },
    { field: 'type', headerName: '类型', width: 82, cellType: 'tag' },
    { field: 'status', headerName: '状态', width: 90, cellType: 'tag' },
    { field: 'coverage', headerName: '覆盖度', width: 94, cellType: 'progress' },
    { field: 'current', headerName: '当前表现', flex: 1 },
  ],
  rowData: [
    { key: 'comp-text', component: '文本组件', type: 'Text', status: '待刷新', coverage: 100, current: '等待绑定和 setText 联动' },
    { key: 'comp-button', component: '按钮组件', type: 'Button', status: '待操作', coverage: 100, current: '等待 writeBack 和 onClick 演示' },
    { key: 'comp-chart', component: '图表组件', type: 'Chart', status: '待刷新', coverage: 94, current: '等待趋势样本进入图表' },
  ],
};

const runtimeHtml = createComponentNode('customHtml');
runtimeHtml.title = 'HTML 页面变量卡片';
runtimeHtml.props = {
  ...runtimeHtml.props,
  x: 746,
  y: 692,
  width: 470,
  height: 292,
  zIndex: 3,
  htmlContent: `<!-- HTML 页面变量桥接卡片：用于演示 ScadaBridge 与页面变量的交互。 -->
<div class="html-card runtime-card">
  <!-- 温度主值：通过 bindVarText 直接绑定 page.温度。 -->
  <span>HTML 页面变量桥接</span>
  <strong id="runtime-temp">--</strong>

  <!-- 下面三行由 subscribeVar 实时同步。 -->
  <p id="runtime-alarm">报警等级：--</p>
  <p id="runtime-mode-text">模式：--</p>
  <p id="runtime-html-log">日志：等待操作</p>

  <!-- 四个按钮分别演示写入、升温、停泵和主动同步。 -->
  <div class="runtime-actions">
    <button id="runtime-mode">写入模式</button>
    <button id="runtime-html-boost">HTML升温</button>
    <button id="runtime-html-stop">HTML停泵</button>
    <button id="runtime-html-sync">同步状态</button>
  </div>
</div>`,
  cssContent: `/* HTML 卡片主体：保持和整个深色大屏风格一致。 */
.runtime-card {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 16px;
  color: #e6edf3;
  background: #0d2436;
  border: 1px solid #30363d;
  border-radius: 6px;
  font-family: sans-serif;
}

/* 标题和主数值。 */
.runtime-card span {
  display: block;
  color: #8b949e;
  font-size: 13px;
}

.runtime-card strong {
  display: block;
  margin: 8px 0 8px;
  font-size: 30px;
}

/* 状态说明行。 */
.runtime-card p {
  margin: 0 0 8px;
  color: #fde68a;
}

/* 底部按钮区。 */
.runtime-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.runtime-card button {
  height: 32px;
  border: 1px solid #1a7f37;
  border-radius: 6px;
  color: #ffffff;
  background: #1f883d;
}

/* 次按钮使用偏暗样式，和主按钮区分开。 */
.runtime-card button + button {
  border-color: #30363d;
  background: #21262d;
}`,
  jsContent: `ScadaBridge.onReady(function () {
  // 写一个小工具函数，减少重复的 DOM 查询和赋值。
  function setText(selector, text) {
    var el = document.querySelector(selector);
    if (el) el.textContent = text;
  }

  // 统一累加页面操作次数，便于和按钮脚本共用同一套统计口径。
  async function incrementCount() {
    var count = await ScadaBridge.readVar("page.操作次数");
    await ScadaBridge.writeVar("page.操作次数", Number(count && count.value || 0) + 1);
  }

  // 主温度文本直接绑定页面变量。
  ScadaBridge.bindVarText("#runtime-temp", "page.温度", {
    template: "{value} {unit}",
    precision: 1,
    fallback: "--"
  });

  // 订阅报警等级，顺便展示上一次值，方便观察 previousValue 是否生效。
  ScadaBridge.subscribeVar("page.报警等级", function (variable) {
    setText("#runtime-alarm", "报警等级：" + variable.value + "，上次：" + (variable.previousValue ?? "--"));
  });

  // 订阅页面模式和日志，让 HTML 卡片能实时反映外部按钮与脚本的结果。
  ScadaBridge.subscribeVar("page.页面模式", function (variable) {
    setText("#runtime-mode-text", "模式：" + variable.value);
  });

  ScadaBridge.subscribeVar("page.操作日志", function (variable) {
    setText("#runtime-html-log", "日志：" + (variable.value || "等待操作"));
  });

  // 这个按钮直接弹写入框，把输入值回写到 page.页面模式。
  ScadaBridge.bindVarWriteDialog("#runtime-mode", "page.页面模式", {
    title: "写入页面模式",
    defaultValue: "manual",
    successMessage: false
  });

  // HTML 升温：直接写页面变量，同时调用文本组件方法提示用户。
  document.getElementById("runtime-html-boost").addEventListener("click", async function () {
    var variable = await ScadaBridge.readVar("page.温度");
    var current = Number(variable && variable.value || 0);
    await ScadaBridge.writeVar("page.温度", Math.round((current + 3) * 10) / 10);
    await incrementCount();
    await ScadaBridge.writeVar("page.操作日志", "HTML 按钮通过 ScadaBridge.writeVar 升温 +3℃");
    await ScadaBridge.callComponent("runtime_status_text", "setText", "HTML 已写入 page.温度 并触发全局联动");
  });

  // HTML 停泵：模拟另外一种入口修改同一个页面变量。
  document.getElementById("runtime-html-stop").addEventListener("click", async function () {
    await ScadaBridge.writeVar("page.循环泵运行", false);
    await incrementCount();
    await ScadaBridge.writeVar("page.操作日志", "HTML 按钮停止页面泵");
  });

  // HTML 同步：读取当前温度，并主动调用多个组件方法刷新展示。
  document.getElementById("runtime-html-sync").addEventListener("click", async function () {
    var variable = await ScadaBridge.readVar("page.温度");
    await incrementCount();
    await ScadaBridge.writeVar("page.操作日志", "HTML 调用组件方法刷新状态表");
    await ScadaBridge.callComponent("runtime_status_text", "setText", "HTML 手动同步：当前温度 " + Number(variable && variable.value || 0).toFixed(1) + " ℃");
    await ScadaBridge.callComponent("runtime_realtime_table", "autoSizeColumns");
    await ScadaBridge.callComponent("runtime_component_table", "autoSizeColumns");
  });
});`,
};

const runtimeEventTable = createComponentNode('table');
runtimeEventTable.title = '最近事件表';
runtimeEventTable.name = 'runtime_event_table';
runtimeEventTable.props = {
  ...runtimeEventTable.props,
  x: 1240,
  y: 692,
  width: 608,
  height: 292,
  zIndex: 2,
  gridEngine: 'ag-grid',
  pagination: {
    enabled: true,
    pageSize: 10,
  },
  theme: {
    compact: true,
    striped: true,
    oddRowBackground: '#f6f8fa',
    evenRowBackground: '#ffffff',
    hoverRowBackground: '#eef6ff',
  },
  columnDefs: [
    { field: 'time', headerName: '时间', width: 90 },
    { field: 'variable', headerName: '变量/事件', width: 130 },
    { field: 'value', headerName: '值', width: 100 },
    { field: 'source', headerName: '来源', width: 100, cellType: 'tag' },
    { field: 'note', headerName: '说明', flex: 1 },
  ],
  rowData: [
    { key: 'boot-1', time: '--', variable: 'page.onOpen', value: '页面初始化', source: 'page_script', note: '等待第一条变量变化' },
  ],
};

const runtimeBottomComment = createComponentNode('text');
runtimeBottomComment.title = '注释：HTML 变量桥接';
runtimeBottomComment.props = {
  ...runtimeBottomComment.props,
  x: 72,
  y: 1000,
  width: 1776,
  height: 24,
  text: '注释：HTML 组件通过 bindVarText / subscribeVar / bindVarWriteDialog / readVar / writeVar / callComponent 访问同一套中文 page.* 变量；右侧事件表会记录每次联动结果。',
  color: '#94a3b8',
  fontSize: 15,
  zIndex: 4,
};

const runtimeNote = createComponentNode('text');
runtimeNote.title = '页面变量说明';
runtimeNote.props = {
  ...runtimeNote.props,
  x: 72,
  y: 1026,
  width: 1776,
  height: 28,
  text: '这个页面覆盖所有主要演示路径：文本绑定与写入、按钮 writeBack 与脚本、图表趋势样本、表格动态刷新、图片状态切换，以及 HTML 通过 ScadaBridge 对页面变量和组件方法的桥接。',
  color: '#cbd5e1',
  fontSize: 15,
  zIndex: 4,
};

variableRuntimePage.root.children.push(
  runtimeTitle,
  runtimeTempText,
  runtimeModeText,
  runtimePumpText,
  runtimeAlarmText,
  runtimeStatusText,
  runtimeActionLog,
  runtimeCounterText,
  runtimeTopComment,
  runtimePumpStart,
  runtimePumpStop,
  runtimeManualButton,
  runtimeAutoButton,
  runtimeBoostButton,
  runtimeResetButton,
  runtimeBatchButton,
  runtimeAlarmButton,
  runtimeImage,
  runtimeChart,
  runtimeRealtimeTable,
  runtimeComponentTable,
  runtimeHtml,
  runtimeEventTable,
  runtimeBottomComment,
  runtimeNote,
);

export const mockPages: PageSchema[] = [overviewPage, variableRuntimePage, alarmPage];
