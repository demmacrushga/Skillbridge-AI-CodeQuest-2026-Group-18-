package com.skillbridge.portfolio.service.dto;

public record ExtractedItemTemplate(
        String itemType,
        String title,
        String description,
        String externalUrl,
        double confidence
) {}
