package com.skillbridge.portfolio.dto.response;

public record ExtractedItemResponse(
        String itemType,
        String title,
        String description,
        String externalUrl,
        double confidence
) {}
