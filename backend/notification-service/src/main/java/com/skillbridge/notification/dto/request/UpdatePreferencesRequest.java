package com.skillbridge.notification.dto.request;

import com.skillbridge.notification.entity.NotificationType;
import jakarta.validation.constraints.NotNull;

import java.util.Set;

public record UpdatePreferencesRequest(
        @NotNull(message = "pushEnabled is required")
        Boolean pushEnabled,

        @NotNull(message = "mutedTypes is required")
        Set<NotificationType> mutedTypes
) {
}
