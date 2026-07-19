package com.skillbridge.matching.dto.request;

import com.skillbridge.matching.enums.OpportunityType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

public record PostOpportunityRequest(
        @NotBlank @Size(max = 255) String title,
        @NotBlank @Size(max = 255) String companyName,
        @NotBlank @Size(max = 5000) String description,
        @Size(max = 255) String location,
        @NotNull OpportunityType opportunityType,
        @FutureOrPresent LocalDate deadline,
        @Pattern(regexp = "^https?://.*", message = "must be a valid http/https URL")
        @Size(max = 2048) String externalUrl,
        @NotEmpty @Size(max = 30) List<@Valid SkillRequirementRequest> requiredSkills) {
}
