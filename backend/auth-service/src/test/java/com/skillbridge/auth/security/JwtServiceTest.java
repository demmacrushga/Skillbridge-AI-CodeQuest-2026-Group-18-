package com.skillbridge.auth.security;

import com.skillbridge.auth.entity.User;
import com.skillbridge.auth.enums.Role;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.Base64;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    private static String secret;
    private static JwtService jwtService;

    @BeforeAll
    static void setUp() {
        secret = Base64.getEncoder().encodeToString(new byte[32]);
        jwtService = new JwtService(secret, 24L);
    }

    @Test
    void generateAccessToken_containsExpectedClaims() {
        User user = User.builder()
                .id(UUID.randomUUID())
                .email("user@example.com")
                .role(Role.STUDENT)
                .build();

        String token = jwtService.generateAccessToken(user);

        Claims claims = jwtService.extractAllClaims(token);
        assertThat(claims.getSubject()).isEqualTo(user.getId().toString());
        assertThat(claims.get("email", String.class)).isEqualTo(user.getEmail());
        assertThat(claims.get("role", String.class)).isEqualTo("STUDENT");
    }

    @Test
    void extractUserId_returnsSubject() {
        User user = User.builder()
                .id(UUID.randomUUID())
                .email("user@example.com")
                .role(Role.RECRUITER)
                .build();

        String token = jwtService.generateAccessToken(user);

        assertThat(jwtService.extractUserId(token)).isEqualTo(user.getId().toString());
    }

    @Test
    void isTokenValid_validToken_returnsTrue() {
        User user = User.builder()
                .id(UUID.randomUUID())
                .email("user@example.com")
                .role(Role.ALUMNI)
                .build();

        String token = jwtService.generateAccessToken(user);

        assertThat(jwtService.isTokenValid(token)).isTrue();
    }

    @Test
    void isTokenValid_tamperedToken_returnsFalse() {
        User user = User.builder()
                .id(UUID.randomUUID())
                .email("user@example.com")
                .role(Role.STUDENT)
                .build();

        String token = jwtService.generateAccessToken(user) + "x";

        assertThat(jwtService.isTokenValid(token)).isFalse();
    }

    @Test
    void hashToken_sameInputProducesSameOutput() {
        String input = "refresh-token-value";

        String first = jwtService.hashToken(input);
        String second = jwtService.hashToken(input);

        assertThat(first).isEqualTo(second);
        assertThat(first).isNotEqualTo(input);
    }

    @Test
    void generateRawRefreshToken_producesDifferentValues() {
        String first = jwtService.generateRawRefreshToken();
        String second = jwtService.generateRawRefreshToken();

        assertThat(first).isNotEqualTo(second);
        assertThat(first).isNotEmpty();
    }
}
