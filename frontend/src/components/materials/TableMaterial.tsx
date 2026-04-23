/*
 * AG Grid 表格物料组件。
 * 表格是低代码核心物料，使用统一 JSON 协议映射到 AG Grid，避免让 AI 直接生成函数。
 */
import {
  AllCommunityModule,
  ModuleRegistry,
  type CellValueChangedEvent,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { AgGridReact } from 'ag-grid-react';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePageRuntime } from '../../runtime/pageRuntime';
import type { MaterialRenderProps } from './materialTypes';

ModuleRegistry.registerModules([AllCommunityModule]);

type RowRecord = Record<string, unknown>;

interface LowCodeColumn {
  field?: string;
  dataIndex?: string;
  headerName?: string;
  title?: string;
  width?: number;
  minWidth?: number;
  flex?: number;
  pinned?: 'left' | 'right' | boolean;
  sortable?: boolean;
  filter?: boolean;
  resizable?: boolean;
  editable?: boolean;
  cellType?: 'text' | 'tag' | 'button' | 'input' | 'switch' | 'progress' | 'variable';
  buttonText?: string;
  prefix?: string;
  suffix?: string;
  precision?: number;
  tagColor?: string;
  trueText?: string;
  falseText?: string;
  action?: LowCodeCellAction;
}

interface LowCodeCellAction {
  type?: 'script' | 'setPageVar' | 'callComponent';
  variableName?: string;
  value?: unknown;
  valueField?: string;
  component?: string;
  method?: string;
  args?: unknown[];
  reason?: string;
}

interface PaginationConfig {
  enabled: boolean;
  pageSize: number;
  pageSizeOptions: number[];
}

interface ThemeConfig {
  className: string;
  striped: boolean;
  compact: boolean;
  oddRowBackground: string;
  evenRowBackground: string;
  hoverRowBackground: string;
  headerBackground: string;
  headerColor: string;
  textColor: string;
  borderColor: string;
  background: string;
}

function readRows(value: unknown): RowRecord[] {
  return Array.isArray(value) ? value as RowRecord[] : [];
}

function readObject(value: unknown): RowRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as RowRecord
    : {};
}

function readBoolean(value: unknown, fallback = false) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
}

function readNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function normalizeColumns(value: unknown): LowCodeColumn[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => readObject(item) as LowCodeColumn);
}

function getColumnField(column: LowCodeColumn) {
  return String(column.field || column.dataIndex || '');
}

function formatCellValue(value: unknown, column: LowCodeColumn) {
  let nextValue = value;

  if (typeof value === 'number' && typeof column.precision === 'number') {
    nextValue = value.toFixed(column.precision);
  }

  return `${column.prefix || ''}${nextValue ?? ''}${column.suffix || ''}`;
}

function resolveActionValue(action: LowCodeCellAction, row: RowRecord, value: unknown) {
  if (action.valueField) {
    return row[action.valueField];
  }

  if (Object.prototype.hasOwnProperty.call(action, 'value')) {
    return action.value;
  }

  return value;
}

