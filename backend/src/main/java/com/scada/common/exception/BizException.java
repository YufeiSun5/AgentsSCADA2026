package com.scada.common.exception;

import lombok.Getter;

/**
 * 业务异常。
 * 明确的业务错误（如参数非法、资源不存在）时抛出，
 * GlobalExceptionHandler 会将其转换为 R.fail 返回，不打印 stack trace。
 */
@Getter
public class BizException extends RuntimeException {

    private final int code;

    public BizException(int code, String msg) {
        super(msg);
        this.code = code;
    }

    /** 使用 ErrorCode 枚举 */
    public BizException(ErrorCode errorCode) {
        super(errorCode.getMsg());
        this.code = errorCode.getCode();
    }

    /** 使用 ErrorCode + 自定义消息（覆盖枚举默认消息） */
    public BizException(ErrorCode errorCode, String detailMsg) {
        super(detailMsg);
        this.code = errorCode.getCode();
    }
}
