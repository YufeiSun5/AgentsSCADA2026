package com.scada.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.scada.common.exception.BizException;
import com.scada.common.exception.ErrorCode;
import com.scada.domain.entity.SysAsset;
import com.scada.mapper.SysAssetMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * 资产文件管理服务。
 * 元数据存 sys_assets 表，文件存本地磁盘。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AssetService {

    private final SysAssetMapper assetMapper;

    @Value("${scada.storage.path:./storage}")
    private String storagePath;

    /** 允许上传的文件扩展名白名单 */
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "png", "jpg", "jpeg", "gif", "webp", "svg",
            "js", "css", "json",
            "woff", "woff2", "ttf", "eot"
    );

    /** 单文件大小上限：20MB */
    private static final long MAX_FILE_SIZE = 20 * 1024 * 1024;

    /**
     * 上传资产文件。
     */
    public SysAsset upload(MultipartFile file, Long pageId, String scope) {
        // 校验文件非空
        if (file.isEmpty()) {
            throw new BizException(ErrorCode.PARAM_INVALID);
        }

        // 校验文件大小
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BizException(ErrorCode.ASSET_TOO_LARGE);
        }

        // 校验文件类型
        String originalName = file.getOriginalFilename();
        String extension = extractExtension(originalName);
        if (!ALLOWED_EXTENSIONS.contains(extension.toLowerCase())) {
            throw new BizException(ErrorCode.ASSET_TYPE_DENIED);
        }

        // 生成存储路径: {year}/{month}/{uuid}.{ext}
        LocalDate now = LocalDate.now();
        String relativePath = String.format("%d/%02d/%s.%s",
                now.getYear(), now.getMonthValue(),
                UUID.randomUUID().toString().replace("-", ""),
                extension);

        Path absolutePath = Paths.get(storagePath, "assets", relativePath);

        // 创建目录并写入文件
        try {
            Files.createDirectories(absolutePath.getParent());
            file.transferTo(absolutePath.toFile());
        } catch (IOException e) {
            log.error("资产文件存储失败: {}", absolutePath, e);
            throw new BizException(ErrorCode.ASSET_STORAGE_ERROR);
        }

        // 保存元数据
        SysAsset asset = new SysAsset();
        asset.setName(originalName);
        asset.setAssetType(resolveAssetType(extension));
        asset.setMimeType(resolveMimeType(extension));
        asset.setFilePath(relativePath);
        asset.setFileSize(file.getSize());
        asset.setPageId(pageId);
        asset.setScope(scope != null ? scope : "page");
        // createdBy 后续接入 SecurityContext 后自动填入
        assetMapper.insert(asset);

        return asset;
    }

    /**
     * 获取资产文件的 Resource（用于下载/响应）。
     */
    public Resource getFileResource(Long assetId) {
        SysAsset asset = assetMapper.selectById(assetId);
        if (asset == null) {
            throw new BizException(ErrorCode.ASSET_NOT_FOUND);
        }

        Path absolutePath = Paths.get(storagePath, "assets", asset.getFilePath());
        try {
            Resource resource = new UrlResource(absolutePath.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new BizException(ErrorCode.ASSET_NOT_FOUND);
            }
            return resource;
        } catch (MalformedURLException e) {
            throw new BizException(ErrorCode.ASSET_STORAGE_ERROR);
        }
    }

    /**
     * 获取资产元数据。
     */
    public SysAsset getById(Long assetId) {
        SysAsset asset = assetMapper.selectById(assetId);
        if (asset == null) {
            throw new BizException(ErrorCode.ASSET_NOT_FOUND);
        }
        return asset;
    }

    /**
     * 查询资产列表（按页面 ID 和/或作用域过滤）。
     */
    public List<SysAsset> listAssets(Long pageId, String scope) {
        LambdaQueryWrapper<SysAsset> wrapper = new LambdaQueryWrapper<>();
        if (pageId != null) {
            wrapper.eq(SysAsset::getPageId, pageId);
        }
        if (scope != null && !scope.isBlank()) {
            wrapper.eq(SysAsset::getScope, scope);
        }
        wrapper.orderByDesc(SysAsset::getCreatedAt);
        return assetMapper.selectList(wrapper);
    }

    /**
     * 逻辑删除资产记录。
     */
    public void deleteAsset(Long assetId) {
        SysAsset asset = assetMapper.selectById(assetId);
        if (asset == null) {
            throw new BizException(ErrorCode.ASSET_NOT_FOUND);
        }
        assetMapper.deleteById(assetId);
    }

    // --- 工具方法 ---

    private String extractExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "";
        }
        return filename.substring(filename.lastIndexOf('.') + 1);
    }

    private String resolveAssetType(String ext) {
        return switch (ext.toLowerCase()) {
            case "png", "jpg", "jpeg", "gif", "webp", "svg" -> "image";
            case "js" -> "javascript";
            case "css" -> "stylesheet";
            case "woff", "woff2", "ttf", "eot" -> "font";
            default -> "other";
        };
    }

    private String resolveMimeType(String ext) {
        return switch (ext.toLowerCase()) {
            case "png"   -> "image/png";
            case "jpg", "jpeg" -> "image/jpeg";
            case "gif"   -> "image/gif";
            case "webp"  -> "image/webp";
            case "svg"   -> "image/svg+xml";
            case "js"    -> "application/javascript";
            case "css"   -> "text/css";
            case "json"  -> "application/json";
            case "woff"  -> "font/woff";
            case "woff2" -> "font/woff2";
            case "ttf"   -> "font/ttf";
            case "eot"   -> "application/vnd.ms-fontobject";
            default      -> "application/octet-stream";
        };
    }
}
