package com.skillbridge.mentorship.dto.response;

import com.skillbridge.mentorship.entity.PairStatus;

import java.time.Instant;
import java.util.UUID;

public record PairResponse(
        UUID id,
        UUID studentId,
        UUID alumniId,
        PairStatus status,
        Instant startedAt,
        Instant endedAt
) {
}
