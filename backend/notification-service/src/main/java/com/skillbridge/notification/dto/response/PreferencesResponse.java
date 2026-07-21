package com.skillbridge.notification.dto.response;

import com.skillbridge.notification.entity.NotificationType;

import java.util.Set;

public record PreferencesResponse(
        boolean pushEnabled,
        Set<NotificationType> mutedTypes
) {
}
