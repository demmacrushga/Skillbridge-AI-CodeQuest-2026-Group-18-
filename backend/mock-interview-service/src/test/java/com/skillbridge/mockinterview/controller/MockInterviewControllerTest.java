package com.skillbridge.mockinterview.controller;

import com.skillbridge.mockinterview.dto.request.StartSessionRequest;
import com.skillbridge.mockinterview.dto.request.SubmitAnswerRequest;
import com.skillbridge.mockinterview.dto.response.QuestionResponse;
import com.skillbridge.mockinterview.dto.response.SessionResponse;
import com.skillbridge.mockinterview.dto.response.SessionSummaryResponse;
import com.skillbridge.mockinterview.dto.response.TranscribeResponse;
import com.skillbridge.mockinterview.exception.AiServiceException;
import com.skillbridge.mockinterview.exception.EmptyTranscriptException;
import com.skillbridge.mockinterview.exception.QuestionAlreadyAnsweredException;
import com.skillbridge.mockinterview.exception.SessionAlreadyCompletedException;
import com.skillbridge.mockinterview.exception.SessionIncompleteException;
import com.skillbridge.mockinterview.exception.SessionNotFoundException;
import com.skillbridge.mockinterview.security.JwtService;
import com.skillbridge.mockinterview.security.JwtUserDetails;
import com.skillbridge.mockinterview.service.MockInterviewService;
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
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(MockInterviewController.class)
@AutoConfigureMockMvc(addFilters = false)
class MockInterviewControllerTest {

    @Autowired
    MockMvc mockMvc;
    @MockBean
    MockInterviewService mockInterviewService;
    @MockBean
    JwtService jwtService;

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID SESSION_ID = UUID.randomUUID();
    private static final UUID QUESTION_ID = UUID.randomUUID();

    private static final Instant CREATED = Instant.parse("2026-07-08T10:00:00Z");
    private static final Instant ANSWERED = Instant.parse("2026-07-08T10:05:00Z");
    private static final Instant COMPLETED = Instant.parse("2026-07-08T10:20:00Z");

    private static final QuestionResponse SAMPLE_QUESTION = new QuestionResponse(
            QUESTION_ID, "Explain REST", "TECHNICAL", 1, null, null, null, null);

