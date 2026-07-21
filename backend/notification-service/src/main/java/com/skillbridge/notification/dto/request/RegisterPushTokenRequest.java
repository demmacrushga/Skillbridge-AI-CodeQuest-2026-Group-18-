package com.skillbridge.notification.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterPushTokenRequest(
        @NotBlank(message = "token is required")
        @Size(max = 255, message = "token must be at most 255 characters")
        String token
) {
}
