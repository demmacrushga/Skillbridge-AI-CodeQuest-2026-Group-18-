package com.skillbridge.skillgap.service.dto;

import java.util.List;

public record SkillGapTemplate(
        String skillName,
        int importanceRank,
        String description,
        List<RecommendationTemplate> recommendations) {
}
