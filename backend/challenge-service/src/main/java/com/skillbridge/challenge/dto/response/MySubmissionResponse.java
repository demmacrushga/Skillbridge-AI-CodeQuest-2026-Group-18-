package com.skillbridge.challenge.dto.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record MySubmissionResponse(
        UUID id,
        String submissionUrl,
        BigDecimal score,
        Instant submittedAt,
        ChallengeResponse challenge) {
}
