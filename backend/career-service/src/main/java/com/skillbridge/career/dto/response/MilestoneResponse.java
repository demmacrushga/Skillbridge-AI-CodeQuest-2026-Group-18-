package com.skillbridge.career.dto.response;

import java.util.UUID;

public record MilestoneResponse(
        UUID id,
        int semester,
        String title,
        String description,
        String type,
        int order,
        boolean completed
) {}