function buildGridClassName(node_id: string) {
  return `scada-ag-table-${node_id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function readPagination(props: RowRecord): PaginationConfig {
  const pagination = props.pagination;
  if (typeof pagination === 'boolean') {
    return {
      enabled: pagination,
      pageSize: readNumber(props.pageSize, 20),
      pageSizeOptions: [10, 20, 50, 100],
    };
  }

  const pagination_record = readObject(pagination);
  return {
    enabled: readBoolean(pagination_record.enabled, readBoolean(props.pagination, true)),
    pageSize: readNumber(pagination_record.pageSize ?? props.pageSize, 20),
    pageSizeOptions: Array.isArray(pagination_record.pageSizeOptions)
      ? pagination_record.pageSizeOptions.map((item) => readNumber(item, 20))
      : [10, 20, 50, 100],
  };
}

function readTheme(props: RowRecord, node_id: string): ThemeConfig {
  const theme = readObject(props.theme);
  const style = readObject(props.style);

  return {
    className: `${buildGridClassName(node_id)} ag-theme-quartz scada-ag-grid`,
    striped: readBoolean(theme.striped ?? props.striped, false),
    compact: readBoolean(theme.compact ?? props.compact, true),
    oddRowBackground: readString(
      theme.oddRowBackground ?? props.oddRowBackground,
      '#f6f8fa',
    ),
    evenRowBackground: readString(
      theme.evenRowBackground ?? props.evenRowBackground,
      '#ffffff',
    ),
    hoverRowBackground: readString(
      theme.hoverRowBackground ?? props.hoverRowBackground,
      '#eef6ff',
    ),
    headerBackground: readString(theme.headerBackground, '#f6f8fa'),
    headerColor: readString(theme.headerColor, '#1f2328'),
    textColor: readString(theme.textColor ?? style.color, '#1f2328'),
    borderColor: readString(theme.borderColor ?? style.borderColor, '#d0d7de'),
    background: readString(theme.background ?? style.background, '#ffffff'),
  };
}

function readContainerStyle(style_value: unknown): CSSProperties {
  const style = readObject(style_value);
  const {
    color,
    background,
    borderColor,
    striped,
    rowStriped,
    oddRowBackground,
    evenRowBackground,
    hoverRowBackground,
    headerBackground,
    headerColor,
    ...container_style
  } = style;

  void color;
  void background;
  void borderColor;
  void striped;
  void rowStriped;
  void oddRowBackground;
  void evenRowBackground;
  void hoverRowBackground;
  void headerBackground;
  void headerColor;

  return container_style as CSSProperties;
}

function getRowKey(row: RowRecord, index: number) {
  return String(row.key ?? row.id ?? `row_${index}`);
}

function TagRenderer(params: { value: unknown; colDef: { cellRendererParams?: LowCodeColumn } }) {
  const column = params.colDef.cellRendererParams || {};
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 22,
        padding: '0 8px',
        borderRadius: 6,
        color: column.tagColor || '#0969da',
        background: 'rgba(9, 105, 218, 0.10)',
        border: '1px solid rgba(9, 105, 218, 0.22)',
      }}
    >
      {formatCellValue(params.value, column)}
    </span>
  );
}

function ProgressRenderer(params: { value: unknown }) {
  const value = Math.max(0, Math.min(100, readNumber(params.value, 0)));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: '100%' }}>
      <div
        style={{
          flex: 1,
          height: 8,
          borderRadius: 6,
          background: '#d8dee4',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: '100%',
            background: value >= 80 ? '#d1242f' : '#1f883d',
          }}
        />
      </div>
      <span>{value}%</span>
    </div>
  );
}

function createButtonRenderer(
  column: LowCodeColumn,
  runAction: (action: LowCodeCellAction | undefined, row: RowRecord, value: unknown) => void,
) {
  return function ButtonRenderer(params: { data: RowRecord; value: unknown }) {
    return (
      <button
        type="button"
        style={{
          height: 26,
          padding: '0 10px',
          border: '1px solid #1a7f37',
          borderRadius: 6,
          color: '#ffffff',
          background: '#1f883d',
          cursor: 'pointer',
        }}
        onClick={(event) => {
          event.stopPropagation();
          runAction(column.action, params.data, params.value);
        }}
      >
        {column.buttonText || '操作'}
      </button>
    );
  };
}

function createSwitchRenderer(
  column: LowCodeColumn,
  runAction: (action: LowCodeCellAction | undefined, row: RowRecord, value: unknown) => void,
) {
  return function SwitchRenderer(params: { data: RowRecord; value: unknown }) {
    const checked = readBoolean(params.value);
    return (
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => {
            event.stopPropagation();
            runAction(column.action, params.data, event.target.checked);
          }}
        />
        <span>{checked ? column.trueText || '是' : column.falseText || '否'}</span>
      </label>
    );
  };
}

function buildColumnDefs(
  columns: LowCodeColumn[],
  runAction: (action: LowCodeCellAction | undefined, row: RowRecord, value: unknown) => void,
): ColDef<RowRecord>[] {
  return columns
    .map((column): ColDef<RowRecord> | null => {
      const field = getColumnField(column);
      if (!field) {
        return null;
      }

      const cellType = column.cellType || (column.editable ? 'input' : 'text');
      const colDef: ColDef<RowRecord> = {
        field,
        headerName: String(column.headerName || column.title || field),
        width: column.width,
        minWidth: column.minWidth,
        flex: column.flex,
        pinned: column.pinned,
        sortable: column.sortable !== false,
        filter: column.filter !== false,
        resizable: column.resizable !== false,
        editable: cellType === 'input' || column.editable === true,
        valueFormatter: (params) => formatCellValue(params.value, column),
      };

      if (cellType === 'tag') {
        colDef.cellRenderer = TagRenderer;
        colDef.cellRendererParams = column;
      }

      if (cellType === 'button') {
        colDef.cellRenderer = createButtonRenderer(column, runAction);
        colDef.sortable = false;
        colDef.filter = false;
        colDef.editable = false;
      }

      if (cellType === 'switch') {
        colDef.cellRenderer = createSwitchRenderer(column, runAction);
        colDef.editable = false;
      }

      if (cellType === 'progress') {
        colDef.cellRenderer = ProgressRenderer;
      }

      if (cellType === 'input') {
        colDef.cellEditor = 'agTextCellEditor';
      }

      return colDef;
    })
    .filter(Boolean) as ColDef<RowRecord>[];
}

export default function TableMaterial({
  node,
  interactive,
  onRunScript,
}: MaterialRenderProps) {
  const runtime = usePageRuntime();
  const gridApiRef = useRef<GridApi<RowRecord> | null>(null);
  const [columns, setColumns] = useState(() =>
    normalizeColumns(node.props.columnDefs ?? node.props.columns),
  );
  const [rowData, setRowData] = useState(() =>
    readRows(node.props.rowData ?? node.props.dataSource),
  );
  const pagination = readPagination(node.props);
  const theme = readTheme(node.props, node.id);
  const wrapperStyle = {
    width: '100%',
    height: '100%',
    minHeight: 120,
    ...readContainerStyle(node.props.style),
    '--ag-background-color': theme.background,
    '--ag-foreground-color': theme.textColor,
    '--ag-header-background-color': theme.headerBackground,
    '--ag-header-foreground-color': theme.headerColor,
    '--ag-border-color': theme.borderColor,
    '--ag-odd-row-background-color': theme.striped
      ? theme.oddRowBackground
      : theme.background,
    '--ag-row-hover-color': theme.hoverRowBackground,
    '--ag-font-size': theme.compact ? '13px' : '14px',
    '--ag-row-height': theme.compact ? '34px' : '42px',
    '--ag-header-height': theme.compact ? '36px' : '42px',
  } as CSSProperties;

  const runAction = (action: LowCodeCellAction | undefined, row: RowRecord, value: unknown) => {
    if (!interactive) {
      return;
    }

    if (!action || action.type === 'script') {
      onRunScript?.(node.scripts.onClick, node);
      return;
    }

    if (action.type === 'setPageVar' && action.variableName) {
      runtime?.setVar(
        action.variableName,
        resolveActionValue(action, row, value),
        {
          source: 'component_script',
          reason: action.reason || 'table_cell_action',
        },
      );
      return;
    }

    if (action.type === 'callComponent' && action.component && action.method) {
      runtime?.callComponent(
        action.component,
        action.method,
        ...(action.args || []),
      );
    }
  };

  const columnDefs = useMemo(
    () => buildColumnDefs(columns, runAction),
    [columns, interactive, node.scripts.onClick, runtime],
  );

  useEffect(() => {
    setColumns(normalizeColumns(node.props.columnDefs ?? node.props.columns));
    setRowData(readRows(node.props.rowData ?? node.props.dataSource));
  }, [node.props.columnDefs, node.props.columns, node.props.rowData, node.props.dataSource]);

  useEffect(() => {
    return runtime?.registerComponent(node.id, {
      setColumns: (nextColumns) => setColumns(normalizeColumns(nextColumns)),
      setColumnDefs: (nextColumns) => setColumns(normalizeColumns(nextColumns)),
      setDataSource: (nextRows) => setRowData(readRows(nextRows)),
      setRows: (nextRows) => setRowData(readRows(nextRows)),
      setRowData: (nextRows) => setRowData(readRows(nextRows)),
      appendRow: (row) => setRowData((currentRows) => [
        ...currentRows,
        readObject(row),
      ]),
      updateRow: (key, patch) => setRowData((currentRows) =>
        currentRows.map((row, index) => (
          getRowKey(row, index) === String(key)
            ? { ...row, ...readObject(patch) }
            : row
        )),
      ),
      deleteRow: (key) => setRowData((currentRows) =>
        currentRows.filter((row, index) => getRowKey(row, index) !== String(key)),
      ),
      clearRows: () => setRowData([]),
      refresh: () => gridApiRef.current?.refreshCells({ force: true }),
      setPage: (page) => gridApiRef.current?.paginationGoToPage(readNumber(page, 0)),
      autoSizeColumns: () => gridApiRef.current?.autoSizeAllColumns(),
    }, [node.name]);
  }, [runtime, node.id, node.name]);

  const handleGridReady = (event: GridReadyEvent<RowRecord>) => {
    gridApiRef.current = event.api;
  };

  const handleCellValueChanged = (event: CellValueChangedEvent<RowRecord>) => {
    const rowKey = getRowKey(event.data || {}, event.rowIndex || 0);
    setRowData((currentRows) =>
      currentRows.map((row, index) => (
        getRowKey(row, index) === rowKey
          ? { ...row, ...event.data }
          : row
      )),
    );
  };

  return (
    <div className={theme.className} style={wrapperStyle}>
      <AgGridReact<RowRecord>
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={{
          minWidth: 80,
          resizable: true,
          sortable: true,
          filter: true,
        }}
        pagination={pagination.enabled}
        paginationPageSize={pagination.pageSize}
        paginationPageSizeSelector={pagination.pageSizeOptions}
        rowSelection={String(node.props.rowSelection || 'single') as 'single' | 'multiple'}
        animateRows={false}
        suppressCellFocus={!interactive}
        getRowId={(params) => getRowKey(params.data, readNumber(params.level, 0))}
        onGridReady={handleGridReady}
        onCellValueChanged={handleCellValueChanged}
      />
    </div>
  );
}
