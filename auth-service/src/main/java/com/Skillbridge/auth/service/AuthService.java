package com.skillbridge.auth.service;

import com.skillbridge.auth.dto.request.LoginRequest;
import com.skillbridge.auth.dto.request.LogoutRequest;
import com.skillbridge.auth.dto.request.RefreshTokenRequest;
import com.skillbridge.auth.dto.request.RegisterRequest;
import com.skillbridge.auth.dto.response.AuthResponse;
import com.skillbridge.auth.dto.response.UserResponse;
import org.springframework.security.core.Authentication;

public interface AuthService {

    UserResponse register(RegisterRequest request);

    AuthResponse login(LoginRequest request);

    AuthResponse refresh(RefreshTokenRequest request);

    UserResponse me(Authentication authentication);

    void logout(LogoutRequest request);
}
