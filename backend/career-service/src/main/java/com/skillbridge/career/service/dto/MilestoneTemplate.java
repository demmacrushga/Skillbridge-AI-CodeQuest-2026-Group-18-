package com.skillbridge.career.service.dto;

import com.skillbridge.career.enums.MilestoneType;

public record MilestoneTemplate(
        int semester,
        String title,
        String description,
        MilestoneType milestoneType,
        int displayOrder
) {}
