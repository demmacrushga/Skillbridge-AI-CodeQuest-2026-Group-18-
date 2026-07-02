package com.skillbridge.skillgap.service;

import com.skillbridge.skillgap.dto.response.ReportResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

public interface SkillGapService {

    ReportResponse analyseCV(MultipartFile file, String targetRole, UUID userId);

    ReportResponse getReport(UUID reportId, UUID userId);

    List<ReportResponse> getUserReports(UUID userId);

    void deleteReport(UUID reportId, UUID userId);
}
