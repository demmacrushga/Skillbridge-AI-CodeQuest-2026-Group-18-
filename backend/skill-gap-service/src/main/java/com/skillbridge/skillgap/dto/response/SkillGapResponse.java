package com.skillbridge.skillgap.dto.response;

import java.util.List;
import java.util.UUID;

public record SkillGapResponse(
        UUID id,
        String skillName,
        int importanceRank,
        String description,
        List<RecommendationResponse> recommendations) {
}
