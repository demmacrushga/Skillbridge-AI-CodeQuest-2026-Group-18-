package com.skillbridge.auth.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CorsConfigTest {

    @Test
    void explicitOrigins_allowCredentialsTrue() {
        CorsConfig config = new CorsConfig(List.of("http://localhost:3000", "http://localhost:5173"));

        CorsConfigurationSource source = config.corsConfigurationSource();
        CorsConfiguration cors = source.getCorsConfiguration(new MockHttpServletRequest());

        assertThat(cors.getAllowedOrigins()).containsExactly("http://localhost:3000", "http://localhost:5173");
        assertThat(cors.getAllowCredentials()).isTrue();
    }

    @Test
    void wildcardOrigin_disallowsCredentials() {
        CorsConfig config = new CorsConfig(List.of("*"));

        CorsConfigurationSource source = config.corsConfigurationSource();
        CorsConfiguration cors = source.getCorsConfiguration(new MockHttpServletRequest());

        assertThat(cors.getAllowedOriginPatterns()).containsExactly("*");
        assertThat(cors.getAllowCredentials()).isFalse();
    }
}
