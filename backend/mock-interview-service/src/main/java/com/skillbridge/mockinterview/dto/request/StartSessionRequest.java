package com.skillbridge.mockinterview.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record StartSessionRequest(
        @NotBlank @Size(max = 200) String targetRole,
        @NotNull Difficulty difficulty) {
}
