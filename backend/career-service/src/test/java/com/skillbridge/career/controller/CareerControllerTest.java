package com.skillbridge.career.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillbridge.career.dto.request.CompleteMilestoneRequest;
import com.skillbridge.career.dto.request.GenerateRoadmapRequest;
import com.skillbridge.career.dto.response.CareerPathResponse;
import com.skillbridge.career.dto.response.CompletionResponse;
import com.skillbridge.career.dto.response.MilestoneResponse;
import com.skillbridge.career.dto.response.RoadmapResponse;
import com.skillbridge.career.exception.AiServiceException;
import com.skillbridge.career.exception.CareerPathNotFoundException;
import com.skillbridge.career.exception.MilestoneNotFoundException;
import com.skillbridge.career.exception.RoadmapNotFoundException;
import com.skillbridge.career.security.JwtService;
import com.skillbridge.career.security.JwtUserDetails;
import com.skillbridge.career.service.CareerService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(CareerController.class)
@AutoConfigureMockMvc(addFilters = false)
class CareerControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @MockBean CareerService careerService;
    @MockBean JwtService jwtService;

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID MILESTONE_ID = UUID.randomUUID();
    private static final UUID ROADMAP_ID = UUID.randomUUID();
    private static final UUID PATH_ID = UUID.randomUUID();

    private static final MilestoneResponse SAMPLE_MILESTONE = new MilestoneResponse(
            MILESTONE_ID, 1, "Learn Java", "Core Java fundamentals", "SKILL", 1, false);

    private static final RoadmapResponse SAMPLE_ROADMAP = new RoadmapResponse(
            ROADMAP_ID, "Software Engineer", 0, List.of(SAMPLE_MILESTONE));

    private static final CompletionResponse SAMPLE_COMPLETION = new CompletionResponse(
            new MilestoneResponse(MILESTONE_ID, 1, "Learn Java", "Core Java fundamentals", "SKILL", 1, true), 10);

    @BeforeEach
    void setUpSecurityContext() {
        JwtUserDetails principal = new JwtUserDetails(USER_ID, "test@knust.edu.gh", "STUDENT");
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    // --- generateRoadmap ---

    @Test
    void generateRoadmap_validRequest_returns201() throws Exception {
        when(careerService.generateRoadmap(any(), any())).thenReturn(SAMPLE_ROADMAP);

        mockMvc.perform(post("/career/roadmap/generate")

                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new GenerateRoadmapRequest("Software Engineer", "Level 200", List.of("Python"), "STUDENT"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.roadmapId").exists())
                .andExpect(jsonPath("$.careerPath").value("Software Engineer"))
                .andExpect(jsonPath("$.milestones").isArray());
    }

    @Test
    void generateRoadmap_unknownCareerPath_returns404() throws Exception {
        when(careerService.generateRoadmap(any(), any()))
                .thenThrow(new CareerPathNotFoundException("Unknown"));

        mockMvc.perform(post("/career/roadmap/generate")

                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new GenerateRoadmapRequest("Unknown", "Level 100", List.of(), "STUDENT"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void generateRoadmap_aiUnavailable_returns503() throws Exception {
        when(careerService.generateRoadmap(any(), any()))
                .thenThrow(new AiServiceException("AI service unavailable"));

        mockMvc.perform(post("/career/roadmap/generate")

                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new GenerateRoadmapRequest("Software Engineer", "Level 100", List.of(), "STUDENT"))))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value(503));
    }

    @Test
    void generateRoadmap_missingCareerPath_returns422() throws Exception {
        mockMvc.perform(post("/career/roadmap/generate")

                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"academicLevel\":\"Level 100\",\"currentSkills\":[]}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors").isArray());
    }

    @Test
    void generateRoadmap_invalidAcademicLevel_returns422() throws Exception {
        mockMvc.perform(post("/career/roadmap/generate")

                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new GenerateRoadmapRequest("Software Engineer", "Year 1", List.of(), "STUDENT"))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors").isArray());
    }

    @Test
    void generateRoadmap_roleMismatch_returns403() throws Exception {
        mockMvc.perform(post("/career/roadmap/generate")

                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new GenerateRoadmapRequest("Software Engineer", "Early Career", List.of("Python"), "ALUMNI"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void generateRoadmap_alumniValidRequest_returns201() throws Exception {
        JwtUserDetails alumniPrincipal = new JwtUserDetails(USER_ID, "test@knust.edu.gh", "ALUMNI");
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(alumniPrincipal, null, alumniPrincipal.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);

        when(careerService.generateRoadmap(any(), any())).thenReturn(SAMPLE_ROADMAP);

        mockMvc.perform(post("/career/roadmap/generate")

                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new GenerateRoadmapRequest("Software Engineer", "Early Career", List.of("Python"), "ALUMNI"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.careerPath").value("Software Engineer"));
    }

    // --- getRoadmap ---

    @Test
    void getRoadmap_existingUser_returns200() throws Exception {
        when(careerService.getRoadmap(eq(USER_ID), any())).thenReturn(SAMPLE_ROADMAP);

        mockMvc.perform(get("/career/roadmap/{userId}", USER_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.progressPercent").value(0))
                .andExpect(jsonPath("$.milestones").isArray());
    }

    @Test
    void getRoadmap_notFound_returns404() throws Exception {
        when(careerService.getRoadmap(any(), any()))
                .thenThrow(new RoadmapNotFoundException("No roadmap"));

        mockMvc.perform(get("/career/roadmap/{userId}", USER_ID))
                .andExpect(status().isNotFound());
    }

    // --- completeMilestone ---

    @Test
    void completeMilestone_valid_returns200WithProgress() throws Exception {
        when(careerService.completeMilestone(eq(MILESTONE_ID), any(), any())).thenReturn(SAMPLE_COMPLETION);

        mockMvc.perform(patch("/career/milestones/{id}/complete", MILESTONE_ID)

                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CompleteMilestoneRequest("Done it"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.progressPercent").value(10))
                .andExpect(jsonPath("$.milestone.completed").value(true));
    }

    @Test
    void completeMilestone_notFound_returns404() throws Exception {
        when(careerService.completeMilestone(any(), any(), any()))
                .thenThrow(new MilestoneNotFoundException("Not found"));

        mockMvc.perform(patch("/career/milestones/{id}/complete", MILESTONE_ID)

                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void completeMilestone_alreadyCompleted_returns409() throws Exception {
        when(careerService.completeMilestone(any(), any(), any()))
                .thenThrow(new DataIntegrityViolationException("duplicate"));

        mockMvc.perform(patch("/career/milestones/{id}/complete", MILESTONE_ID)

                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    // --- getCareerPaths (public — no auth needed) ---

    @Test
    void getCareerPaths_noAuth_returns200() throws Exception {
        when(careerService.getCareerPaths()).thenReturn(List.of(
                new CareerPathResponse(PATH_ID, "Software Engineer", "Build software")));

        mockMvc.perform(get("/career/paths"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Software Engineer"));
    }
}
