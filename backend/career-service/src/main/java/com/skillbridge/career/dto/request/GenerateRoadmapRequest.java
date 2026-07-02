package com.skillbridge.career.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.util.List;

public record GenerateRoadmapRequest(
        @NotBlank(message = "careerPath is required")
        String careerPath,

        @NotBlank(message = "academicLevel is required")
        @Pattern(regexp = "Level [1-4]00", message = "academicLevel must be Level 100, 200, 300, or 400")
        String academicLevel,

        @NotNull(message = "currentSkills is required")
        List<String> currentSkills
) {}
