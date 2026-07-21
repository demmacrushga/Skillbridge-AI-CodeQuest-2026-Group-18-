package com.skillbridge.mentorship.dto.response;

import java.time.Instant;
import java.util.UUID;

public record MessageResponse(
        UUID id,
        UUID pairId,
        UUID senderId,
        String body,
        Instant sentAt,
        Instant readAt
) {
}
