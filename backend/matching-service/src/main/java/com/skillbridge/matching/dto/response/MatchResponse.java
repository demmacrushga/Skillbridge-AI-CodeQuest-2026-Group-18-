package com.skillbridge.matching.dto.response;

import java.math.BigDecimal;

public record MatchResponse(
        OpportunityResponse opportunity,
        BigDecimal matchScore,
        int rank,
        boolean applied) {
}
