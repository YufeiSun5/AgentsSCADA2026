/**
 * ScadaBridge SDK 源码字符串。
 * 组装 iframe srcdoc 时注入，为用户 JS 代码提供实时变量访问与资产引用能力。
 * 通过 postMessage 与父窗口 BridgeManager 通信。
 */

export const SCADA_BRIDGE_SDK_SOURCE = `
(function () {
  'use strict';

  var _requestId = 0;
  var _pending = {};       // requestId -> { resolve, reject }
  var _subscriptions = {}; // tagName -> [{ id, callback }]
  var _varSubscriptions = {}; // variableName -> [{ id, callback }]
  var _readyCallbacks = [];
  var _ready = false;

  function genId() {
    return ++_requestId;
  }

  // 向父窗口发送请求
  function sendRequest(action, payload) {
    return new Promise(function (resolve, reject) {
      var id = genId();
      _pending[id] = { resolve: resolve, reject: reject };
      window.parent.postMessage({
        type: 'scada-bridge-request',
        requestId: id,
        action: action,
        payload: payload || {}
      }, '*');
      // 超时保护 30s
      setTimeout(function () {
        if (_pending[id]) {
          _pending[id].reject(new Error('ScadaBridge: 请求超时 (' + action + ')'));
          delete _pending[id];
        }
      }, 30000);
    });
  }

  // 监听父窗口响应
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;

    // 响应：匹配 requestId
    if (data.type === 'scada-bridge-response' && data.requestId) {
      var handler = _pending[data.requestId];
      if (handler) {
        delete _pending[data.requestId];
        if (data.error) {
          handler.reject(new Error(data.error));
        } else {
          handler.resolve(data.result);
        }
      }
    }

    // 推送：变量值变化
    if (data.type === 'scada-bridge-push' && data.tagName) {
      var subs = _subscriptions[data.tagName];
      if (subs) {
        for (var i = 0; i < subs.length; i++) {
          try { subs[i].callback(data.data); } catch (e) { console.error('[ScadaBridge] 订阅回调异常:', e); }
        }
      }
    }

    // 推送：页面运行时变量变化
    if (data.type === 'scada-bridge-var-push' && data.name) {
      var varSubs = _varSubscriptions[data.name];
      if (varSubs) {
        for (var k = 0; k < varSubs.length; k++) {
          try { varSubs[k].callback(data.data, data.change); } catch (e) { console.error('[ScadaBridge] 页面变量订阅回调异常:', e); }
        }
      }
    }

    // 就绪信号
    if (data.type === 'scada-bridge-ready') {
      _ready = true;
      for (var j = 0; j < _readyCallbacks.length; j++) {
        try { _readyCallbacks[j](); } catch (e) { console.error('[ScadaBridge] onReady 回调异常:', e); }
      }
      _readyCallbacks = [];
    }
  });

  var _subIdCounter = 0;

  window.ScadaBridge = {
    /** SDK 是否就绪 */
    get ready() { return _ready; },

    /** 注册就绪回调。若已就绪则立即执行。 */
    onReady: function (callback) {
      if (_ready) {
        try { callback(); } catch (e) { console.error('[ScadaBridge] onReady 回调异常:', e); }
      } else {
        _readyCallbacks.push(callback);
      }
    },

    /** 读取变量值 */
    readTag: function (tagName) {
      return sendRequest('readTag', { tagName: tagName });
    },

    /** 写入变量值 */
    writeTag: function (tagName, value) {
      return sendRequest('writeTag', { tagName: tagName, value: value });
    },

    /** 读取当前页面运行时变量，返回完整变量对象。 */
    readVar: function (name) {
      return sendRequest('readVar', { name: name });
    },

    /** 写入当前页面运行时变量。 */
    writeVar: function (name, value) {
      return sendRequest('writeVar', { name: name, value: value });
    },

    /** 订阅变量变化，返回取消订阅函数 */
    subscribe: function (tagName, callback) {
      if (!_subscriptions[tagName]) {
        _subscriptions[tagName] = [];
        // 通知父窗口注册订阅
        sendRequest('subscribe', { tagName: tagName }).catch(function () {});
      }
      var subId = ++_subIdCounter;
      _subscriptions[tagName].push({ id: subId, callback: callback });

      return function unsubscribe() {
        var subs = _subscriptions[tagName];
        if (subs) {
          _subscriptions[tagName] = subs.filter(function (s) { return s.id !== subId; });
          if (_subscriptions[tagName].length === 0) {
            delete _subscriptions[tagName];
            sendRequest('unsubscribe', { tagName: tagName }).catch(function () {});
          }
        }
      };
    },

    /** 订阅当前页面运行时变量变化，callback 接收完整变量对象和 change。 */
    subscribeVar: function (name, callback) {
      if (!_varSubscriptions[name]) {
        _varSubscriptions[name] = [];
        sendRequest('subscribeVar', { name: name }).catch(function () {});
      }
      var subId = ++_subIdCounter;
      _varSubscriptions[name].push({ id: subId, callback: callback });

      return function unsubscribe() {
        var subs = _varSubscriptions[name];
        if (subs) {
          _varSubscriptions[name] = subs.filter(function (s) { return s.id !== subId; });
          if (_varSubscriptions[name].length === 0) {
            delete _varSubscriptions[name];
            sendRequest('unsubscribeVar', { name: name }).catch(function () {});
          }
        }
      };
    },

    /** 调用当前页面内其他组件注册的方法。 */
    callComponent: function (componentIdOrName, methodName) {
      var args = Array.prototype.slice.call(arguments, 2);
      return sendRequest('callComponent', {
        componentIdOrName: componentIdOrName,
        methodName: methodName,
        args: args
      });
    },

    /** 将变量值快捷绑定到文本节点 */
    bindText: function (selector, tagName, options) {
      var el = document.querySelector(selector);
      var opts = options || {};
      var fallback = opts.fallback || '--';

      if (!el) {
        console.warn('[ScadaBridge] bindText 未找到元素:', selector);
        return function () {};
      }

      function format(data) {
        if (!data || data.value === null || typeof data.value === 'undefined') {
          return fallback;
        }

        var value = data.value;
        if (typeof value === 'number' && typeof opts.precision === 'number') {
          value = value.toFixed(opts.precision);
        }

        return String(opts.template || '{value} {unit}')
          .split('{value}').join(String(value))
          .split('{unit}').join(data.unit || '')
          .split('{tag}').join(tagName)
          .split('{quality}').join(data.quality || '');
      }

      function render(data) {
        el.textContent = format(data);
      }

      window.ScadaBridge.readTag(tagName)
        .then(render)
        .catch(function () { el.textContent = fallback; });

      return window.ScadaBridge.subscribe(tagName, render);
    },

    /** 将页面运行时变量快捷绑定到 iframe 内文本节点。 */
    bindVarText: function (selector, name, options) {
      var el = document.querySelector(selector);
      var opts = options || {};
      var fallback = opts.fallback || '--';

      if (!el) {
        console.warn('[ScadaBridge] bindVarText 未找到元素:', selector);
        return function () {};
      }

      function format(variable) {
        if (!variable || variable.value === null || typeof variable.value === 'undefined') {
          return fallback;
        }

        var value = variable.value;
        if (typeof value === 'number' && typeof opts.precision === 'number') {
          value = value.toFixed(opts.precision);
        }

        return String(opts.template || '{value} {unit}')
          .split('{value}').join(String(value))
          .split('{unit}').join(variable.unit || '')
          .split('{name}').join(variable.name || name)
          .split('{key}').join(variable.key || name)
          .split('{quality}').join(variable.quality || '')
          .split('{previousValue}').join(String(variable.previousValue || ''));
      }

      function render(variable) {
        el.textContent = format(variable);
      }

      window.ScadaBridge.readVar(name)
        .then(render)
        .catch(function () { el.textContent = fallback; });

      return window.ScadaBridge.subscribeVar(name, render);
    },

    /** 点击元素后弹窗输入并写入变量 */
    bindWriteDialog: function (selector, tagName, options) {
      var el = document.querySelector(selector);
      var opts = options || {};

      if (!el) {
        console.warn('[ScadaBridge] bindWriteDialog 未找到元素:', selector);
        return function () {};
      }

      function parseValue(raw) {
        if (opts.type === 'number') {
          return Number(raw);
        }
        if (opts.type === 'boolean') {
          return raw === 'true' || raw === '1';
        }
        return raw;
      }

      function onClick() {
        var raw = window.prompt(opts.title || '请输入回写值', opts.defaultValue || '');
        if (raw === null) return;

        var value = parseValue(raw);
        window.ScadaBridge.writeTag(tagName, value)
          .then(function (result) {
            if (result && result.success === false) {
              window.alert(result.message || '写入失败');
              return;
            }
            if (opts.successMessage !== false) {
              window.alert(opts.successMessage || '写入成功');
            }
          })
          .catch(function (error) {
            window.alert(error && error.message ? error.message : '写入失败');
          });
      }

      el.addEventListener('click', onClick);

      return function () {
        el.removeEventListener('click', onClick);
      };
    },

    /** 点击元素后弹窗输入，并写入页面运行时变量。 */
    bindVarWriteDialog: function (selector, name, options) {
      var el = document.querySelector(selector);
      var opts = options || {};

      if (!el) {
        console.warn('[ScadaBridge] bindVarWriteDialog 未找到元素:', selector);
        return function () {};
      }

      function parseValue(raw) {
        if (opts.type === 'number') {
          return Number(raw);
        }
        if (opts.type === 'boolean') {
          return raw === 'true' || raw === '1';
        }
        if (opts.type === 'json') {
          try { return JSON.parse(raw); } catch (e) { return raw; }
        }
        return raw;
      }

      function onClick() {
        var raw = window.prompt(opts.title || '请输入页面变量值', opts.defaultValue || '');
        if (raw === null) return;

        window.ScadaBridge.writeVar(name, parseValue(raw))
          .then(function (result) {
            if (result && result.success === false) {
              window.alert(result.message || '写入失败');
              return;
            }
            if (opts.successMessage !== false) {
              window.alert(opts.successMessage || '写入成功');
            }
          })
          .catch(function (error) {
            window.alert(error && error.message ? error.message : '写入失败');
          });
      }

      el.addEventListener('click', onClick);

      return function () {
        el.removeEventListener('click', onClick);
      };
    },

    /** 执行只读数据库查询 */
    query: function (sql, params) {
      return sendRequest('query', { sql: sql, params: params || [] });
    },

    /** 获取资产访问 URL */
    assetUrl: function (assetId) {
      return '/api/assets/' + assetId + '/file';
    }
  };

  // 通知父窗口 SDK 已加载，请求就绪信号
  window.parent.postMessage({ type: 'scada-bridge-loaded' }, '*');
})();
`;
