package com.skillbridge.mockinterview.dto.response;

import java.time.Instant;
import java.util.UUID;

public record SessionSummaryResponse(
        UUID id,
        String targetRole,
        String difficulty,
        String status,
        Integer overallScore,
        Instant createdAt) {
}
