package com.skillbridge.challenge.dto.response;

import java.time.Instant;
import java.util.UUID;

public record ChallengeListEntry(
        UUID id,
        String title,
        String description,
        String submissionFormat,
        Instant deadline,
        Instant createdAt,
        boolean submitted) {
}
