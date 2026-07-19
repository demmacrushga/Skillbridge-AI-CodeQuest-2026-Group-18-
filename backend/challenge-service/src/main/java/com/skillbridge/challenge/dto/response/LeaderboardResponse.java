package com.skillbridge.challenge.dto.response;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record LeaderboardResponse(
        UUID challengeId,
        List<Entry> entries) {

    public record Entry(int rank, UUID studentId, BigDecimal score) {
    }
}
