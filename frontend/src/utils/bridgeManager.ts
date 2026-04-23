/**
 * BridgeManager：父窗口侧的 postMessage 路由管理器。
 * 监听 iframe 中 ScadaBridge SDK 的请求消息，路由到对应处理器。
 * 当前通过 realtimeService 使用 Mock 适配器，后续可无缝替换为 WebSocket。
 */

import { realtimeService } from '../services/realtimeService';
import type { PageRuntime } from '../runtime/pageRuntime';

interface BridgeRequest {
  type: string;
  requestId: number;
  action: string;
  payload: Record<string, unknown>;
}

export class BridgeManager {
  private iframe: HTMLIFrameElement | null = null;
  private subscriptions = new Map<string, Set<string>>(); // tagName -> iframeId set
  private unsubscribeMap = new Map<string, () => void>();
  private variableUnsubscribeMap = new Map<string, () => void>();
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private iframeId: string;
  private runtime: PageRuntime | null;

  constructor(iframeId: string, runtime: PageRuntime | null = null) {
    this.iframeId = iframeId;
    this.runtime = runtime;
  }

  /** 绑定 iframe 元素并开始监听消息 */
  attach(iframe: HTMLIFrameElement) {
    this.iframe = iframe;
    this.messageHandler = this.handleMessage.bind(this);
    window.addEventListener('message', this.messageHandler);
  }

  /** 清理所有监听器和定时器 */
  destroy() {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
    this.unsubscribeMap.forEach((unsubscribe) => unsubscribe());
    this.unsubscribeMap.clear();
    this.variableUnsubscribeMap.forEach((unsubscribe) => unsubscribe());
    this.variableUnsubscribeMap.clear();
    this.subscriptions.clear();
    this.iframe = null;
  }

  /** 发送就绪信号到 iframe */
  sendReady() {
    this.postToIframe({ type: 'scada-bridge-ready' });
  }

  private handleMessage(event: MessageEvent) {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    // iframe SDK 加载完毕
    if (data.type === 'scada-bridge-loaded') {
      // 确认消息来自绑定的 iframe
      if (event.source === this.iframe?.contentWindow) {
        this.sendReady();
      }
      return;
    }

    // 处理 SDK 请求
    if (data.type === 'scada-bridge-request' && event.source === this.iframe?.contentWindow) {
      this.handleRequest(data as BridgeRequest);
    }
  }

  private async handleRequest(req: BridgeRequest) {
    const { requestId, action, payload } = req;
    try {
      let result: unknown;
      switch (action) {
        case 'readTag':
          result = await this.handleReadTag(payload.tagName as string);
          break;
        case 'writeTag':
          result = await this.handleWriteTag(payload.tagName as string, payload.value);
          break;
        case 'subscribe':
          result = this.handleSubscribe(payload.tagName as string);
          break;
        case 'unsubscribe':
          result = this.handleUnsubscribe(payload.tagName as string);
          break;
        case 'readVar':
          result = this.handleReadVar(payload.name as string);
          break;
        case 'writeVar':
          result = this.handleWriteVar(payload.name as string, payload.value);
          break;
        case 'subscribeVar':
          result = this.handleSubscribeVar(payload.name as string);
          break;
        case 'unsubscribeVar':
          result = this.handleUnsubscribeVar(payload.name as string);
          break;
        case 'callComponent':
          result = await this.handleCallComponent(
            payload.componentIdOrName as string,
            payload.methodName as string,
            (payload.args as unknown[]) || [],
          );
          break;
        case 'query':
          result = await this.handleQuery(payload.sql as string, payload.params as unknown[]);
          break;
        default:
          throw new Error(`未知操作: ${action}`);
      }
      this.postToIframe({
        type: 'scada-bridge-response',
        requestId,
        result,
      });
    } catch (error) {
      this.postToIframe({
        type: 'scada-bridge-response',
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // --- 各 action 处理器 ---

  private async handleReadTag(tagName: string) {
    const point = await realtimeService.readTag(tagName);
    return {
      value: point.value,
      timestamp: point.ts,
      unit: point.unit,
      quality: point.quality,
    };
  }

  private async handleWriteTag(tagName: string, value: unknown) {
    return realtimeService.writeTag(tagName, value);
  }

  private handleSubscribe(tagName: string) {
    if (!this.subscriptions.has(tagName)) {
      this.subscriptions.set(tagName, new Set());
    }
    this.subscriptions.get(tagName)!.add(this.iframeId);

    if (!this.unsubscribeMap.has(tagName)) {
      const unsubscribe = realtimeService.subscribeTag(tagName, (point) => {
        this.postToIframe({
          type: 'scada-bridge-push',
          tagName,
          data: {
            value: point.value,
            timestamp: point.ts,
            unit: point.unit,
            quality: point.quality,
          },
        });
      });
      this.unsubscribeMap.set(tagName, unsubscribe);
    }

    return { subscribed: true };
  }

  private handleUnsubscribe(tagName: string) {
    const subs = this.subscriptions.get(tagName);
    if (subs) {
      subs.delete(this.iframeId);
      if (subs.size === 0) {
        this.subscriptions.delete(tagName);
        this.unsubscribeMap.get(tagName)?.();
        this.unsubscribeMap.delete(tagName);
      }
    }
    return { unsubscribed: true };
  }

  private handleReadVar(name: string) {
    const variable = this.runtime?.getVar(name);
    if (!variable) {
      return null;
    }

    return variable;
  }

  private handleWriteVar(name: string, value: unknown) {
    const variable = this.runtime?.setVar(name, value, { source: 'html_bridge' });

    if (!variable) {
      return {
        success: false,
        message: '页面运行时变量不存在或运行时未就绪',
      };
    }

    return {
      success: true,
      message: '页面变量已写入',
      variable,
    };
  }

  private handleSubscribeVar(name: string) {
    if (!this.runtime) {
      return {
        subscribed: false,
        message: '页面运行时未就绪',
      };
    }

    if (!this.variableUnsubscribeMap.has(name)) {
      const unsubscribe = this.runtime.subscribeVar(name, (variable, change) => {
        this.postToIframe({
          type: 'scada-bridge-var-push',
          name,
          data: variable,
          change,
        });
      });
      this.variableUnsubscribeMap.set(name, unsubscribe);
    }

    return { subscribed: true };
  }

  private handleUnsubscribeVar(name: string) {
    this.variableUnsubscribeMap.get(name)?.();
    this.variableUnsubscribeMap.delete(name);
    return { unsubscribed: true };
  }

  private async handleCallComponent(
    componentIdOrName: string,
    methodName: string,
    args: unknown[],
  ) {
    return this.runtime?.callComponent(componentIdOrName, methodName, ...args);
  }

  private async handleQuery(_sql: string, _params: unknown[]) {
    // Mock：返回静态示例数据。未来调用后端只读查询 API
    return [
      { tag: 'A-101', value: 48.1, time: '2026-04-14 08:00:00' },
      { tag: 'A-102', value: 49.7, time: '2026-04-14 08:00:00' },
    ];
  }

  private postToIframe(data: Record<string, unknown>) {
    try {
      this.iframe?.contentWindow?.postMessage(data, '*');
    } catch {
      // iframe 可能已卸载，忽略
    }
  }
}
