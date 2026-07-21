package com.skillbridge.mentorship.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record SendRequestRequest(
        @NotNull UUID alumniId,
        @Size(max = 1000) String message
) {
}
