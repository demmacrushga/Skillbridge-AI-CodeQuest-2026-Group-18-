package com.skillbridge.challenge.dto.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record SubmissionReviewResponse(
        UUID id,
        UUID studentId,
        String submissionUrl,
        BigDecimal score,
        Instant submittedAt) {
}
