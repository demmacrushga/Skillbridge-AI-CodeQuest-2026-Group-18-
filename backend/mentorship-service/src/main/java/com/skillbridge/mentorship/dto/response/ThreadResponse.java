package com.skillbridge.mentorship.dto.response;

import com.skillbridge.mentorship.entity.PairStatus;

import java.util.List;
import java.util.UUID;

public record ThreadResponse(
        UUID pairId,
        PairStatus status,
        List<MessageResponse> messages
) {
}
