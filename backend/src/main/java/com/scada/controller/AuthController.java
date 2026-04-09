package com.scada.controller;

import com.scada.common.exception.BizException;
import com.scada.common.exception.ErrorCode;
import com.scada.common.result.R;
import com.scada.domain.entity.SysUser;
import com.scada.mapper.SysUserMapper;
import com.scada.security.JwtUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 认证接口：登录获取 JWT Token。
 * 路径：POST /api/auth/login
 */
@RestController
@RequestMapping("/auth")          // context-path=/api，完整路径 /api/auth/login
@RequiredArgsConstructor
public class AuthController {

    private final SysUserMapper   userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils        jwtUtils;

    @PostMapping("/login")
    public R<Map<String, Object>> login(@Valid @RequestBody LoginRequest req) {
        // 根据用户名查询（逻辑删除自动过滤）
        SysUser user = userMapper.selectOne(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<SysUser>()
                        .eq(SysUser::getUsername, req.getUsername())
        );

        if (user == null || !user.getEnabled()) {
            throw new BizException(ErrorCode.PASSWORD_ERROR);
        }

        if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            throw new BizException(ErrorCode.PASSWORD_ERROR);
        }

        // TODO: 查询用户角色列表，暂时使用空列表
        List<String> roles = List.of();

        String token = jwtUtils.generateToken(user.getId(), user.getUsername(), roles);

        return R.ok(Map.of(
                "token",       token,
                "userId",      user.getId(),
                "username",    user.getUsername(),
                "displayName", user.getDisplayName() != null ? user.getDisplayName() : ""
        ));
    }

    @Data
    public static class LoginRequest {
        @NotBlank(message = "用户名不能为空")
        private String username;

        @NotBlank(message = "密码不能为空")
        private String password;
    }
}
