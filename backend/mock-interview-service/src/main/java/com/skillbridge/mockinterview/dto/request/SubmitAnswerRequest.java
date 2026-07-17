package com.skillbridge.mockinterview.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SubmitAnswerRequest(
        @NotBlank @Size(max = 5000) String answer) {
}
