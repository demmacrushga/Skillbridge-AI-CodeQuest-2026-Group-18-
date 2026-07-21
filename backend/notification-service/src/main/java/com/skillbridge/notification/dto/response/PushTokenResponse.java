package com.skillbridge.notification.dto.response;

import java.time.Instant;

public record PushTokenResponse(
        String token,
        boolean active,
        Instant registeredAt
) {
}
