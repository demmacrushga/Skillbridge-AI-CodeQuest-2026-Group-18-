package com.skillbridge.skillgap.dto.response;

import java.util.UUID;

public record RecommendationResponse(UUID id, String type, String title, String url) {
}
