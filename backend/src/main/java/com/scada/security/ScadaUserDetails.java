package com.scada.security;

import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

/**
 * 安全上下文中的当前用户信息。
 * 解析 JWT 后注入 SecurityContext，业务层通过 @AuthenticationPrincipal 获取。
 */
@Getter
public class ScadaUserDetails implements UserDetails {

    private final Long   userId;
    private final String username;
    private final List<? extends GrantedAuthority> authorities;

    public ScadaUserDetails(Long userId, String username,
                            List<? extends GrantedAuthority> authorities) {
        this.userId      = userId;
        this.username    = username;
        this.authorities = authorities;
    }

    @Override
    @SuppressWarnings("unchecked")
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return (Collection<GrantedAuthority>) authorities;
    }

    // JWT 无状态模式下不需要密码和账户状态
    @Override public String  getPassword()             { return null; }
    @Override public boolean isAccountNonExpired()     { return true; }
    @Override public boolean isAccountNonLocked()      { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled()               { return true; }
}
