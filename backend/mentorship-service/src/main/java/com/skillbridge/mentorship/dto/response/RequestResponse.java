package com.skillbridge.mentorship.dto.response;

import com.skillbridge.mentorship.entity.RequestStatus;

import java.time.Instant;
import java.util.UUID;

public record RequestResponse(
        UUID id,
        UUID studentId,
        UUID alumniId,
        String message,
        RequestStatus status,
        Instant createdAt,
        Instant respondedAt
) {
}
