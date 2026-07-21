package com.skillbridge.auth.controller;

import com.skillbridge.auth.dto.request.LoginRequest;
import com.skillbridge.auth.dto.request.LogoutRequest;
import com.skillbridge.auth.dto.request.RefreshTokenRequest;
import com.skillbridge.auth.dto.request.RegisterRequest;
import com.skillbridge.auth.dto.response.AuthResponse;
import com.skillbridge.auth.dto.response.UserResponse;
import com.skillbridge.auth.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Register, login, token refresh, and user profile")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Register a new user")
    public UserResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    @Operation(summary = "Login with email and password")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/refresh")
    @Operation(summary = "Refresh access token using a valid refresh token")
    public AuthResponse refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return authService.refresh(request);
    }

    @GetMapping("/me")
    @SecurityRequirement(name = "Bearer")
    @Operation(summary = "Get the currently authenticated user's profile")
    public UserResponse me(Authentication authentication) {
        return authService.me(authentication);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Revoke a refresh token")
    public void logout(@Valid @RequestBody LogoutRequest request) {
        authService.logout(request);
    }
}
//this is a test