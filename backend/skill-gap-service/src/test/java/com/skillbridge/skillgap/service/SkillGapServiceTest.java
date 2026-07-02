package com.skillbridge.skillgap.service;

import com.skillbridge.skillgap.dto.response.ReportResponse;
import com.skillbridge.skillgap.entity.CvUpload;
import com.skillbridge.skillgap.entity.GapReport;
import com.skillbridge.skillgap.entity.ResourceRecommendation;
import com.skillbridge.skillgap.entity.SkillGap;
import com.skillbridge.skillgap.exception.AiServiceException;
import com.skillbridge.skillgap.exception.ReportNotFoundException;
import com.skillbridge.skillgap.exception.UnsupportedFileTypeException;
import com.skillbridge.skillgap.repository.CvUploadRepository;
import com.skillbridge.skillgap.repository.GapReportRepository;
import com.skillbridge.skillgap.service.dto.RecommendationTemplate;
import com.skillbridge.skillgap.service.dto.SkillGapTemplate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SkillGapServiceTest {

    @Mock FileParserService fileParserService;
    @Mock ClaudeService claudeService;
    @Mock UrlVerifierService urlVerifierService;
    @Mock CvUploadRepository cvUploadRepository;
    @Mock GapReportRepository gapReportRepository;
    @Mock MultipartFile mockFile;

    SkillGapServiceImpl service;

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID REPORT_ID = UUID.randomUUID();

    private static final List<SkillGapTemplate> SAMPLE_GAPS = List.of(
            new SkillGapTemplate("Java", 1, "Lacks Java experience",
                    List.of(new RecommendationTemplate("COURSE", "Java Basics", "https://example.com")))
    );

    @BeforeEach
    void setUp() {
        service = new SkillGapServiceImpl(fileParserService, claudeService, urlVerifierService, cvUploadRepository, gapReportRepository);
    }

    @Test
    void analyseCV_happyPath_returnsReportResponse() {
        when(fileParserService.extractText(any())).thenReturn("CV text here");
        when(cvUploadRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(claudeService.analyseGaps(any(), any())).thenReturn(SAMPLE_GAPS);
        when(urlVerifierService.stripBrokenUrls(any())).thenAnswer(inv -> inv.getArgument(0));
        when(gapReportRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ReportResponse response = service.analyseCV(mockFile, "Backend Developer", USER_ID);

        assertThat(response.targetRole()).isEqualTo("Backend Developer");
        assertThat(response.gaps()).hasSize(1);
        assertThat(response.gaps().get(0).skillName()).isEqualTo("Java");
        assertThat(response.gaps().get(0).recommendations()).hasSize(1);
    }

    @Test
    void analyseCV_claudeFails_setsStatusFailedAndRethrows() {
        when(fileParserService.extractText(any())).thenReturn("CV text");
        when(cvUploadRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(claudeService.analyseGaps(any(), any())).thenThrow(new AiServiceException("AI service unavailable"));

        ArgumentCaptor<CvUpload> uploadCaptor = ArgumentCaptor.forClass(CvUpload.class);

        assertThatThrownBy(() -> service.analyseCV(mockFile, "Backend Developer", USER_ID))
                .isInstanceOf(AiServiceException.class);

        verify(cvUploadRepository, atLeast(2)).save(uploadCaptor.capture());
        List<CvUpload> saves = uploadCaptor.getAllValues();
        assertThat(saves).anyMatch(u -> "FAILED".equals(u.getStatus()));
    }

    @Test
    void analyseCV_unsupportedFileType_throwsBeforePersisting() {
        when(fileParserService.extractText(any()))
                .thenThrow(new UnsupportedFileTypeException("Unsupported type"));

        assertThatThrownBy(() -> service.analyseCV(mockFile, "Backend Developer", USER_ID))
                .isInstanceOf(UnsupportedFileTypeException.class);

        verify(cvUploadRepository, never()).save(any());
    }

    @Test
    void getReport_existingReport_returnsResponse() {
        GapReport report = buildSampleReport();
        when(gapReportRepository.findByIdAndUserId(REPORT_ID, USER_ID))
                .thenReturn(Optional.of(report));

        ReportResponse response = service.getReport(REPORT_ID, USER_ID);

        assertThat(response.targetRole()).isEqualTo("Data Scientist");
        assertThat(response.gaps()).hasSize(1);
    }

    @Test
    void getReport_notFound_throwsReportNotFoundException() {
        when(gapReportRepository.findByIdAndUserId(any(), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getReport(REPORT_ID, USER_ID))
                .isInstanceOf(ReportNotFoundException.class);
    }

    @Test
    void getUserReports_multipleReports_returnsList() {
        when(gapReportRepository.findByUserIdWithGaps(USER_ID))
                .thenReturn(List.of(buildSampleReport(), buildSampleReport()));

        List<ReportResponse> responses = service.getUserReports(USER_ID);

        assertThat(responses).hasSize(2);
    }

    @Test
    void getUserReports_noReports_returnsEmptyList() {
        when(gapReportRepository.findByUserIdWithGaps(USER_ID)).thenReturn(List.of());

        List<ReportResponse> responses = service.getUserReports(USER_ID);

        assertThat(responses).isEmpty();
    }

    @Test
    void deleteReport_happyPath_deletesReportAndCvUpload() {
        CvUpload cvUpload = new CvUpload();
        GapReport report = new GapReport();
        report.setCvUpload(cvUpload);

        when(gapReportRepository.findByIdAndUserId(REPORT_ID, USER_ID))
                .thenReturn(Optional.of(report));

        service.deleteReport(REPORT_ID, USER_ID);

        verify(gapReportRepository).delete(report);
        verify(cvUploadRepository).delete(cvUpload);
    }

    @Test
    void deleteReport_reportNotFound_throwsReportNotFoundException() {
        when(gapReportRepository.findByIdAndUserId(any(), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deleteReport(REPORT_ID, USER_ID))
                .isInstanceOf(ReportNotFoundException.class);

        verify(gapReportRepository, never()).delete(any(GapReport.class));
        verify(cvUploadRepository, never()).delete(any());
    }

    @Test
    void deleteReport_wrongUserId_throwsReportNotFoundException() {
        UUID wrongUserId = UUID.randomUUID();
        when(gapReportRepository.findByIdAndUserId(REPORT_ID, wrongUserId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deleteReport(REPORT_ID, wrongUserId))
                .isInstanceOf(ReportNotFoundException.class);
    }

    private GapReport buildSampleReport() {
        CvUpload upload = new CvUpload();
        upload.setUserId(USER_ID);
        upload.setFileName("cv.pdf");
        upload.setFileType("application/pdf");
        upload.setStoragePath("/uploads/cv.pdf");
        upload.setStatus("COMPLETED");

        GapReport report = new GapReport();
        report.setCvUpload(upload);
        report.setUserId(USER_ID);
        report.setTargetRole("Data Scientist");

        SkillGap gap = new SkillGap();
        gap.setReport(report);
        gap.setSkillName("Python");
        gap.setImportanceRank(1);
        gap.setGapDescription("Needs Python skills");

        ResourceRecommendation rec = new ResourceRecommendation();
        rec.setSkillGap(gap);
        rec.setResourceType("COURSE");
        rec.setTitle("Python for Data Science");
        rec.setUrl("https://example.com");
        gap.getRecommendations().add(rec);

        report.getSkillGaps().add(gap);
        return report;
    }
}
