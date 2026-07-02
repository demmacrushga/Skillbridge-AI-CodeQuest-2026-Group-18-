package com.skillbridge.skillgap.dto.response;

import java.util.List;
import java.util.UUID;

public record ReportResponse(UUID reportId, String targetRole, List<SkillGapResponse> gaps) {
}
