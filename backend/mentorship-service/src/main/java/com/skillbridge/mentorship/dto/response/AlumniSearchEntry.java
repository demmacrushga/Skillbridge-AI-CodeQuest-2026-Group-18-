package com.skillbridge.mentorship.dto.response;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AlumniSearchEntry(
        UUID alumniId,
        String currentRole,
        String company,
        String industry,
        List<String> careerInterests,
        String bio,
        int matchingTags,
        Instant updatedAt
) {
}
