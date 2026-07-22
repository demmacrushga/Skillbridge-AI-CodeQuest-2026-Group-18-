package com.skillbridge.career.dto.request;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.util.List;
import java.util.Set;

public record GenerateRoadmapRequest(
        @NotBlank(message = "careerPath is required")
        String careerPath,

        @NotBlank(message = "academicLevel is required")
        String academicLevel,

        @NotNull(message = "currentSkills is required")
        List<String> currentSkills,

        @NotBlank(message = "role is required")
        @Pattern(regexp = "STUDENT|ALUMNI|RECRUITER", message = "role must be STUDENT, ALUMNI, or RECRUITER")
        String role
) {
    private static final Set<String> STUDENT_LEVELS = Set.of("Level 100", "Level 200", "Level 300", "Level 400");
    private static final Set<String> ALUMNI_LEVELS = Set.of("Recent Graduate", "Early Career", "Mid Career", "Career Changer");

    @AssertTrue(message = "Invalid academicLevel for the given role")
    public boolean isValidLevelForRole() {
        if (role == null || academicLevel == null) {
            return true; // let @NotBlank handle missing values
        }
        return switch (role) {
            case "STUDENT" -> STUDENT_LEVELS.contains(academicLevel);
            case "ALUMNI" -> ALUMNI_LEVELS.contains(academicLevel);
            default -> true; // RECRUITER does not generate roadmaps
        };
    }
}
