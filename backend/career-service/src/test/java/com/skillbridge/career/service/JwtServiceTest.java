package com.skillbridge.career.service;

import com.skillbridge.career.security.JwtService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Encoders;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    JwtService jwtService;

    private static final String SECRET;
    private static final UUID USER_ID = UUID.randomUUID();

    static {
        SecretKey key = Keys.secretKeyFor(io.jsonwebtoken.SignatureAlgorithm.HS256);
        SECRET = Base64.getEncoder().encodeToString(key.getEncoded());
    }

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(SECRET);
    }

    private String buildToken(long expiryMs) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .subject(USER_ID.toString())
                .claim("email", "test@knust.edu.gh")
                .claim("role", "STUDENT")
                .issuedAt(new Date(now))
                .expiration(new Date(now + expiryMs))
                .signWith(Keys.hmacShaKeyFor(Base64.getDecoder().decode(SECRET)))
                .compact();
    }

    @Test
    void isTokenValid_validToken_returnsTrue() {
        String token = buildToken(3_600_000L);
        assertThat(jwtService.isTokenValid(token)).isTrue();
    }

    @Test
    void isTokenValid_expiredToken_returnsFalse() {
        String token = buildToken(-1000L);
        assertThat(jwtService.isTokenValid(token)).isFalse();
    }

    @Test
    void isTokenValid_malformedToken_returnsFalse() {
        assertThat(jwtService.isTokenValid("not.a.token")).isFalse();
    }

    @Test
    void extractUserId_validToken_returnsCorrectUuid() {
        String token = buildToken(3_600_000L);
        assertThat(jwtService.extractUserId(token)).isEqualTo(USER_ID);
    }

    @Test
    void extractEmail_validToken_returnsEmail() {
        String token = buildToken(3_600_000L);
        assertThat(jwtService.extractEmail(token)).isEqualTo("test@knust.edu.gh");
    }

    @Test
    void extractRole_validToken_returnsRole() {
        String token = buildToken(3_600_000L);
        assertThat(jwtService.extractRole(token)).isEqualTo("STUDENT");
    }
}
