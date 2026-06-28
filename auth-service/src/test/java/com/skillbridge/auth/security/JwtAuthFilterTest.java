package com.skillbridge.auth.security;

import com.skillbridge.auth.entity.User;
import com.skillbridge.auth.enums.Role;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.io.IOException;
import java.util.Base64;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JwtAuthFilterTest {

    private JwtService jwtService;
    @Mock private UserDetailsServiceImpl userDetailsService;
    private JwtAuthFilter filter;

    @BeforeEach
    void setUp() {
        String secret = Base64.getEncoder().encodeToString(new byte[32]);
        jwtService = new JwtService(secret, 24L);
        filter = new JwtAuthFilter(jwtService, userDetailsService);
        SecurityContextHolder.clearContext();
    }

    @Test
    void missingAuthorizationHeader_continuesChain() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilterInternal(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(chain.getRequest()).isNotNull();
    }

    @Test
    void invalidToken_returns401() throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer invalid-token");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilterInternal(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void expiredToken_returns401() throws ServletException, IOException {
        String secret = Base64.getEncoder().encodeToString(new byte[32]);
        JwtService expiredService = new JwtService(secret, -1L);
        JwtAuthFilter expiredFilter = new JwtAuthFilter(expiredService, userDetailsService);

        User user = buildUser(true);
        String token = expiredService.generateAccessToken(user);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        expiredFilter.doFilterInternal(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(401);
    }

    @Test
    void validToken_userNotFound_returns401() throws ServletException, IOException {
        User user = buildUser(true);
        String token = jwtService.generateAccessToken(user);

        when(userDetailsService.loadUserById(user.getId()))
                .thenThrow(new UsernameNotFoundException("not found"));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilterInternal(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(401);
    }

    @Test
    void validToken_disabledUser_returns401() throws ServletException, IOException {
        User user = buildUser(false);
        String token = jwtService.generateAccessToken(user);

        when(userDetailsService.loadUserById(user.getId())).thenReturn(user);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilterInternal(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(401);
    }

    @Test
    void validToken_activeUser_setsAuthenticationAndContinues() throws ServletException, IOException {
        User user = buildUser(true);
        String token = jwtService.generateAccessToken(user);

        when(userDetailsService.loadUserById(user.getId())).thenReturn(user);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilterInternal(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication().getPrincipal()).isEqualTo(user);
        assertThat(chain.getRequest()).isNotNull();
    }

    private User buildUser(boolean active) {
        return User.builder()
                .id(UUID.randomUUID())
                .email("user@example.com")
                .passwordHash("$2a$10$hashed")
                .firstName("Test")
                .lastName("User")
                .role(Role.STUDENT)
                .active(active)
                .build();
    }
}
