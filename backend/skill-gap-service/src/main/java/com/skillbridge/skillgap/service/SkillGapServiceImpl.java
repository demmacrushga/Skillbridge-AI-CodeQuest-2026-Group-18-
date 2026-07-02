package com.skillbridge.skillgap.service;

import com.skillbridge.skillgap.dto.response.RecommendationResponse;
import com.skillbridge.skillgap.dto.response.ReportResponse;
import com.skillbridge.skillgap.dto.response.SkillGapResponse;
import com.skillbridge.skillgap.entity.CvUpload;
import com.skillbridge.skillgap.entity.GapReport;
import com.skillbridge.skillgap.entity.ResourceRecommendation;
import com.skillbridge.skillgap.entity.SkillGap;
import com.skillbridge.skillgap.exception.AiServiceException;
import com.skillbridge.skillgap.exception.ReportNotFoundException;
import com.skillbridge.skillgap.repository.CvUploadRepository;
import com.skillbridge.skillgap.repository.GapReportRepository;
import com.skillbridge.skillgap.service.dto.RecommendationTemplate;
import com.skillbridge.skillgap.service.dto.SkillGapTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@Service
public class SkillGapServiceImpl implements SkillGapService {

    private static final Logger log = LoggerFactory.getLogger(SkillGapServiceImpl.class);

    private final FileParserService fileParserService;
    private final ClaudeService claudeService;
    private final UrlVerifierService urlVerifierService;
    private final CvUploadRepository cvUploadRepository;
    private final GapReportRepository gapReportRepository;

    public SkillGapServiceImpl(
            FileParserService fileParserService,
            ClaudeService claudeService,
            UrlVerifierService urlVerifierService,
            CvUploadRepository cvUploadRepository,
            GapReportRepository gapReportRepository) {
        this.fileParserService = fileParserService;
        this.claudeService = claudeService;
        this.urlVerifierService = urlVerifierService;
        this.cvUploadRepository = cvUploadRepository;
        this.gapReportRepository = gapReportRepository;
    }

    @Override
    @Transactional
    public ReportResponse analyseCV(MultipartFile file, String targetRole, UUID userId) {
        String extractedText = fileParserService.extractText(file);

        CvUpload cvUpload = new CvUpload();
        cvUpload.setUserId(userId);
        cvUpload.setFileName(file.getOriginalFilename());
        cvUpload.setFileType(file.getContentType());
        cvUpload.setExtractedText(extractedText);
        cvUpload.setStatus("PROCESSING");
        cvUploadRepository.save(cvUpload);

        List<SkillGapTemplate> gapTemplates;
        try {
            List<SkillGapTemplate> raw = claudeService.analyseGaps(extractedText, targetRole);
            gapTemplates = urlVerifierService.stripBrokenUrls(raw);
        } catch (AiServiceException e) {
            cvUpload.setStatus("FAILED");
            cvUploadRepository.save(cvUpload);
            log.error("AI analysis failed for userId={} targetRole={}", userId, targetRole, e);
            throw e;
        }

        GapReport report = new GapReport();
        report.setCvUpload(cvUpload);
        report.setUserId(userId);
        report.setTargetRole(targetRole);

        for (SkillGapTemplate gapTemplate : gapTemplates) {
            SkillGap skillGap = new SkillGap();
            skillGap.setReport(report);
            skillGap.setSkillName(gapTemplate.skillName());
            skillGap.setImportanceRank(gapTemplate.importanceRank());
            skillGap.setGapDescription(gapTemplate.description());

            for (RecommendationTemplate recTemplate : gapTemplate.recommendations()) {
                ResourceRecommendation rec = new ResourceRecommendation();
                rec.setSkillGap(skillGap);
                rec.setResourceType(recTemplate.type());
                rec.setTitle(recTemplate.title());
                rec.setUrl(recTemplate.url());
                skillGap.getRecommendations().add(rec);
            }
            report.getSkillGaps().add(skillGap);
        }

        gapReportRepository.save(report);

        cvUpload.setStatus("COMPLETED");
        cvUploadRepository.save(cvUpload);

        log.info("CV analysis completed: reportId={} userId={} targetRole={} gaps={}",
                report.getId(), userId, targetRole, gapTemplates.size());

        return toReportResponse(report);
    }

    @Override
    @Transactional(readOnly = true)
    public ReportResponse getReport(UUID reportId, UUID userId) {
        GapReport report = gapReportRepository.findByIdAndUserId(reportId, userId)
                .orElseThrow(() -> new ReportNotFoundException(
                        "Report not found: " + reportId));
        return toReportResponse(report);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReportResponse> getUserReports(UUID userId) {
        return gapReportRepository.findByUserIdWithGaps(userId)
                .stream()
                .map(this::toReportResponse)
                .toList();
    }

    @Override
    @Transactional
    public void deleteReport(UUID reportId, UUID userId) {
        GapReport report = gapReportRepository.findByIdAndUserId(reportId, userId)
                .orElseThrow(() -> new ReportNotFoundException("Report not found: " + reportId));
        CvUpload cvUpload = report.getCvUpload();
        gapReportRepository.delete(report);
        cvUploadRepository.delete(cvUpload);
    }

    private ReportResponse toReportResponse(GapReport report) {
        List<SkillGapResponse> gaps = report.getSkillGaps().stream()
                .map(sg -> new SkillGapResponse(
                        sg.getId(),
                        sg.getSkillName(),
                        sg.getImportanceRank(),
                        sg.getGapDescription(),
                        sg.getRecommendations().stream()
                                .map(r -> new RecommendationResponse(
                                        r.getId(),
                                        r.getResourceType(),
                                        r.getTitle(),
                                        r.getUrl()))
                                .toList()))
                .toList();

        return new ReportResponse(report.getId(), report.getTargetRole(), gaps);
    }
}
