package com.skillbridge.mockinterview.dto.response;

import java.time.Instant;
import java.util.UUID;

public record QuestionResponse(
        UUID id,
        String questionText,
        String category,
        int orderIndex,
        String userAnswer,
        Integer score,
        String feedback,
        Instant answeredAt) {
}
