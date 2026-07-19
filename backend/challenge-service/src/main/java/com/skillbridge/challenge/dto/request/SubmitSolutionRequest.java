package com.skillbridge.challenge.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SubmitSolutionRequest(
        @NotBlank
        @Pattern(regexp = "^https?://.*", message = "must be a valid http/https URL")
        @Size(max = 2048) String submissionUrl) {
}
