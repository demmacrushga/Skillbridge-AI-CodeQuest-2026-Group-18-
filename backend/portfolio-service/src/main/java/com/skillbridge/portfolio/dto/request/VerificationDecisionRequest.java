package com.skillbridge.portfolio.dto.request;

import jakarta.validation.constraints.NotBlank;

public record VerificationDecisionRequest(
        @NotBlank(message = "decision is required") String decision,
        String reviewerNote
) {}
