package com.skillbridge.mentorship.controller;

import com.skillbridge.mentorship.config.SecurityConfig;
import com.skillbridge.mentorship.dto.response.AlumniSearchEntry;
import com.skillbridge.mentorship.dto.response.AlumniSearchResponse;
import com.skillbridge.mentorship.dto.response.MessageResponse;
import com.skillbridge.mentorship.dto.response.PairResponse;
import com.skillbridge.mentorship.dto.response.ProfileResponse;
import com.skillbridge.mentorship.dto.response.RequestResponse;
import com.skillbridge.mentorship.dto.response.ThreadResponse;
import com.skillbridge.mentorship.entity.PairStatus;
import com.skillbridge.mentorship.entity.RequestStatus;
import com.skillbridge.mentorship.exception.DuplicateRequestException;
import com.skillbridge.mentorship.exception.PairEndedException;
import com.skillbridge.mentorship.exception.PairNotFoundException;
import com.skillbridge.mentorship.exception.ProfileNotFoundException;
import com.skillbridge.mentorship.exception.RequestAlreadyResolvedException;
import com.skillbridge.mentorship.exception.RequestNotFoundException;
import com.skillbridge.mentorship.security.JwtService;
import com.skillbridge.mentorship.security.JwtUserDetails;
import com.skillbridge.mentorship.service.MentorshipService;
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

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(MentorshipController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(SecurityConfig.class)
class MentorshipControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean MentorshipService mentorshipService;
    @MockBean JwtService jwtService;

    private static final UUID STUDENT_ID = UUID.randomUUID();
    private static final UUID ALUMNI_ID = UUID.randomUUID();
    private static final UUID REQUEST_ID = UUID.randomUUID();
    private static final UUID PAIR_ID = UUID.randomUUID();
    private static final Instant NOW = Instant.parse("2026-07-19T10:00:00Z");

    private static final ProfileResponse SAMPLE_PROFILE = new ProfileResponse(
            UUID.randomUUID(), ALUMNI_ID, "Senior Backend Engineer", "Hubtel", "Fintech",
            List.of("fintech", "backend engineering"), "Class of 2019.", true, NOW);

    private static final RequestResponse PENDING_REQUEST = new RequestResponse(
            REQUEST_ID, STUDENT_ID, ALUMNI_ID, "Hi!", RequestStatus.PENDING, NOW, null);

    private static final PairResponse ACTIVE_PAIR = new PairResponse(
            PAIR_ID, STUDENT_ID, ALUMNI_ID, PairStatus.ACTIVE, NOW, null);

    private void authenticate(UUID userId, String role) {
        JwtUserDetails principal = new JwtUserDetails(userId, "user@knust.edu.gh", role);
        var auth = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    private static final String VALID_PROFILE_BODY = """
            {
              "currentRole": "Senior Backend Engineer",
              "company": "Hubtel",
              "industry": "Fintech",
              "careerInterests": ["fintech", "backend engineering"],
              "bio": "Class of 2019.",
              "available": true
            }
            """;

    // ── Health ─────────────────────────────────────────────────────────

    @Test
    void healthIsPublic() throws Exception {
        mockMvc.perform(get("/mentorship/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    // ── US1: profile ───────────────────────────────────────────────────

    @Test
    void putProfileReturns200ForAlumni() throws Exception {
        authenticate(ALUMNI_ID, "ALUMNI");
        when(mentorshipService.upsertProfile(eq(ALUMNI_ID), any())).thenReturn(SAMPLE_PROFILE);

        mockMvc.perform(put("/mentorship/profile")
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_PROFILE_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(ALUMNI_ID.toString()))
                .andExpect(jsonPath("$.careerInterests", hasSize(2)));
    }

    @Test
    void getProfileReturns200ForAlumni() throws Exception {
        authenticate(ALUMNI_ID, "ALUMNI");
        when(mentorshipService.getProfile(ALUMNI_ID)).thenReturn(SAMPLE_PROFILE);

        mockMvc.perform(get("/mentorship/profile"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true));
    }

    @Test
    void getMissingProfileReturns404() throws Exception {
        authenticate(ALUMNI_ID, "ALUMNI");
        when(mentorshipService.getProfile(ALUMNI_ID)).thenThrow(new ProfileNotFoundException("Profile not found"));

        mockMvc.perform(get("/mentorship/profile"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Profile not found"));
    }

    @Test
    void putProfileWithEmptyTagsReturns400WithFieldErrors() throws Exception {
        authenticate(ALUMNI_ID, "ALUMNI");

        mockMvc.perform(put("/mentorship/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"careerInterests\": [], \"available\": true}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors", not(empty())));
    }

    @Test
    void putProfileAsStudentReturns403() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");

        mockMvc.perform(put("/mentorship/profile")
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_PROFILE_BODY))
                .andExpect(status().isForbidden());
    }

    @Test
    void profileWithoutAuthReturns401() throws Exception {
        mockMvc.perform(get("/mentorship/profile"))
                .andExpect(status().isUnauthorized());
    }

    // ── US2: search ────────────────────────────────────────────────────

    @Test
    void searchReturnsRankedListForStudent() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        when(mentorshipService.searchAlumni(eq(List.of("fintech")), isNull()))
                .thenReturn(new AlumniSearchResponse(List.of(new AlumniSearchEntry(
                        ALUMNI_ID, "Engineer", "Hubtel", "Fintech",
                        List.of("fintech"), "bio", 1, NOW))));

        mockMvc.perform(get("/mentorship/alumni").param("interest", "fintech"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alumni", hasSize(1)))
                .andExpect(jsonPath("$.alumni[0].matchingTags").value(1));
    }

    @Test
    void searchAsAlumniReturns403() throws Exception {
        authenticate(ALUMNI_ID, "ALUMNI");

        mockMvc.perform(get("/mentorship/alumni"))
                .andExpect(status().isForbidden());
    }

    @Test
    void searchWithoutAuthReturns401() throws Exception {
        mockMvc.perform(get("/mentorship/alumni"))
                .andExpect(status().isUnauthorized());
    }

    // ── US3: requests ──────────────────────────────────────────────────

    @Test
    void sendRequestReturns201() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        when(mentorshipService.sendRequest(eq(STUDENT_ID), any())).thenReturn(PENDING_REQUEST);

        mockMvc.perform(post("/mentorship/requests")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"alumniId\": \"" + ALUMNI_ID + "\", \"message\": \"Hi!\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    @Test
    void sendRequestWithoutAlumniIdReturns400() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");

        mockMvc.perform(post("/mentorship/requests")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void sendRequestAsAlumniReturns403() throws Exception {
        authenticate(ALUMNI_ID, "ALUMNI");

        mockMvc.perform(post("/mentorship/requests")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"alumniId\": \"" + ALUMNI_ID + "\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void sendRequestToUnknownAlumnusReturns404() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        when(mentorshipService.sendRequest(eq(STUDENT_ID), any()))
                .thenThrow(new RequestNotFoundException("Alumni profile not found"));

        mockMvc.perform(post("/mentorship/requests")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"alumniId\": \"" + ALUMNI_ID + "\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void duplicateRequestReturns409() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        when(mentorshipService.sendRequest(eq(STUDENT_ID), any()))
                .thenThrow(new DuplicateRequestException("A pending request to this alumnus already exists"));

        mockMvc.perform(post("/mentorship/requests")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"alumniId\": \"" + ALUMNI_ID + "\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void cancelRequestReturns200() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        when(mentorshipService.cancelRequest(STUDENT_ID, REQUEST_ID)).thenReturn(new RequestResponse(
                REQUEST_ID, STUDENT_ID, ALUMNI_ID, "Hi!", RequestStatus.CANCELLED, NOW, NOW));

        mockMvc.perform(post("/mentorship/requests/" + REQUEST_ID + "/cancel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    @Test
    void cancelResolvedRequestReturns409() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        when(mentorshipService.cancelRequest(STUDENT_ID, REQUEST_ID))
                .thenThrow(new RequestAlreadyResolvedException("Request has already been resolved"));

        mockMvc.perform(post("/mentorship/requests/" + REQUEST_ID + "/cancel"))
                .andExpect(status().isConflict());
    }

    @Test
    void cancelUnknownRequestReturns404() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        when(mentorshipService.cancelRequest(STUDENT_ID, REQUEST_ID))
                .thenThrow(new RequestNotFoundException("Request not found"));

        mockMvc.perform(post("/mentorship/requests/" + REQUEST_ID + "/cancel"))
                .andExpect(status().isNotFound());
    }

    @Test
    void myRequestsReturns200ForStudent() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        when(mentorshipService.getMyRequests(STUDENT_ID)).thenReturn(List.of(PENDING_REQUEST));

        mockMvc.perform(get("/mentorship/requests/mine"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
    }

    // ── US4: respond ───────────────────────────────────────────────────

    @Test
    void incomingRequestsReturns200ForAlumni() throws Exception {
        authenticate(ALUMNI_ID, "ALUMNI");
        when(mentorshipService.getIncomingRequests(ALUMNI_ID)).thenReturn(List.of(PENDING_REQUEST));

        mockMvc.perform(get("/mentorship/requests/incoming"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("PENDING"));
    }

    @Test
    void incomingRequestsAsStudentReturns403() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");

        mockMvc.perform(get("/mentorship/requests/incoming"))
                .andExpect(status().isForbidden());
    }

    @Test
    void acceptReturns200WithActivePair() throws Exception {
        authenticate(ALUMNI_ID, "ALUMNI");
        when(mentorshipService.acceptRequest(ALUMNI_ID, REQUEST_ID)).thenReturn(ACTIVE_PAIR);

        mockMvc.perform(post("/mentorship/requests/" + REQUEST_ID + "/accept"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    void acceptResolvedRequestReturns409() throws Exception {
        authenticate(ALUMNI_ID, "ALUMNI");
        when(mentorshipService.acceptRequest(ALUMNI_ID, REQUEST_ID))
                .thenThrow(new RequestAlreadyResolvedException("Request has already been resolved"));

        mockMvc.perform(post("/mentorship/requests/" + REQUEST_ID + "/accept"))
                .andExpect(status().isConflict());
    }

    @Test
    void acceptOtherAlumnusRequestReturns404() throws Exception {
        authenticate(ALUMNI_ID, "ALUMNI");
        when(mentorshipService.acceptRequest(ALUMNI_ID, REQUEST_ID))
                .thenThrow(new RequestNotFoundException("Request not found"));

        mockMvc.perform(post("/mentorship/requests/" + REQUEST_ID + "/accept"))
                .andExpect(status().isNotFound());
    }

    @Test
    void declineReturns200() throws Exception {
        authenticate(ALUMNI_ID, "ALUMNI");
        when(mentorshipService.declineRequest(ALUMNI_ID, REQUEST_ID)).thenReturn(new RequestResponse(
                REQUEST_ID, STUDENT_ID, ALUMNI_ID, "Hi!", RequestStatus.DECLINED, NOW, NOW));

        mockMvc.perform(post("/mentorship/requests/" + REQUEST_ID + "/decline"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DECLINED"));
    }

    @Test
    void acceptAsStudentReturns403() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");

        mockMvc.perform(post("/mentorship/requests/" + REQUEST_ID + "/accept"))
                .andExpect(status().isForbidden());
    }

    // ── US6: pairs ─────────────────────────────────────────────────────

    @Test
    void myPairsReturns200ForAnyAuthenticatedRole() throws Exception {
        authenticate(UUID.randomUUID(), "RECRUITER");
        when(mentorshipService.getMyPairs(any())).thenReturn(List.of());

        mockMvc.perform(get("/mentorship/pairs/mine"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void myPairsReturnsParticipantPairs() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        when(mentorshipService.getMyPairs(STUDENT_ID)).thenReturn(List.of(ACTIVE_PAIR));

        mockMvc.perform(get("/mentorship/pairs/mine"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(PAIR_ID.toString()));
    }

    @Test
    void endPairReturns200() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        when(mentorshipService.endPair(STUDENT_ID, PAIR_ID)).thenReturn(new PairResponse(
                PAIR_ID, STUDENT_ID, ALUMNI_ID, PairStatus.ENDED, NOW, NOW));

        mockMvc.perform(post("/mentorship/pairs/" + PAIR_ID + "/end"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ENDED"));
    }

    @Test
    void endUnknownPairReturns404() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        when(mentorshipService.endPair(STUDENT_ID, PAIR_ID))
                .thenThrow(new PairNotFoundException("Mentorship not found"));

        mockMvc.perform(post("/mentorship/pairs/" + PAIR_ID + "/end"))
                .andExpect(status().isNotFound());
    }

    @Test
    void pairsWithoutAuthReturns401() throws Exception {
        mockMvc.perform(get("/mentorship/pairs/mine"))
                .andExpect(status().isUnauthorized());
    }

    // ── US5: messages ──────────────────────────────────────────────────

    @Test
    void getThreadReturns200() throws Exception {
        authenticate(ALUMNI_ID, "ALUMNI");
        when(mentorshipService.getThread(ALUMNI_ID, PAIR_ID)).thenReturn(new ThreadResponse(
                PAIR_ID, PairStatus.ACTIVE, List.of(new MessageResponse(
                        UUID.randomUUID(), PAIR_ID, STUDENT_ID, "Hello!", NOW, NOW))));

        mockMvc.perform(get("/mentorship/pairs/" + PAIR_ID + "/messages"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messages", hasSize(1)))
                .andExpect(jsonPath("$.messages[0].body").value("Hello!"));
    }

    @Test
    void sendMessageReturns201() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        when(mentorshipService.sendMessage(eq(STUDENT_ID), eq(PAIR_ID), any())).thenReturn(new MessageResponse(
                UUID.randomUUID(), PAIR_ID, STUDENT_ID, "Hello!", NOW, null));

        mockMvc.perform(post("/mentorship/pairs/" + PAIR_ID + "/messages")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"body\": \"Hello!\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.readAt").value(nullValue()));
    }

    @Test
    void sendBlankMessageReturns400() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");

        mockMvc.perform(post("/mentorship/pairs/" + PAIR_ID + "/messages")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"body\": \"   \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void sendMessageOnEndedPairReturns409() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        when(mentorshipService.sendMessage(eq(STUDENT_ID), eq(PAIR_ID), any()))
                .thenThrow(new PairEndedException("This mentorship has ended — the thread is read-only"));

        mockMvc.perform(post("/mentorship/pairs/" + PAIR_ID + "/messages")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"body\": \"Hello!\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void threadOnForeignPairReturns404() throws Exception {
        authenticate(STUDENT_ID, "STUDENT");
        when(mentorshipService.getThread(STUDENT_ID, PAIR_ID))
                .thenThrow(new PairNotFoundException("Mentorship not found"));

        mockMvc.perform(get("/mentorship/pairs/" + PAIR_ID + "/messages"))
                .andExpect(status().isNotFound());
    }
}
