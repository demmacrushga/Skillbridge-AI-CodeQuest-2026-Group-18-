package com.skillbridge.challenge.controller;

import com.skillbridge.challenge.config.SecurityConfig;
import com.skillbridge.challenge.dto.response.ChallengeListEntry;
import com.skillbridge.challenge.dto.response.ChallengeListResponse;
import com.skillbridge.challenge.dto.response.ChallengeResponse;
import com.skillbridge.challenge.dto.response.LeaderboardResponse;
import com.skillbridge.challenge.dto.response.MySubmissionResponse;
import com.skillbridge.challenge.dto.response.SubmissionResponse;
import com.skillbridge.challenge.dto.response.SubmissionReviewResponse;
import com.skillbridge.challenge.exception.ChallengeNotFoundException;
import com.skillbridge.challenge.exception.DuplicateSubmissionException;
import com.skillbridge.challenge.security.JwtService;
import com.skillbridge.challenge.security.JwtUserDetails;
import com.skillbridge.challenge.service.ChallengeService;
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
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ChallengeController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(SecurityConfig.class)
class ChallengeControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean ChallengeService challengeService;
    @MockBean JwtService jwtService;

    private static final UUID STUDENT_ID = UUID.randomUUID();
    private static final UUID RECRUITER_ID = UUID.randomUUID();
    private static final UUID CHALLENGE_ID = UUID.randomUUID();
    private static final UUID SUBMISSION_ID = UUID.randomUUID();
    private static final Instant NOW = Instant.parse("2026-07-18T10:00:00Z");
    private static final Instant FUTURE = Instant.parse("2026-12-31T23:59:00Z");

    private static final ChallengeResponse SAMPLE_CHALLENGE = new ChallengeResponse(
            CHALLENGE_ID, "Build a Fraud Detection API",
            "Design and implement an API that flags fraudulent transactions",
            "GitHub repository link with a README", FUTURE, true, NOW, null);

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
              "title": "Build a Fraud Detection API",
              "description": "Design and implement an API that flags fraudulent transactions",
              "submissionFormat": "GitHub repository link with a README",
              "deadline": "2099-12-31T23:59:00Z"
            }
            """;

    // ── health ─────────────────────────────────────────────────────────

    @Test
    void health_returnsUp() throws Exception {
        mockMvc.perform(get("/challenge/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    // ── US1: POST /challenge ───────────────────────────────────────────

    @Test
    void postChallenge_recruiter_returns201() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");
        when(challengeService.postChallenge(any(), eq(RECRUITER_ID)))
                .thenReturn(new ChallengeResponse(CHALLENGE_ID, "Build a Fraud Detection API",
                        "desc", "fmt", FUTURE, true, NOW, 0L));

        mockMvc.perform(post("/challenge")
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_POST_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Build a Fraud Detection API"))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.submissionCount").value(0));
    }

    @Test
    void postChallenge_student_returns403() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");

        mockMvc.perform(post("/challenge")
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_POST_BODY))
                .andExpect(status().isForbidden());
    }

    @Test
    void postChallenge_blankTitle_returns400() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");
        String body = VALID_POST_BODY.replace("\"Build a Fraud Detection API\"", "\"  \"");

        mockMvc.perform(post("/challenge")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void postChallenge_blankSubmissionFormat_returns400() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");
        String body = VALID_POST_BODY.replace(
                "\"GitHub repository link with a README\"", "\"  \"");

        mockMvc.perform(post("/challenge")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void postChallenge_missingDeadline_returns400() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");
        String body = """
                {"title":"T","description":"D","submissionFormat":"F"}
                """;

        mockMvc.perform(post("/challenge")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void postChallenge_pastDeadline_returns400() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");
        String body = VALID_POST_BODY.replace("2099-12-31T23:59:00Z", "2020-01-01T00:00:00Z");

        mockMvc.perform(post("/challenge")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void postChallenge_unauthenticated_returns401() throws Exception {
        // No auth in context → method security throws AuthenticationException → 401
        mockMvc.perform(post("/challenge")
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_POST_BODY))
                .andExpect(status().isUnauthorized());
    }

    // ── US2: GET /challenge ────────────────────────────────────────────

    @Test
    void getActiveChallenges_returnsListWithSubmittedFlag() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        ChallengeListEntry entry = new ChallengeListEntry(
                CHALLENGE_ID, "Build a Fraud Detection API", "desc", "fmt", FUTURE, NOW, true);
        when(challengeService.getActiveChallenges(STUDENT_ID))
                .thenReturn(new ChallengeListResponse(List.of(entry)));

        mockMvc.perform(get("/challenge"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.challenges", hasSize(1)))
                .andExpect(jsonPath("$.challenges[0].submitted").value(true));
    }

    @Test
    void getActiveChallenges_empty_returnsEmptyArray() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        when(challengeService.getActiveChallenges(STUDENT_ID))
                .thenReturn(new ChallengeListResponse(List.of()));

        mockMvc.perform(get("/challenge"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.challenges", hasSize(0)));
    }

    // ── US3: POST /challenge/{id}/submissions ──────────────────────────

    @Test
    void submit_student_returns201() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        SubmissionResponse response = new SubmissionResponse(
                SUBMISSION_ID, CHALLENGE_ID, "https://github.com/student/fraud-api", null, NOW);
        when(challengeService.submit(eq(CHALLENGE_ID), any(), eq(STUDENT_ID))).thenReturn(response);

        mockMvc.perform(post("/challenge/{id}/submissions", CHALLENGE_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"submissionUrl\": \"https://github.com/student/fraud-api\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.challengeId").value(CHALLENGE_ID.toString()))
                .andExpect(jsonPath("$.score").doesNotExist());
    }

    @Test
    void submit_malformedUrl_returns400() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");

        mockMvc.perform(post("/challenge/{id}/submissions", CHALLENGE_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"submissionUrl\": \"not-a-url\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void submit_recruiter_returns403() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");

        mockMvc.perform(post("/challenge/{id}/submissions", CHALLENGE_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"submissionUrl\": \"https://github.com/x/y\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void submit_unknown_returns404() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        when(challengeService.submit(eq(CHALLENGE_ID), any(), eq(STUDENT_ID)))
                .thenThrow(new ChallengeNotFoundException("Challenge not found"));

        mockMvc.perform(post("/challenge/{id}/submissions", CHALLENGE_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"submissionUrl\": \"https://github.com/x/y\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void submit_duplicate_returns409() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        when(challengeService.submit(eq(CHALLENGE_ID), any(), eq(STUDENT_ID)))
                .thenThrow(new DuplicateSubmissionException("Already submitted"));

        mockMvc.perform(post("/challenge/{id}/submissions", CHALLENGE_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"submissionUrl\": \"https://github.com/x/y\"}"))
                .andExpect(status().isConflict());
    }

    // ── US4: GET /challenge/my-submissions ─────────────────────────────

    @Test
    void getMySubmissions_student_returnsList() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        MySubmissionResponse entry = new MySubmissionResponse(
                SUBMISSION_ID, "https://github.com/student/fraud-api",
                new BigDecimal("85.50"), NOW, SAMPLE_CHALLENGE);
        when(challengeService.getMySubmissions(STUDENT_ID)).thenReturn(List.of(entry));

        mockMvc.perform(get("/challenge/my-submissions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].challenge.id").value(CHALLENGE_ID.toString()))
                .andExpect(jsonPath("$[0].score").value(85.50));
    }

    @Test
    void getMySubmissions_recruiter_returns403() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");

        mockMvc.perform(get("/challenge/my-submissions"))
                .andExpect(status().isForbidden());
    }

    // ── US5: scoring ───────────────────────────────────────────────────

    @Test
    void getSubmissionsForReview_owner_returnsList() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");
        when(challengeService.getSubmissionsForReview(CHALLENGE_ID, RECRUITER_ID))
                .thenReturn(List.of(new SubmissionReviewResponse(
                        SUBMISSION_ID, STUDENT_ID, "https://github.com/student/fraud-api", null, NOW)));

        mockMvc.perform(get("/challenge/{id}/submissions", CHALLENGE_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].studentId").value(STUDENT_ID.toString()));
    }

    @Test
    void getSubmissionsForReview_wrongOwner_returns404() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");
        when(challengeService.getSubmissionsForReview(CHALLENGE_ID, RECRUITER_ID))
                .thenThrow(new ChallengeNotFoundException("Challenge not found"));

        mockMvc.perform(get("/challenge/{id}/submissions", CHALLENGE_ID))
                .andExpect(status().isNotFound());
    }

    @Test
    void getSubmissionsForReview_student_returns403() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");

        mockMvc.perform(get("/challenge/{id}/submissions", CHALLENGE_ID))
                .andExpect(status().isForbidden());
    }

    @Test
    void scoreSubmission_owner_returns200() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");
        when(challengeService.scoreSubmission(eq(CHALLENGE_ID), eq(SUBMISSION_ID), any(), eq(RECRUITER_ID)))
                .thenReturn(new SubmissionReviewResponse(
                        SUBMISSION_ID, STUDENT_ID, "https://github.com/student/fraud-api",
                        new BigDecimal("85.50"), NOW));

        mockMvc.perform(post("/challenge/{id}/submissions/{subId}/score", CHALLENGE_ID, SUBMISSION_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"score\": 85.50}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.score").value(85.50));
    }

    @Test
    void scoreSubmission_outOfRange_returns400() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");

        mockMvc.perform(post("/challenge/{id}/submissions/{subId}/score", CHALLENGE_ID, SUBMISSION_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"score\": 100.01}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void scoreSubmission_tooManyDecimals_returns400() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");

        mockMvc.perform(post("/challenge/{id}/submissions/{subId}/score", CHALLENGE_ID, SUBMISSION_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"score\": 85.555}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void scoreSubmission_student_returns403() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");

        mockMvc.perform(post("/challenge/{id}/submissions/{subId}/score", CHALLENGE_ID, SUBMISSION_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"score\": 85.50}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void scoreSubmission_wrongOwner_returns404() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");
        when(challengeService.scoreSubmission(eq(CHALLENGE_ID), eq(SUBMISSION_ID), any(), eq(RECRUITER_ID)))
                .thenThrow(new ChallengeNotFoundException("Challenge not found"));

        mockMvc.perform(post("/challenge/{id}/submissions/{subId}/score", CHALLENGE_ID, SUBMISSION_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"score\": 85.50}"))
                .andExpect(status().isNotFound());
    }

    // ── US6: leaderboard ───────────────────────────────────────────────

    @Test
    void getLeaderboard_returnsRankedEntries() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        LeaderboardResponse response = new LeaderboardResponse(CHALLENGE_ID, List.of(
                new LeaderboardResponse.Entry(1, STUDENT_ID, new BigDecimal("94.50")),
                new LeaderboardResponse.Entry(2, UUID.randomUUID(), new BigDecimal("89.00"))));
        when(challengeService.getLeaderboard(CHALLENGE_ID)).thenReturn(response);

        mockMvc.perform(get("/challenge/{id}/leaderboard", CHALLENGE_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.challengeId").value(CHALLENGE_ID.toString()))
                .andExpect(jsonPath("$.entries", hasSize(2)))
                .andExpect(jsonPath("$.entries[0].rank").value(1))
                .andExpect(jsonPath("$.entries[0].score").value(94.50));
    }

    @Test
    void getLeaderboard_unknown_returns404() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        when(challengeService.getLeaderboard(CHALLENGE_ID))
                .thenThrow(new ChallengeNotFoundException("Challenge not found"));

        mockMvc.perform(get("/challenge/{id}/leaderboard", CHALLENGE_ID))
                .andExpect(status().isNotFound());
    }

    // ── US7: recruiter management ──────────────────────────────────────

    @Test
    void getMyChallenges_recruiter_returnsOwnList() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");
        ChallengeResponse withCount = new ChallengeResponse(
                CHALLENGE_ID, "Build a Fraud Detection API", "desc", "fmt", FUTURE, true, NOW, 2L);
        when(challengeService.getMyChallenges(RECRUITER_ID)).thenReturn(List.of(withCount));

        mockMvc.perform(get("/challenge/mine"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].submissionCount").value(2));
    }

    @Test
    void getMyChallenges_student_returns403() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");

        mockMvc.perform(get("/challenge/mine"))
                .andExpect(status().isForbidden());
    }

    @Test
    void deactivate_owner_returns200Inactive() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");
        ChallengeResponse inactive = new ChallengeResponse(
                CHALLENGE_ID, "Build a Fraud Detection API", "desc", "fmt", FUTURE, false, NOW, 0L);
        when(challengeService.deactivate(CHALLENGE_ID, RECRUITER_ID)).thenReturn(inactive);

        mockMvc.perform(post("/challenge/{id}/deactivate", CHALLENGE_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
    }

    @Test
    void deactivate_wrongOwner_returns404() throws Exception {
        authenticate(RECRUITER_ID, "RECRUITER");
        when(challengeService.deactivate(CHALLENGE_ID, RECRUITER_ID))
                .thenThrow(new ChallengeNotFoundException("Challenge not found"));

        mockMvc.perform(post("/challenge/{id}/deactivate", CHALLENGE_ID))
                .andExpect(status().isNotFound());
    }
}
