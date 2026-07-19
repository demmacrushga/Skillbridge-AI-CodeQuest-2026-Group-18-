package com.skillbridge.matching.dto.response;

import java.time.Instant;
import java.util.UUID;

public record ApplicationResponse(
        UUID id,
        UUID opportunityId,
        Instant appliedAt,
        String externalUrl) {
}
