package com.skillbridge.mockinterview.dto.response;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record SessionResponse(
        UUID id,
        String targetRole,
        String difficulty,
        String status,
        Integer overallScore,
        String overallFeedback,
        Instant createdAt,
        Instant completedAt,
        List<QuestionResponse> questions) {
}
