package com.skillbridge.matching.dto.response;

import com.skillbridge.matching.enums.OpportunityType;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record OpportunityResponse(
        UUID id,
        String title,
        String companyName,
        String description,
        String location,
        OpportunityType opportunityType,
        LocalDate deadline,
        String externalUrl,
        boolean active,
        Instant createdAt,
        List<SkillRequirementDto> requiredSkills,
        Long applicantCount) {

    public record SkillRequirementDto(String skillName, boolean required) {
    }
}
