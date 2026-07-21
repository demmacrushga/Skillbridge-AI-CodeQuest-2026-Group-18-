package com.skillbridge.mentorship.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UpsertProfileRequest(
        @Size(max = 150) String currentRole,
        @Size(max = 150) String company,
        @Size(max = 100) String industry,
        @NotEmpty @Size(max = 20) List<@NotBlank @Size(max = 50) String> careerInterests,
        @Size(max = 2000) String bio,
        @NotNull Boolean available
) {
}
