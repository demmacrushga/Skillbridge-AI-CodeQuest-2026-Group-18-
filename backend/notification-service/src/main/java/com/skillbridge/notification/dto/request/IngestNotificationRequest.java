package com.skillbridge.notification.dto.request;

import com.skillbridge.notification.entity.NotificationType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record IngestNotificationRequest(
        @NotNull(message = "userId is required")
        UUID userId,

        @NotNull(message = "type is required")
        NotificationType type,

        @NotBlank(message = "title is required")
        @Size(max = 255, message = "title must be at most 255 characters")
        String title,

        @NotBlank(message = "body is required")
        @Size(max = 2000, message = "body must be at most 2000 characters")
        String body
) {
}
