package com.skillbridge.notification.service;

import com.skillbridge.notification.entity.PushToken;
import com.skillbridge.notification.repository.PushTokenRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
public class ExpoPushClientImpl implements ExpoPushClient {

    private static final Logger log = LoggerFactory.getLogger(ExpoPushClientImpl.class);
    private static final String DEVICE_NOT_REGISTERED = "DeviceNotRegistered";

    private final RestClient restClient;
    private final PushTokenRepository pushTokenRepository;
    private final ObjectMapper objectMapper;

    public ExpoPushClientImpl(RestClient restClient, PushTokenRepository pushTokenRepository) {
        this.restClient = restClient;
        this.pushTokenRepository = pushTokenRepository;
        this.objectMapper = new ObjectMapper();
    }

    @Override
    public void send(List<PushToken> tokens, String title, String body) {
        if (tokens == null || tokens.isEmpty()) {
            return;
        }

        List<Map<String, String>> messages = tokens.stream()
                .map(token -> Map.of(
                        "to", token.getToken(),
                        "title", title,
                        "body", body,
                        "sound", "default"))
                .toList();

        String responseBody;
        try {
            responseBody = restClient.post()
                    .body(messages)
                    .retrieve()
                    .body(String.class);
        } catch (RestClientResponseException e) {
            log.warn("Expo push request failed: status={}, body={}", e.getStatusCode(), e.getResponseBodyAsString());
            return;
        } catch (Exception e) {
            log.warn("Expo push request failed: {}", e.getMessage());
            return;
        }

        try {
            Map<String, Object> response = objectMapper.readValue(responseBody, Map.class);
            List<Map<String, Object>> data = (List<Map<String, Object>>) response.get("data");
            if (data == null) {
                return;
            }
            for (int i = 0; i < data.size() && i < tokens.size(); i++) {
                Map<String, Object> receipt = data.get(i);
                String status = (String) receipt.get("status");
                if ("error".equals(status)) {
                    Map<String, Object> details = (Map<String, Object>) receipt.get("details");
                    String error = details != null ? (String) details.get("error") : null;
                    if (DEVICE_NOT_REGISTERED.equals(error)) {
                        PushToken deadToken = tokens.get(i);
                        deactivateToken(deadToken);
                    } else {
                        String tokenValue = tokens.get(i).getToken();
                        log.warn("Expo push receipt error for token {}: {}", maskToken(tokenValue), error);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to parse Expo push response: {}", e.getMessage());
        }
    }

    private void deactivateToken(PushToken token) {
        token.setActive(false);
        pushTokenRepository.save(token);
        log.info("Deactivated push token {}", maskToken(token.getToken()));
    }

    private String maskToken(String token) {
        if (token == null || token.length() <= 8) {
            return "***";
        }
        return token.substring(0, 4) + "..." + token.substring(token.length() - 4);
    }
}
