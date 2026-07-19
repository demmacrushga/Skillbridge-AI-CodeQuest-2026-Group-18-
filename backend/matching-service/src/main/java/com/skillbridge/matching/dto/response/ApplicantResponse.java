package com.skillbridge.matching.dto.response;

import java.time.Instant;
import java.util.UUID;

public record ApplicantResponse(
        UUID studentId,
        Instant appliedAt) {
}
