package com.skillbridge.notification.dto.response;

import com.skillbridge.notification.entity.NotificationType;

import java.time.Instant;
import java.util.UUID;

public record NotificationResponse(
        UUID id,
        NotificationType type,
        String title,
        String body,
        boolean read,
        Instant createdAt
) {
}
