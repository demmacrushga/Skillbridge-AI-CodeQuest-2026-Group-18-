package com.skillbridge.notification.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
public class RestClientConfig {

    private static final Duration TIMEOUT = Duration.ofSeconds(3);

    @Bean
    public RestClient expoRestClient(@Value("${expo.push-url}") String expoPushUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(TIMEOUT);
        factory.setReadTimeout(TIMEOUT);
        return RestClient.builder()
                .baseUrl(expoPushUrl)
                .requestFactory(factory)
                .build();
    }
}
