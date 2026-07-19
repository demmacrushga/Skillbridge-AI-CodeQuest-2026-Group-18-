package com.skillbridge.challenge.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record ScoreSubmissionRequest(
        @NotNull
        @DecimalMin(value = "0.00", message = "score must be at least 0.00")
        @DecimalMax(value = "100.00", message = "score must be at most 100.00")
        @Digits(integer = 3, fraction = 2, message = "score must have at most 2 decimal places")
        BigDecimal score) {
}
