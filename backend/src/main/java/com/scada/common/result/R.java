package com.scada.common.result;

import lombok.Getter;

/**
 * 统一 REST 返回值。
 * 成功：R.ok(data)  失败：R.fail(code, msg)
 */
@Getter
public class R<T> {

    /** 业务状态码：200 = 成功，其余见 ErrorCode */
    private final int code;

    /** 提示信息 */
    private final String msg;

    /** 响应数据 */
    private final T data;

    private R(int code, String msg, T data) {
        this.code = code;
        this.msg  = msg;
        this.data = data;
    }

    /** 成功，无数据 */
    public static R<Void> ok() {
        return new R<>(200, "success", null);
    }

    /** 成功，携带数据 */
    public static <T> R<T> ok(T data) {
        return new R<>(200, "success", data);
    }

    /** 失败，指定业务码和消息 */
    public static <T> R<T> fail(int code, String msg) {
        return new R<>(code, msg, null);
    }

    /** 判断当前结果是否成功 */
    public boolean isSuccess() {
        return this.code == 200;
    }
}
