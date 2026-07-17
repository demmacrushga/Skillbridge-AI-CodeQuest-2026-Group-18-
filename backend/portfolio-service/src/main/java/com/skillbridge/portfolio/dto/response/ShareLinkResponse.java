package com.skillbridge.portfolio.dto.response;

import java.time.Instant;

public record ShareLinkResponse(
        String shareToken,
        String shareUrl,
        boolean active,
        Instant createdAt
) {}
