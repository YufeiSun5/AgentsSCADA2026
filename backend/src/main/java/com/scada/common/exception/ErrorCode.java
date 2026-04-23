package com.scada.common.exception;

import lombok.Getter;

/**
 * 业务错误码枚举。
 * 4xx 客户端错误，5xx 服务端错误，具体 6xx+ 为业务码。
 */
@Getter
public enum ErrorCode {

    // ===== 通用 =====
    PARAM_INVALID       (400, "请求参数不合法"),
    UNAUTHORIZED        (401, "未登录或登录已过期"),
    FORBIDDEN           (403, "无权限执行此操作"),
    NOT_FOUND           (404, "资源不存在"),
    CONFLICT            (409, "数据冲突，请刷新后重试"),
    SERVER_ERROR        (500, "服务器内部错误"),

    // ===== 用户 =====
    USER_NOT_FOUND      (1001, "用户不存在"),
    USER_DISABLED       (1002, "账户已被禁用"),
    PASSWORD_ERROR      (1003, "用户名或密码错误"),
    USERNAME_EXISTS     (1004, "用户名已存在"),

    // ===== 页面 =====
    PAGE_NOT_FOUND      (2001, "页面不存在"),
    PAGE_LOCKED         (2002, "页面正被他人编辑"),
    PAGE_VERSION_CONFLICT(2003, "页面版本冲突，请刷新内容后重试"),
    PAGE_KEY_EXISTS     (2004, "页面标识已存在"),

    // ===== 网关 / 变量 =====
    GATEWAY_NOT_FOUND   (3001, "网关不存在"),
    VARIABLE_NOT_FOUND  (3002, "变量不存在"),
    VARIABLE_READONLY   (3003, "变量为只读，不允许回写"),

    // ===== AI 服务 =====
    AI_PROVIDER_DISABLED(4001, "AI 服务不可用"),
    AI_RATE_LIMITED     (4002, "AI 服务繁忙，请稍后再试"),
    AI_UPSTREAM_ERROR   (4003, "上游 AI 接口调用失败"),

    // ===== 资产管理 =====
    ASSET_NOT_FOUND     (5001, "资产文件不存在"),
    ASSET_TYPE_DENIED   (5002, "不允许的文件类型"),
    ASSET_TOO_LARGE     (5003, "文件大小超出限制"),
    ASSET_STORAGE_ERROR (5004, "文件存储失败");

    private final int    code;
    private final String msg;

    ErrorCode(int code, String msg) {
        this.code = code;
        this.msg  = msg;
    }
}
