package com.scada.common.result;

import lombok.Getter;

import java.util.List;

/**
 * 分页查询统一返回结构。
 * 与 MyBatis-Plus Page 对象配套使用。
 */
@Getter
public class PageResult<T> {

    /** 当前页码（从 1 开始） */
    private final long current;

    /** 每页大小 */
    private final long size;

    /** 总记录数 */
    private final long total;

    /** 当前页数据 */
    private final List<T> records;

    private PageResult(long current, long size, long total, List<T> records) {
        this.current = current;
        this.size    = size;
        this.total   = total;
        this.records = records;
    }

    /** 从 MyBatis-Plus IPage 转换 */
    public static <T> PageResult<T> of(com.baomidou.mybatisplus.core.metadata.IPage<T> page) {
        return new PageResult<>(page.getCurrent(), page.getSize(), page.getTotal(), page.getRecords());
    }

    /** 手动构造（非 MP 查询时使用） */
    public static <T> PageResult<T> of(long current, long size, long total, List<T> records) {
        return new PageResult<>(current, size, total, records);
    }
}
