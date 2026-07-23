package com.skillbridge.auth.service;

import com.skillbridge.auth.dto.request.LoginRequest;
import com.skillbridge.auth.dto.request.LogoutRequest;
import com.skillbridge.auth.dto.request.RefreshTokenRequest;
import com.skillbridge.auth.dto.request.RegisterRequest;
import com.skillbridge.auth.dto.response.AuthResponse;
import com.skillbridge.auth.dto.response.UserResponse;
import com.skillbridge.auth.entity.RefreshToken;
import com.skillbridge.auth.entity.User;
import com.skillbridge.auth.enums.Role;
import com.skillbridge.auth.exception.EmailAlreadyExistsException;
import com.skillbridge.auth.exception.InvalidRegistrationRoleException;
import com.skillbridge.auth.exception.InvalidTokenException;
import com.skillbridge.auth.repository.RefreshTokenRepository;
import com.skillbridge.auth.repository.UserRepository;
import com.skillbridge.auth.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @Value("${jwt.expiry-hours}")
    private long expiryHours;

    @Value("${jwt.refresh-expiry-days}")
    private long refreshExpiryDays;

    @Override
    @Transactional
    public UserResponse register(RegisterRequest request) {
        if (request.role() == Role.ADMIN) {
            throw new InvalidRegistrationRoleException(Role.ADMIN.name());
        }

        String normalizedEmail = request.email() != null ? request.email().trim() : "";

        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new EmailAlreadyExistsException(normalizedEmail);
        }

        User user = User.builder()
                .email(normalizedEmail.toLowerCase())
                .passwordHash(passwordEncoder.encode(request.password()))
                .firstName(request.firstName())
                .lastName(request.lastName())
                .role(request.role())
                .build();

        try {
            return UserResponse.from(userRepository.save(user));
        } catch (DataIntegrityViolationException e) {
            throw new EmailAlreadyExistsException(request.email());
        }
    }

    @Override
    @Transactional
    public AuthResponse login(LoginRequest request) {
        String rawEmail = request.email() != null ? request.email().trim() : "";
        User user = userRepository.findByEmailIgnoreCase(rawEmail)
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid credentials");
        }

        return buildAuthResponse(user);
    }

    @Override
    @Transactional
    public AuthResponse refresh(RefreshTokenRequest request) {
        String hash = jwtService.hashToken(request.refreshToken());

        RefreshToken stored = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new InvalidTokenException("Refresh token not found"));

        if (stored.isRevoked()) {
            throw new InvalidTokenException("Refresh token has been revoked");
        }

        if (stored.getExpiresAt().isBefore(Instant.now())) {
            throw new InvalidTokenException("Refresh token has expired");
        }

        // Rotate — revoke old token before issuing new one
        stored.setRevoked(true);
        refreshTokenRepository.save(stored);

        return buildAuthResponse(stored.getUser());
    }

    @Override
    public UserResponse me(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof User user)) {
            throw new BadCredentialsException("Invalid authentication");
        }
        return UserResponse.from(user);
    }

    @Override
    @Transactional
    public void logout(LogoutRequest request) {
        String hash = jwtService.hashToken(request.refreshToken());
        refreshTokenRepository.findByTokenHash(hash).ifPresent(token -> {
            token.setRevoked(true);
            refreshTokenRepository.save(token);
        });
    }

    private AuthResponse buildAuthResponse(User user) {
        String accessToken = jwtService.generateAccessToken(user);
        String rawRefreshToken = jwtService.generateRawRefreshToken();

        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .tokenHash(jwtService.hashToken(rawRefreshToken))
                .expiresAt(Instant.now().plus(refreshExpiryDays, ChronoUnit.DAYS))
                .build();
        refreshTokenRepository.save(refreshToken);

        return new AuthResponse(
                accessToken,
                rawRefreshToken,
                expiryHours * 3600L,
                UserResponse.from(user)
        );
    }
}
