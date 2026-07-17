package com.skillbridge.mockinterview.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Encoders;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    private static final SecretKey KEY = Keys.hmacShaKeyFor(
            "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF"
                    .getBytes(StandardCharsets.UTF_8));
    private static final UUID SUBJECT = UUID.randomUUID();

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(Encoders.BASE64.encode(KEY.getEncoded()));
    }

    private String token(Date expiration) {
        return Jwts.builder()
                .subject(SUBJECT.toString())
                .claims(Map.of("email", "student@knust.edu.gh", "role", "STUDENT"))
                .expiration(expiration)
                .signWith(KEY)
                .compact();
    }

    @Test
    void extractAllClaims_validToken_returnsClaims() {
        Claims claims = jwtService.extractAllClaims(token(new Date(System.currentTimeMillis() + 60000)));
        assertThat(claims.getSubject()).isEqualTo(SUBJECT.toString());
    }

    @Test
    void isTokenValid_validToken_returnsTrue() {
        assertThat(jwtService.isTokenValid(token(new Date(System.currentTimeMillis() + 60000)))).isTrue();
    }

    @Test
    void isTokenValid_expiredToken_returnsFalse() {
        assertThat(jwtService.isTokenValid(token(new Date(System.currentTimeMillis() - 60000)))).isFalse();
    }

    @Test
    void isTokenValid_malformedToken_returnsFalse() {
        assertThat(jwtService.isTokenValid("not-a-jwt")).isFalse();
    }

    @Test
    void extractUserId_returnsSubjectUuid() {
        assertThat(jwtService.extractUserId(token(new Date(System.currentTimeMillis() + 60000))))
                .isEqualTo(SUBJECT);
    }

    @Test
    void extractEmail_returnsEmailClaim() {
        assertThat(jwtService.extractEmail(token(new Date(System.currentTimeMillis() + 60000))))
                .isEqualTo("student@knust.edu.gh");
    }

    @Test
    void extractRole_returnsRoleClaim() {
        assertThat(jwtService.extractRole(token(new Date(System.currentTimeMillis() + 60000))))
                .isEqualTo("STUDENT");
    }
}
