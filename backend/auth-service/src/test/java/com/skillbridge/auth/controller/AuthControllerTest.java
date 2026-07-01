package com.skillbridge.auth.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillbridge.auth.dto.request.LoginRequest;
import com.skillbridge.auth.dto.request.LogoutRequest;
import com.skillbridge.auth.dto.request.RefreshTokenRequest;
import com.skillbridge.auth.dto.request.RegisterRequest;
import com.skillbridge.auth.dto.response.AuthResponse;
import com.skillbridge.auth.dto.response.UserResponse;
import com.skillbridge.auth.enums.Role;
import com.skillbridge.auth.exception.EmailAlreadyExistsException;
import com.skillbridge.auth.exception.InvalidRegistrationRoleException;
import com.skillbridge.auth.exception.InvalidTokenException;
import com.skillbridge.auth.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller-layer tests — security filters are disabled to test business
 * logic in isolation. Authentication enforcement (401 for unauthenticated
 * /auth/me) is covered by the Swagger smoke-test checklist against the
 * running service.
 */
@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @MockBean AuthService authService;
    // JwtAuthFilter is a @Component/Filter loaded by @WebMvcTest; its deps must be mocked
    @MockBean com.skillbridge.auth.security.JwtService jwtService;
    @MockBean com.skillbridge.auth.security.UserDetailsServiceImpl userDetailsService;

    private static final UserResponse SAMPLE_USER = new UserResponse(
            UUID.randomUUID(), "jane@example.com", "Jane", "Doe", "STUDENT", false);

    private static final AuthResponse SAMPLE_AUTH = new AuthResponse(
            "access-token", "refresh-token", 86400L, SAMPLE_USER);

    // --- register ---

    @Test
    void register_validPayload_returns201() throws Exception {
        when(authService.register(any())).thenReturn(SAMPLE_USER);

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new RegisterRequest("jane@example.com", "password123", "Jane", "Doe", Role.STUDENT))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("jane@example.com"))
                .andExpect(jsonPath("$.firstName").value("Jane"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void register_duplicateEmail_returns409() throws Exception {
        when(authService.register(any())).thenThrow(new EmailAlreadyExistsException("jane@example.com"));

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new RegisterRequest("jane@example.com", "password123", "Jane", "Doe", Role.STUDENT))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void register_missingField_returns422() throws Exception {
        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"bad\",\"password\":\"short\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors").isArray());
    }

    // --- login ---

    @Test
    void login_validCredentials_returns200WithTokens() throws Exception {
        when(authService.login(any())).thenReturn(SAMPLE_AUTH);

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new LoginRequest("jane@example.com", "password123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("access-token"))
                .andExpect(jsonPath("$.refreshToken").value("refresh-token"))
                .andExpect(jsonPath("$.expiresIn").value(86400));
    }

    @Test
    void login_wrongPassword_returns401() throws Exception {
        when(authService.login(any())).thenThrow(new BadCredentialsException("Invalid credentials"));

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new LoginRequest("jane@example.com", "wrong"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    // --- refresh ---

    @Test
    void refresh_validToken_returns200WithNewPair() throws Exception {
        when(authService.refresh(any())).thenReturn(SAMPLE_AUTH);

        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new RefreshTokenRequest("some-refresh-token"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").exists())
                .andExpect(jsonPath("$.refreshToken").exists());
    }

    @Test
    void refresh_revokedToken_returns401() throws Exception {
        when(authService.refresh(any()))
                .thenThrow(new InvalidTokenException("Refresh token has been revoked"));

        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new RefreshTokenRequest("bad-token"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void refresh_expiredToken_returns401() throws Exception {
        when(authService.refresh(any()))
                .thenThrow(new InvalidTokenException("Refresh token has expired"));

        mockMvc.perform(post("/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new RefreshTokenRequest("expired-token"))))
                .andExpect(status().isUnauthorized());
    }

    // --- me ---

    @Test
    void me_withAuthenticatedUser_returns200() throws Exception {
        when(authService.me(nullable(Authentication.class))).thenReturn(SAMPLE_USER);

        mockMvc.perform(get("/auth/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("jane@example.com"))
                .andExpect(jsonPath("$.role").value("STUDENT"));
    }

    // --- logout ---

    @Test
    void logout_validToken_returns204() throws Exception {
        mockMvc.perform(post("/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new LogoutRequest("some-refresh-token"))))
                .andExpect(status().isNoContent());
    }

    @Test
    void logout_missingToken_returns422() throws Exception {
        mockMvc.perform(post("/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void register_adminRole_returns422() throws Exception {
        when(authService.register(any())).thenThrow(new InvalidRegistrationRoleException("ADMIN"));

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new RegisterRequest("admin@example.com", "password123", "A", "B", Role.ADMIN))))
                .andExpect(status().isUnprocessableEntity());
    }
}
