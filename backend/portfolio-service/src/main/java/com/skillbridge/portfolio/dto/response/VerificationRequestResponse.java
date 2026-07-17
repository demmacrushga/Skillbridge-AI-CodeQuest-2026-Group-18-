package com.skillbridge.portfolio.dto.response;

import java.time.Instant;
import java.util.UUID;

public record VerificationRequestResponse(
        UUID id,
        UUID portfolioItemId,
        String status,
        String reviewerNote,
        String reviewSource,
        Instant requestedAt,
        Instant reviewedAt
) {}
