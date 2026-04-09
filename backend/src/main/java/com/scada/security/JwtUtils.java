package com.scada.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.Map;

/**
 * JWT 工具类。
 * 生成和验证 JWT Token，密钥来自配置文件。
 */
@Slf4j
@Component
public class JwtUtils {

    /** JWT 签名密钥，生产环境必须是 32 字符以上的随机字符串 */
    @Value("${scada.jwt.secret}")
    private String jwtSecret;

    /** Token 有效期（小时），默认 24 小时 */
    @Value("${scada.jwt.expire-hours:24}")
    private long jwtExpireHours;

    /** 生成 JWT Token */
    public String generateToken(Long userId, String username, List<String> roles) {
        return Jwts.builder()
                .subject(username)
                .claims(Map.of("userId", userId, "roles", roles))
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + jwtExpireHours * 3600_000L))
                .signWith(getKey())
                .compact();
    }

    /** 解析并验证 JWT Token，失败抛 JwtException */
    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(getKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private SecretKey getKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }
}
