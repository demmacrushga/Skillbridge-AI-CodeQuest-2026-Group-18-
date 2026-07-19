package com.skillbridge.matching.controller;

import com.skillbridge.matching.config.SecurityConfig;
import com.skillbridge.matching.dto.response.ApplicantResponse;
import com.skillbridge.matching.dto.response.ApplicationResponse;
import com.skillbridge.matching.dto.response.ApplicationWithOpportunityResponse;
import com.skillbridge.matching.dto.response.MatchListResponse;
import com.skillbridge.matching.dto.response.MatchResponse;
import com.skillbridge.matching.dto.response.OpportunityResponse;
import com.skillbridge.matching.dto.response.SkillsResponse;
import com.skillbridge.matching.enums.OpportunityType;
import com.skillbridge.matching.exception.DuplicateApplicationException;
import com.skillbridge.matching.exception.OpportunityNotFoundException;
import com.skillbridge.matching.security.JwtService;
import com.skillbridge.matching.security.JwtUserDetails;
import com.skillbridge.matching.service.MatchingService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(MatchingController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(SecurityConfig.class)
class MatchingControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean MatchingService matchingService;
    @MockBean JwtService jwtService;

    private static final UUID STUDENT_ID = UUID.randomUUID();
    private static final UUID RECRUITER_ID = UUID.randomUUID();
    private static final UUID OPP_ID = UUID.randomUUID();
    private static final Instant NOW = Instant.parse("2026-07-18T10:00:00Z");

    private static final OpportunityResponse SAMPLE_OPP = new OpportunityResponse(
            OPP_ID, "SE Intern", "Hubtel", "Backend team", "Accra",
            OpportunityType.INTERNSHIP, LocalDate.parse("2026-12-31"),
            "https://hubtel.com/careers/x", true, NOW,
            List.of(new OpportunityResponse.SkillRequirementDto("Java", true),
                    new OpportunityResponse.SkillRequirementDto("PostgreSQL", false)),
            null);

    private void authenticate(UUID userId, String role) {
        JwtUserDetails principal = new JwtUserDetails(userId, "user@knust.edu.gh", role);
        var auth = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    private static final String VALID_POST_BODY = """
            {
              "title": "SE Intern",
              "companyName": "Hubtel",
              "description": "Backend team",
              "location": "Accra",
              "opportunityType": "INTERNSHIP",
              "deadline": "2099-12-31",
              "externalUrl": "https://hubtel.com/careers/x",
              "requiredSkills": [
                {"skillName": "Java", "required": true},
                {"skillName": "PostgreSQL", "required": false}
              ]
            }
            """;

    // ── health ─────────────────────────────────────────────────────────

    @Test
    void health_returnsUp() throws Exception {
        mockMvc.perform(get("/matching/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    // ── US1: POST /opportunities ───────────────────────────────────────

    @Test
    void postOpportunity_recruiter_returns201() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");
        when(matchingService.postOpportunity(any(), eq(RECRUITER_ID))).thenReturn(SAMPLE_OPP);

        mockMvc.perform(post("/matching/opportunities")
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_POST_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("SE Intern"))
                .andExpect(jsonPath("$.externalUrl").value("https://hubtel.com/careers/x"))
                .andExpect(jsonPath("$.requiredSkills", hasSize(2)));
    }

    @Test
    void postOpportunity_student_returns403() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");

        mockMvc.perform(post("/matching/opportunities")
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_POST_BODY))
                .andExpect(status().isForbidden());
    }

    @Test
    void postOpportunity_blankTitle_returns400() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");
        String body = VALID_POST_BODY.replace("\"SE Intern\"", "\"  \"");

        mockMvc.perform(post("/matching/opportunities")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void postOpportunity_lowercaseType_returns400() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");
        String body = VALID_POST_BODY.replace("\"INTERNSHIP\"", "\"internship\"");

        mockMvc.perform(post("/matching/opportunities")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void postOpportunity_emptySkills_returns400() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");
        String body = """
                {"title":"SE Intern","companyName":"Hubtel","description":"Backend team",
                 "opportunityType":"INTERNSHIP","requiredSkills":[]}
                """;

        mockMvc.perform(post("/matching/opportunities")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void postOpportunity_pastDeadline_returns400() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");
        String body = VALID_POST_BODY.replace("2099-12-31", "2020-01-01");

        mockMvc.perform(post("/matching/opportunities")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void postOpportunity_malformedExternalUrl_returns400() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");
        String body = VALID_POST_BODY.replace("https://hubtel.com/careers/x", "not-a-url");

        mockMvc.perform(post("/matching/opportunities")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
    }

    // ── US2: GET /opportunities ────────────────────────────────────────

    @Test
    void getMatches_returnsRankedList() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        MatchResponse match = new MatchResponse(SAMPLE_OPP, new BigDecimal("80.00"), 1, false);
        when(matchingService.getMatches(STUDENT_ID))
                .thenReturn(new MatchListResponse(List.of(match)));

        mockMvc.perform(get("/matching/opportunities"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matches", hasSize(1)))
                .andExpect(jsonPath("$.matches[0].matchScore").value(80.00))
                .andExpect(jsonPath("$.matches[0].rank").value(1))
                .andExpect(jsonPath("$.matches[0].applied").value(false));
    }

    @Test
    void getMatches_empty_returnsEmptyArray() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        when(matchingService.getMatches(STUDENT_ID)).thenReturn(new MatchListResponse(List.of()));

        mockMvc.perform(get("/matching/opportunities"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matches", hasSize(0)));
    }

    // ── US3: apply ─────────────────────────────────────────────────────

    @Test
    void apply_student_returns201WithExternalUrl() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        ApplicationResponse response = new ApplicationResponse(
                UUID.randomUUID(), OPP_ID, NOW, "https://hubtel.com/careers/x");
        when(matchingService.apply(OPP_ID, STUDENT_ID)).thenReturn(response);

        mockMvc.perform(post("/matching/opportunities/{id}/apply", OPP_ID))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.opportunityId").value(OPP_ID.toString()))
                .andExpect(jsonPath("$.externalUrl").value("https://hubtel.com/careers/x"));
    }

    @Test
    void apply_recruiter_returns403() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");

        mockMvc.perform(post("/matching/opportunities/{id}/apply", OPP_ID))
                .andExpect(status().isForbidden());
    }

    @Test
    void apply_unknown_returns404() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        when(matchingService.apply(OPP_ID, STUDENT_ID))
                .thenThrow(new OpportunityNotFoundException("Opportunity not found"));

        mockMvc.perform(post("/matching/opportunities/{id}/apply", OPP_ID))
                .andExpect(status().isNotFound());
    }

    @Test
    void apply_duplicate_returns409() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        when(matchingService.apply(OPP_ID, STUDENT_ID))
                .thenThrow(new DuplicateApplicationException("Already applied"));

        mockMvc.perform(post("/matching/opportunities/{id}/apply", OPP_ID))
                .andExpect(status().isConflict());
    }

    // ── US4: GET /applications ─────────────────────────────────────────

    @Test
    void getApplications_student_returnsList() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        ApplicationWithOpportunityResponse entry = new ApplicationWithOpportunityResponse(
                UUID.randomUUID(), NOW, SAMPLE_OPP);
        when(matchingService.getApplications(STUDENT_ID)).thenReturn(List.of(entry));

        mockMvc.perform(get("/matching/applications"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].opportunity.id").value(OPP_ID.toString()));
    }

    @Test
    void getApplications_recruiter_returns403() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");

        mockMvc.perform(get("/matching/applications"))
                .andExpect(status().isForbidden());
    }

    // ── US5: skill profile ─────────────────────────────────────────────

    @Test
    void getSkills_returnsList() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        when(matchingService.getSkills(STUDENT_ID))
                .thenReturn(new SkillsResponse(List.of("Java", "Docker")));

        mockMvc.perform(get("/matching/profile/skills"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.skills", contains("Java", "Docker")));
    }

    @Test
    void updateSkills_returnsStoredList() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        when(matchingService.updateSkills(any(), eq(STUDENT_ID)))
                .thenReturn(new SkillsResponse(List.of("Java", "Spring Boot")));

        mockMvc.perform(put("/matching/profile/skills")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"skills\": [\"Java\", \"Spring Boot\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.skills", contains("Java", "Spring Boot")));
    }

    @Test
    void updateSkills_blankEntry_returns400() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");

        mockMvc.perform(put("/matching/profile/skills")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"skills\": [\"Java\", \"  \"]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateSkills_over50_returns400() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        String skills = "[" + String.join(",", java.util.Collections.nCopies(51, "\"skill\"")) + "]";

        mockMvc.perform(put("/matching/profile/skills")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"skills\": " + skills + "}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateSkills_recruiter_returns403() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");

        mockMvc.perform(put("/matching/profile/skills")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"skills\": [\"Java\"]}"))
                .andExpect(status().isForbidden());
    }

    // ── US6: recruiter management ──────────────────────────────────────

    @Test
    void getMyPostings_recruiter_returnsOwnList() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");
        OpportunityResponse withCount = new OpportunityResponse(
                OPP_ID, "SE Intern", "Hubtel", "Backend team", "Accra",
                OpportunityType.INTERNSHIP, null, null, true, NOW, List.of(), 2L);
        when(matchingService.getMyPostings(RECRUITER_ID)).thenReturn(List.of(withCount));

        mockMvc.perform(get("/matching/opportunities/mine"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].applicantCount").value(2));
    }

    @Test
    void getMyPostings_student_returns403() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");

        mockMvc.perform(get("/matching/opportunities/mine"))
                .andExpect(status().isForbidden());
    }

    @Test
    void deactivate_owner_returns200Inactive() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");
        OpportunityResponse inactive = new OpportunityResponse(
                OPP_ID, "SE Intern", "Hubtel", "Backend team", "Accra",
                OpportunityType.INTERNSHIP, null, null, false, NOW, List.of(), 0L);
        when(matchingService.deactivate(OPP_ID, RECRUITER_ID)).thenReturn(inactive);

        mockMvc.perform(post("/matching/opportunities/{id}/deactivate", OPP_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
    }

    @Test
    void deactivate_wrongOwner_returns404() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");
        when(matchingService.deactivate(OPP_ID, RECRUITER_ID))
                .thenThrow(new OpportunityNotFoundException("Opportunity not found"));

        mockMvc.perform(post("/matching/opportunities/{id}/deactivate", OPP_ID))
                .andExpect(status().isNotFound());
    }

    @Test
    void getApplicants_owner_returnsList() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");
        when(matchingService.getApplicants(OPP_ID, RECRUITER_ID))
                .thenReturn(List.of(new ApplicantResponse(STUDENT_ID, NOW)));

        mockMvc.perform(get("/matching/opportunities/{id}/applications", OPP_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].studentId").value(STUDENT_ID.toString()));
    }

    @Test
    void getApplicants_wrongOwner_returns404() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");
        when(matchingService.getApplicants(OPP_ID, RECRUITER_ID))
                .thenThrow(new OpportunityNotFoundException("Opportunity not found"));

        mockMvc.perform(get("/matching/opportunities/{id}/applications", OPP_ID))
                .andExpect(status().isNotFound());
    }

    @Test
    void getApplicants_student_returns403() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");

        mockMvc.perform(get("/matching/opportunities/{id}/applications", OPP_ID))
                .andExpect(status().isForbidden());
    }

    // ── unauthenticated ────────────────────────────────────────────────

    @Test
    void postOpportunity_unauthenticated_returns401() throws Exception {
        // No auth in context → method security throws AuthenticationException → 401
        mockMvc.perform(post("/matching/opportunities")
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_POST_BODY))
                .andExpect(status().isUnauthorized());
    }
}
