package com.skillbridge.matching.dto.response;

import java.time.Instant;
import java.util.UUID;

public record ApplicationWithOpportunityResponse(
        UUID id,
        Instant appliedAt,
        OpportunityResponse opportunity) {
}
