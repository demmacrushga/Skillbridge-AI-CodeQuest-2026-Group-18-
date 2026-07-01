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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock UserRepository userRepository;
    @Mock RefreshTokenRepository refreshTokenRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JwtService jwtService;

    @InjectMocks AuthServiceImpl authService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(authService, "expiryHours", 24L);
        ReflectionTestUtils.setField(authService, "refreshExpiryDays", 30L);
    }

    // --- register ---

    @Test
    void register_success_returnsUserResponse() {
        RegisterRequest req = new RegisterRequest("test@example.com", "password123", "Jane", "Doe", Role.STUDENT);
        when(userRepository.existsByEmail(req.email())).thenReturn(false);
        when(passwordEncoder.encode(req.password())).thenReturn("hashed");
        User savedUser = User.builder().id(UUID.randomUUID()).email(req.email())
                .passwordHash("hashed").firstName("Jane").lastName("Doe").role(Role.STUDENT).build();
        when(userRepository.save(any(User.class))).thenReturn(savedUser);

        UserResponse result = authService.register(req);

        assertThat(result.email()).isEqualTo("test@example.com");
        assertThat(result.firstName()).isEqualTo("Jane");
        verify(passwordEncoder).encode("password123");
    }

    @Test
    void register_duplicateEmail_throwsEmailAlreadyExistsException() {
        RegisterRequest req = new RegisterRequest("dup@example.com", "password123", "A", "B", Role.STUDENT);
        when(userRepository.existsByEmail(req.email())).thenReturn(true);

        assertThatThrownBy(() -> authService.register(req))
                .isInstanceOf(EmailAlreadyExistsException.class);

        verify(userRepository, never()).save(any());
    }

    // --- login ---

    @Test
    void login_success_returnsAuthResponse() {
        LoginRequest req = new LoginRequest("user@example.com", "password123");
        User user = buildUser();
        when(userRepository.findByEmail(req.email())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(req.password(), user.getPasswordHash())).thenReturn(true);
        when(jwtService.generateAccessToken(user)).thenReturn("access-token");
        when(jwtService.generateRawRefreshToken()).thenReturn("raw-refresh");
        when(jwtService.hashToken("raw-refresh")).thenReturn("hashed-refresh");
        when(refreshTokenRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        AuthResponse result = authService.login(req);

        assertThat(result.accessToken()).isEqualTo("access-token");
        assertThat(result.refreshToken()).isEqualTo("raw-refresh");
        verify(refreshTokenRepository).save(any(RefreshToken.class));
    }

    @Test
    void login_wrongPassword_throwsBadCredentialsException() {
        LoginRequest req = new LoginRequest("user@example.com", "wrong");
        User user = buildUser();
        when(userRepository.findByEmail(req.email())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(req.password(), user.getPasswordHash())).thenReturn(false);

        assertThatThrownBy(() -> authService.login(req))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void login_unknownEmail_throwsBadCredentialsException() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new LoginRequest("x@x.com", "pass")))
                .isInstanceOf(BadCredentialsException.class);
    }

    // --- refresh ---

    @Test
    void refresh_success_rotatesTokenAndReturnsNewPair() {
        String raw = "raw-token";
        String hash = "hashed-token";
        User user = buildUser();
        RefreshToken stored = RefreshToken.builder()
                .user(user).tokenHash(hash)
                .expiresAt(Instant.now().plusSeconds(3600))
                .revoked(false).build();

        when(jwtService.hashToken(raw)).thenReturn(hash);
        when(refreshTokenRepository.findByTokenHash(hash)).thenReturn(Optional.of(stored));
        when(refreshTokenRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(jwtService.generateAccessToken(user)).thenReturn("new-access");
        when(jwtService.generateRawRefreshToken()).thenReturn("new-raw");
        when(jwtService.hashToken("new-raw")).thenReturn("new-hash");

        AuthResponse result = authService.refresh(new RefreshTokenRequest(raw));

        assertThat(stored.isRevoked()).isTrue();
        assertThat(result.accessToken()).isEqualTo("new-access");
    }

    @Test
    void refresh_revokedToken_throwsInvalidTokenException() {
        String raw = "raw";
        RefreshToken stored = RefreshToken.builder()
                .tokenHash("hash").expiresAt(Instant.now().plusSeconds(3600))
                .revoked(true).user(buildUser()).build();

        when(jwtService.hashToken(raw)).thenReturn("hash");
        when(refreshTokenRepository.findByTokenHash("hash")).thenReturn(Optional.of(stored));

        assertThatThrownBy(() -> authService.refresh(new RefreshTokenRequest(raw)))
                .isInstanceOf(InvalidTokenException.class)
                .hasMessageContaining("revoked");
    }

    @Test
    void refresh_expiredToken_throwsInvalidTokenException() {
        String raw = "raw";
        RefreshToken stored = RefreshToken.builder()
                .tokenHash("hash").expiresAt(Instant.now().minusSeconds(1))
                .revoked(false).user(buildUser()).build();

        when(jwtService.hashToken(raw)).thenReturn("hash");
        when(refreshTokenRepository.findByTokenHash("hash")).thenReturn(Optional.of(stored));

        assertThatThrownBy(() -> authService.refresh(new RefreshTokenRequest(raw)))
                .isInstanceOf(InvalidTokenException.class)
                .hasMessageContaining("expired");
    }

    @Test
    void register_adminRole_throwsInvalidRegistrationRoleException() {
        RegisterRequest req = new RegisterRequest("admin@example.com", "password123", "A", "B", Role.ADMIN);

        assertThatThrownBy(() -> authService.register(req))
                .isInstanceOf(InvalidRegistrationRoleException.class);

        verify(userRepository, never()).save(any());
    }

    @Test
    void register_dataIntegrityViolation_throwsEmailAlreadyExistsException() {
        RegisterRequest req = new RegisterRequest("race@example.com", "password123", "A", "B", Role.STUDENT);
        when(userRepository.existsByEmail(req.email())).thenReturn(false);
        when(passwordEncoder.encode(req.password())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenThrow(new DataIntegrityViolationException("duplicate"));

        assertThatThrownBy(() -> authService.register(req))
                .isInstanceOf(EmailAlreadyExistsException.class);
    }

    @Test
    void logout_existingToken_revokesToken() {
        String raw = "raw-token";
        String hash = "hashed-token";
        RefreshToken stored = RefreshToken.builder()
                .tokenHash(hash).expiresAt(Instant.now().plusSeconds(3600))
                .revoked(false).user(buildUser()).build();

        when(jwtService.hashToken(raw)).thenReturn(hash);
        when(refreshTokenRepository.findByTokenHash(hash)).thenReturn(Optional.of(stored));
        when(refreshTokenRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        authService.logout(new LogoutRequest(raw));

        assertThat(stored.isRevoked()).isTrue();
        verify(refreshTokenRepository).save(stored);
    }

    @Test
    void logout_unknownToken_doesNothing() {
        String raw = "raw-token";
        when(jwtService.hashToken(raw)).thenReturn("hash");
        when(refreshTokenRepository.findByTokenHash("hash")).thenReturn(Optional.empty());

        authService.logout(new LogoutRequest(raw));

        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void me_withUserPrincipal_returnsUserResponse() {
        User user = buildUser();
        Authentication auth = new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());

        UserResponse result = authService.me(auth);

        assertThat(result.email()).isEqualTo(user.getEmail());
    }

    @Test
    void me_withNonUserPrincipal_throwsBadCredentialsException() {
        Authentication auth = new UsernamePasswordAuthenticationToken("not-a-user", null);

        assertThatThrownBy(() -> authService.me(auth))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void me_withNullAuthentication_throwsBadCredentialsException() {
        assertThatThrownBy(() -> authService.me(null))
                .isInstanceOf(BadCredentialsException.class);
    }

    private User buildUser() {
        return User.builder()
                .id(UUID.randomUUID())
                .email("user@example.com")
                .passwordHash("$2a$10$hashedpassword")
                .firstName("Test")
                .lastName("User")
                .role(Role.STUDENT)
                .build();
    }
}
