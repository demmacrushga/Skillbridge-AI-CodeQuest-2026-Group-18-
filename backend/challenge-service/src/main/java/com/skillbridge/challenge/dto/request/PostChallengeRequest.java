package com.skillbridge.challenge.dto.request;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public record PostChallengeRequest(
        @NotBlank @Size(max = 255) String title,
        @NotBlank @Size(max = 5000) String description,
        @NotBlank @Size(max = 2000) String submissionFormat,
        @NotNull @Future Instant deadline) {
}