    private static final SessionResponse SAMPLE_SESSION = new SessionResponse(
            SESSION_ID, "Backend Developer", "ENTRY", "IN_PROGRESS",
            null, null, CREATED, null, List.of(SAMPLE_QUESTION));

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
    void startSession_validRequest_returns201() throws Exception {
        when(mockInterviewService.startSession(any(StartSessionRequest.class), eq(USER_ID)))
                .thenReturn(SAMPLE_SESSION);

        mockMvc.perform(post("/mock-interview/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"targetRole":"Backend Developer","difficulty":"ENTRY"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(SESSION_ID.toString()))
                .andExpect(jsonPath("$.targetRole").value("Backend Developer"))
                .andExpect(jsonPath("$.questions").isArray())
                .andExpect(jsonPath("$.questions[0].questionText").value("Explain REST"));
    }

    @Test
    void startSession_blankRole_returns400() throws Exception {
        mockMvc.perform(post("/mock-interview/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"targetRole":"","difficulty":"ENTRY"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void startSession_lowercaseDifficulty_returns400() throws Exception {
        mockMvc.perform(post("/mock-interview/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"targetRole":"Backend Developer","difficulty":"entry"}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void startSession_invalidDifficulty_returns400() throws Exception {
        mockMvc.perform(post("/mock-interview/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"targetRole":"Backend Developer","difficulty":"EXPERT"}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void startSession_aiUnavailable_returns503() throws Exception {
        when(mockInterviewService.startSession(any(StartSessionRequest.class), any()))
                .thenThrow(new AiServiceException("AI service unavailable"));

        mockMvc.perform(post("/mock-interview/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"targetRole":"Backend Developer","difficulty":"ENTRY"}
                                """))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value(503));
    }

    @Test
    void submitAnswer_validRequest_returns200() throws Exception {
        QuestionResponse answered = new QuestionResponse(
                QUESTION_ID, "Explain REST", "TECHNICAL", 1, "my answer", 7, "Good.", ANSWERED);
        when(mockInterviewService.submitAnswer(eq(SESSION_ID), eq(QUESTION_ID),
                any(SubmitAnswerRequest.class), eq(USER_ID)))
                .thenReturn(answered);

        mockMvc.perform(post("/mock-interview/sessions/{sessionId}/questions/{questionId}/answer",
                        SESSION_ID, QUESTION_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"answer":"my answer"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.score").value(7))
                .andExpect(jsonPath("$.userAnswer").value("my answer"));
    }

    @Test
    void submitAnswer_blankAnswer_returns400() throws Exception {
        mockMvc.perform(post("/mock-interview/sessions/{sessionId}/questions/{questionId}/answer",
                        SESSION_ID, QUESTION_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"answer":""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void submitAnswer_sessionNotFound_returns404() throws Exception {
        when(mockInterviewService.submitAnswer(any(), any(), any(), any()))
                .thenThrow(new SessionNotFoundException("Session not found"));

        mockMvc.perform(post("/mock-interview/sessions/{sessionId}/questions/{questionId}/answer",
                        SESSION_ID, QUESTION_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"answer":"my answer"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void submitAnswer_alreadyAnswered_returns409() throws Exception {
        when(mockInterviewService.submitAnswer(any(), any(), any(), any()))
                .thenThrow(new QuestionAlreadyAnsweredException("Already answered"));

        mockMvc.perform(post("/mock-interview/sessions/{sessionId}/questions/{questionId}/answer",
                        SESSION_ID, QUESTION_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"answer":"my answer"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void submitAnswer_completedSession_returns409() throws Exception {
        when(mockInterviewService.submitAnswer(any(), any(), any(), any()))
                .thenThrow(new SessionAlreadyCompletedException("Already completed"));

        mockMvc.perform(post("/mock-interview/sessions/{sessionId}/questions/{questionId}/answer",
                        SESSION_ID, QUESTION_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"answer":"my answer"}
                                """))
                .andExpect(status().isConflict());
    }

    @Test
    void completeSession_validRequest_returns200() throws Exception {
        SessionResponse completed = new SessionResponse(
                SESSION_ID, "Backend Developer", "ENTRY", "COMPLETED",
                68, "Solid.", CREATED, COMPLETED, List.of(SAMPLE_QUESTION));
        when(mockInterviewService.completeSession(eq(SESSION_ID), eq(USER_ID)))
                .thenReturn(completed);

        mockMvc.perform(post("/mock-interview/sessions/{sessionId}/complete", SESSION_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.overallScore").value(68));
    }

    @Test
    void completeSession_notFound_returns404() throws Exception {
        when(mockInterviewService.completeSession(any(), any()))
                .thenThrow(new SessionNotFoundException("Session not found"));

        mockMvc.perform(post("/mock-interview/sessions/{sessionId}/complete", SESSION_ID))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void completeSession_alreadyCompleted_returns409() throws Exception {
        when(mockInterviewService.completeSession(any(), any()))
                .thenThrow(new SessionAlreadyCompletedException("Already completed"));

        mockMvc.perform(post("/mock-interview/sessions/{sessionId}/complete", SESSION_ID))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void completeSession_incomplete_returns422() throws Exception {
        when(mockInterviewService.completeSession(any(), any()))
                .thenThrow(new SessionIncompleteException("Not all questions answered"));

        mockMvc.perform(post("/mock-interview/sessions/{sessionId}/complete", SESSION_ID))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.status").value(422));
    }

    @Test
    void completeSession_aiUnavailable_returns503() throws Exception {
        when(mockInterviewService.completeSession(any(), any()))
                .thenThrow(new AiServiceException("AI unavailable"));

        mockMvc.perform(post("/mock-interview/sessions/{sessionId}/complete", SESSION_ID))
                .andExpect(status().isServiceUnavailable());
    }

    @Test
    void listSessions_empty_returns200() throws Exception {
        when(mockInterviewService.getSessions(eq(USER_ID))).thenReturn(List.of());

        mockMvc.perform(get("/mock-interview/sessions"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    void listSessions_populated_returns200() throws Exception {
        SessionSummaryResponse summary = new SessionSummaryResponse(
                SESSION_ID, "Backend Developer", "ENTRY", "COMPLETED", 72, CREATED);
        when(mockInterviewService.getSessions(eq(USER_ID))).thenReturn(List.of(summary));

        mockMvc.perform(get("/mock-interview/sessions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(SESSION_ID.toString()))
                .andExpect(jsonPath("$[0].overallScore").value(72));
    }

    @Test
    void getSession_existing_returns200() throws Exception {
        when(mockInterviewService.getSession(eq(SESSION_ID), eq(USER_ID))).thenReturn(SAMPLE_SESSION);

        mockMvc.perform(get("/mock-interview/sessions/{sessionId}", SESSION_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(SESSION_ID.toString()))
                .andExpect(jsonPath("$.questions").isArray());
    }

    @Test
    void getSession_notFound_returns404() throws Exception {
        when(mockInterviewService.getSession(any(), any()))
                .thenThrow(new SessionNotFoundException("Session not found"));

        mockMvc.perform(get("/mock-interview/sessions/{sessionId}", SESSION_ID))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void deleteSession_owned_returns204() throws Exception {
        mockMvc.perform(delete("/mock-interview/sessions/{sessionId}", SESSION_ID))
                .andExpect(status().isNoContent());

        verify(mockInterviewService).deleteSession(eq(SESSION_ID), eq(USER_ID));
    }

    @Test
    void deleteSession_notFound_returns404() throws Exception {
        doThrow(new SessionNotFoundException("Session not found"))
                .when(mockInterviewService).deleteSession(any(), any());

        mockMvc.perform(delete("/mock-interview/sessions/{sessionId}", SESSION_ID))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void health_returns200WithStatusUp() throws Exception {
        mockMvc.perform(get("/mock-interview/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    // ===== US6 — POST /transcribe =====

    private static final MockMultipartFile AUDIO_FILE = new MockMultipartFile(
            "audio", "answer.m4a", "audio/m4a", new byte[]{1, 2, 3, 4});

    @Test
    void transcribe_validAudio_returns200WithTranscript() throws Exception {
        when(mockInterviewService.transcribe(eq(SESSION_ID), eq(QUESTION_ID), any(MultipartFile.class), eq(USER_ID)))
                .thenReturn(new TranscribeResponse("I would use REST for simple CRUD operations."));

        mockMvc.perform(multipart("/mock-interview/sessions/{sid}/questions/{qid}/transcribe", SESSION_ID, QUESTION_ID)
                        .file(AUDIO_FILE)
                        .header("Authorization", "Bearer test"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.transcript").value("I would use REST for simple CRUD operations."));
    }

    @Test
    void transcribe_missingAudioPart_returns400() throws Exception {
        MockMultipartFile empty = new MockMultipartFile("audio", "answer.m4a", "audio/m4a", new byte[0]);
        when(mockInterviewService.transcribe(eq(SESSION_ID), eq(QUESTION_ID), any(MultipartFile.class), eq(USER_ID)))
                .thenThrow(new IllegalArgumentException("audio file is required"));

        mockMvc.perform(multipart("/mock-interview/sessions/{sid}/questions/{qid}/transcribe", SESSION_ID, QUESTION_ID)
                        .file(empty))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void transcribe_wrongMime_returns400() throws Exception {
        when(mockInterviewService.transcribe(eq(SESSION_ID), eq(QUESTION_ID), any(MultipartFile.class), eq(USER_ID)))
                .thenThrow(new IllegalArgumentException("audio must be audio/mpeg, audio/m4a, or audio/wav"));

        mockMvc.perform(multipart("/mock-interview/sessions/{sid}/questions/{qid}/transcribe", SESSION_ID, QUESTION_ID)
                        .file(AUDIO_FILE))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void transcribe_sessionNotFound_returns404() throws Exception {
        when(mockInterviewService.transcribe(any(), any(), any(MultipartFile.class), any()))
                .thenThrow(new SessionNotFoundException("Session not found"));

        mockMvc.perform(multipart("/mock-interview/sessions/{sid}/questions/{qid}/transcribe", SESSION_ID, QUESTION_ID)
                        .file(AUDIO_FILE))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void transcribe_alreadyAnswered_returns409() throws Exception {
        when(mockInterviewService.transcribe(any(), any(), any(MultipartFile.class), any()))
                .thenThrow(new QuestionAlreadyAnsweredException("Already answered"));

        mockMvc.perform(multipart("/mock-interview/sessions/{sid}/questions/{qid}/transcribe", SESSION_ID, QUESTION_ID)
                        .file(AUDIO_FILE))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void transcribe_completedSession_returns409() throws Exception {
        when(mockInterviewService.transcribe(any(), any(), any(MultipartFile.class), any()))
                .thenThrow(new SessionAlreadyCompletedException("Already completed"));

        mockMvc.perform(multipart("/mock-interview/sessions/{sid}/questions/{qid}/transcribe", SESSION_ID, QUESTION_ID)
                        .file(AUDIO_FILE))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void transcribe_emptyTranscript_returns422() throws Exception {
        when(mockInterviewService.transcribe(any(), any(), any(MultipartFile.class), any()))
                .thenThrow(new EmptyTranscriptException("No speech detected"));

        mockMvc.perform(multipart("/mock-interview/sessions/{sid}/questions/{qid}/transcribe", SESSION_ID, QUESTION_ID)
                        .file(AUDIO_FILE))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.status").value(422))
                .andExpect(jsonPath("$.error").value("No speech detected"));
    }

    @Test
    void transcribe_whisperDown_returns503() throws Exception {
        when(mockInterviewService.transcribe(any(), any(), any(MultipartFile.class), any()))
                .thenThrow(new AiServiceException("AI service unavailable"));

        mockMvc.perform(multipart("/mock-interview/sessions/{sid}/questions/{qid}/transcribe", SESSION_ID, QUESTION_ID)
                        .file(AUDIO_FILE))
                .andExpect(status().isServiceUnavailable());
    }
}
