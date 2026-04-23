package com.scada.controller;

import com.scada.common.result.R;
import com.scada.domain.entity.SysAsset;
import com.scada.service.AssetService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * 资产文件管理接口。
 * 支持图片、JS 库、CSS 等文件的上传、下载、列表和删除。
 */
@RestController
@RequestMapping("/assets")
@RequiredArgsConstructor
public class AssetController {

    private final AssetService assetService;

    /**
     * 上传资产文件。
     * POST /api/assets/upload
     */
    @PostMapping("/upload")
    public R<SysAsset> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "pageId", required = false) Long pageId,
            @RequestParam(value = "scope", defaultValue = "page") String scope
    ) {
        SysAsset asset = assetService.upload(file, pageId, scope);
        return R.ok(asset);
    }

    /**
     * 获取资产文件内容（用于 iframe 内加载图片、JS、CSS 等）。
     * GET /api/assets/{id}/file
     * 设置长时间缓存头，减少重复请求。
     */
    @GetMapping("/{id}/file")
    public ResponseEntity<Resource> getFile(@PathVariable Long id) {
        SysAsset asset = assetService.getById(id);
        Resource resource = assetService.getFileResource(id);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(asset.getMimeType()))
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=31536000, immutable")
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + asset.getName() + "\"")
                .body(resource);
    }

    /**
     * 查询资产列表（支持按页面 ID 和作用域过滤）。
     * GET /api/assets?pageId=1&scope=page
     */
    @GetMapping
    public R<List<SysAsset>> list(
            @RequestParam(value = "pageId", required = false) Long pageId,
            @RequestParam(value = "scope", required = false) String scope
    ) {
        List<SysAsset> assets = assetService.listAssets(pageId, scope);
        return R.ok(assets);
    }

    /**
     * 删除资产文件（逻辑删除）。
     * DELETE /api/assets/{id}
     */
    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable Long id) {
        assetService.deleteAsset(id);
        return R.ok();
    }
}
