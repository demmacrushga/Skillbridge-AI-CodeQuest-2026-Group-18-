package com.skillbridge.mockinterview.service.dto;

public record QuestionTemplate(
        String questionText,
        String category,
        int orderIndex) {
}
