package com.skillbridge.matching.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SkillRequirementRequest(
        @NotBlank @Size(max = 150) String skillName,
        boolean required) {
}
