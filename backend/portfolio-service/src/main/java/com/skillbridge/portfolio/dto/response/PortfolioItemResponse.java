package com.skillbridge.portfolio.dto.response;

import java.time.Instant;
import java.util.UUID;

public record PortfolioItemResponse(
        UUID id,
        UUID userId,
        String itemType,
        String title,
        String description,
        String externalUrl,
        boolean verified,
        String verificationStatus,
        int displayOrder,
        Instant createdAt
) {}
