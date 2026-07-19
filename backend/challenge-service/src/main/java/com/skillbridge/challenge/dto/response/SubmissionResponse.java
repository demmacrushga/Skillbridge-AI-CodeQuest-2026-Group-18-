package com.skillbridge.challenge.dto.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record SubmissionResponse(
        UUID id,
        UUID challengeId,
        String submissionUrl,
        BigDecimal score,
        Instant submittedAt) {
}
