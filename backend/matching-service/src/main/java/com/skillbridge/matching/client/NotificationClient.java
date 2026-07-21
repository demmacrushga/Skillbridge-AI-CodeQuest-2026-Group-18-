package com.skillbridge.matching.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.UUID;

/**
 * Best-effort notification client. Copied per service (platform copy-not-share convention).
 * - POST {notification.url}/notification/internal/notify
 * - 2s connect+read timeout
 * - Any exception is caught and logged as WARN, never rethrown.
 * - If notification.url is blank, the client is a permanent no-op.
 */
@Component
@Slf4j
public class NotificationClient {

    private static final Duration TIMEOUT = Duration.ofSeconds(2);

    private final RestClient restClient;
    private final String internalToken;
    private final boolean enabled;

    public NotificationClient(
            @Value("${notification.url:}") String notificationUrl,
            @Value("${internal.service.token:}") String internalToken) {
        this.internalToken = internalToken;
        this.enabled = notificationUrl != null && !notificationUrl.isBlank();
        if (enabled) {
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(TIMEOUT);
            factory.setReadTimeout(TIMEOUT);
            this.restClient = RestClient.builder()
                    .baseUrl(notificationUrl)
                    .requestFactory(factory)
                    .build();
            log.info("Notification client enabled: baseUrl={}", notificationUrl);
        } else {
            this.restClient = null;
            log.info("Notification client disabled: notification.url is blank");
        }
    }

    public void notify(UUID userId, String type, String title, String body) {
        if (!enabled) {
            return;
        }
        try {
            restClient.post()
                    .uri("/notification/internal/notify")
                    .header("X-Internal-Token", internalToken)
                    .body(new NotificationRequest(userId, type, title, body))
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.warn("notification send failed: type={} userId={} error={}", type, userId, e.getMessage());
        }
    }

    public record NotificationRequest(UUID userId, String type, String title, String body) {
    }
}
