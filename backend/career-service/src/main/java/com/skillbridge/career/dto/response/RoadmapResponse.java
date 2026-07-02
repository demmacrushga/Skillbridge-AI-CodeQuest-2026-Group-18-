package com.skillbridge.career.dto.response;

import java.util.List;
import java.util.UUID;

public record RoadmapResponse(
        UUID roadmapId,
        String careerPath,
        int progressPercent,
        List<MilestoneResponse> milestones
) {}
