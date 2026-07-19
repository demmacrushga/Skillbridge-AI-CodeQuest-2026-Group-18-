package com.skillbridge.challenge.dto.response;

import java.time.Instant;
import java.util.UUID;

public record ChallengeResponse(
        UUID id,
        String title,
        String description,
        String submissionFormat,
        Instant deadline,
        boolean active,
        Instant createdAt,
        Long submissionCount) {
}
