package com.skillbridge.mentorship.dto.response;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ProfileResponse(
        UUID id,
        UUID userId,
        String currentRole,
        String company,
        String industry,
        List<String> careerInterests,
        String bio,
        boolean available,
        Instant updatedAt
) {
}
