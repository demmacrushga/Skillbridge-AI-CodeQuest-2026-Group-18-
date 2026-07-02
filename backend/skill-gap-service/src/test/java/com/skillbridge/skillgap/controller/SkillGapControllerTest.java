package com.skillbridge.skillgap.controller;

import com.skillbridge.skillgap.dto.response.RecommendationResponse;
import com.skillbridge.skillgap.dto.response.ReportResponse;
import com.skillbridge.skillgap.dto.response.SkillGapResponse;
import com.skillbridge.skillgap.exception.AiServiceException;
import com.skillbridge.skillgap.exception.ReportNotFoundException;
import com.skillbridge.skillgap.exception.UnsupportedFileTypeException;
import com.skillbridge.skillgap.security.JwtService;
import com.skillbridge.skillgap.security.JwtUserDetails;
import com.skillbridge.skillgap.service.SkillGapService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SkillGapController.class)
@AutoConfigureMockMvc(addFilters = false)
class SkillGapControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean SkillGapService skillGapService;
    @MockBean JwtService jwtService;

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID REPORT_ID = UUID.randomUUID();

    private static final ReportResponse SAMPLE_REPORT = new ReportResponse(
            REPORT_ID,
            "Backend Developer",
            List.of(new SkillGapResponse(
                    UUID.randomUUID(), "Java", 1, "Needs Java",
                    List.of(new RecommendationResponse(UUID.randomUUID(), "COURSE", "Java Basics", "https://example.com"))))
    );

    @BeforeEach
    void setUpAuth() {
        JwtUserDetails principal = new JwtUserDetails(USER_ID, "student@knust.edu.gh", "STUDENT");
        var auth = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void analyseCV_validRequest_returns201() throws Exception {
        when(skillGapService.analyseCV(any(), eq("Backend Developer"), eq(USER_ID)))
                .thenReturn(SAMPLE_REPORT);

        MockMultipartFile file = new MockMultipartFile(
                "file", "cv.pdf", "application/pdf", "pdf-bytes".getBytes());

        mockMvc.perform(multipart("/skill-gap/analyse")
                        .file(file)
                        .param("targetRole", "Backend Developer"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.reportId").exists())
                .andExpect(jsonPath("$.targetRole").value("Backend Developer"))
                .andExpect(jsonPath("$.gaps").isArray())
                .andExpect(jsonPath("$.gaps[0].skillName").value("Java"));
    }

    @Test
    void analyseCV_missingTargetRole_returns400() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "cv.pdf", "application/pdf", "pdf-bytes".getBytes());

        mockMvc.perform(multipart("/skill-gap/analyse")
                        .file(file))
                .andExpect(status().isBadRequest());
    }

    @Test
    void analyseCV_aiUnavailable_returns503() throws Exception {
        when(skillGapService.analyseCV(any(), any(), any()))
                .thenThrow(new AiServiceException("AI service unavailable"));

        MockMultipartFile file = new MockMultipartFile(
                "file", "cv.pdf", "application/pdf", "pdf-bytes".getBytes());

        mockMvc.perform(multipart("/skill-gap/analyse")
                        .file(file)
                        .param("targetRole", "Backend Developer"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value(503));
    }

    @Test
    void analyseCV_unsupportedFileType_returns422() throws Exception {
        when(skillGapService.analyseCV(any(), any(), any()))
                .thenThrow(new UnsupportedFileTypeException("Unsupported type"));

        MockMultipartFile file = new MockMultipartFile(
                "file", "cv.txt", "text/plain", "text".getBytes());

        mockMvc.perform(multipart("/skill-gap/analyse")
                        .file(file)
                        .param("targetRole", "Backend Developer"))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void getReport_existingReport_returns200() throws Exception {
        when(skillGapService.getReport(eq(REPORT_ID), eq(USER_ID))).thenReturn(SAMPLE_REPORT);

        mockMvc.perform(get("/skill-gap/reports/{reportId}", REPORT_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reportId").value(REPORT_ID.toString()))
                .andExpect(jsonPath("$.gaps").isArray());
    }

    @Test
    void getReport_notFound_returns404() throws Exception {
        when(skillGapService.getReport(any(), any()))
                .thenThrow(new ReportNotFoundException("Not found"));

        mockMvc.perform(get("/skill-gap/reports/{reportId}", REPORT_ID))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void getUserReports_emptyList_returns200() throws Exception {
        when(skillGapService.getUserReports(eq(USER_ID))).thenReturn(List.of());

        mockMvc.perform(get("/skill-gap/reports"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    void deleteReport_validRequest_returns204() throws Exception {
        mockMvc.perform(delete("/skill-gap/reports/{reportId}", REPORT_ID))
                .andExpect(status().isNoContent());

        verify(skillGapService).deleteReport(eq(REPORT_ID), eq(USER_ID));
    }

    @Test
    void deleteReport_notFound_returns404() throws Exception {
        doThrow(new ReportNotFoundException("Not found"))
                .when(skillGapService).deleteReport(any(), any());

        mockMvc.perform(delete("/skill-gap/reports/{reportId}", REPORT_ID))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void health_returns200WithStatusUp() throws Exception {
        mockMvc.perform(get("/skill-gap/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }
}
