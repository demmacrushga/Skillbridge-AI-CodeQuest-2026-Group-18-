package com.skillbridge.mockinterview.service;

import com.skillbridge.mockinterview.dto.request.Difficulty;
import com.skillbridge.mockinterview.dto.request.StartSessionRequest;
import com.skillbridge.mockinterview.dto.request.SubmitAnswerRequest;
import com.skillbridge.mockinterview.dto.response.QuestionResponse;
import com.skillbridge.mockinterview.dto.response.SessionResponse;
import com.skillbridge.mockinterview.dto.response.SessionSummaryResponse;
import com.skillbridge.mockinterview.dto.response.TranscribeResponse;
import com.skillbridge.mockinterview.entity.InterviewQuestion;
import com.skillbridge.mockinterview.entity.InterviewSession;
import com.skillbridge.mockinterview.exception.AiServiceException;
import com.skillbridge.mockinterview.exception.EmptyTranscriptException;
import com.skillbridge.mockinterview.exception.QuestionAlreadyAnsweredException;
import com.skillbridge.mockinterview.exception.SessionAlreadyCompletedException;
import com.skillbridge.mockinterview.exception.SessionIncompleteException;
import com.skillbridge.mockinterview.exception.SessionNotFoundException;
import com.skillbridge.mockinterview.repository.InterviewQuestionRepository;
import com.skillbridge.mockinterview.repository.InterviewSessionRepository;
import com.skillbridge.mockinterview.service.dto.AnswerEvaluationTemplate;
import com.skillbridge.mockinterview.service.dto.QuestionTemplate;
import com.skillbridge.mockinterview.service.dto.SessionSummaryTemplate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MockInterviewServiceImplTest {

    @Mock
    InterviewSessionRepository sessionRepository;
    @Mock
    InterviewQuestionRepository questionRepository;
    @Mock
    ClaudeInterviewService claudeInterviewService;
    @Mock
    WhisperTranscriptionService whisperTranscriptionService;

    @InjectMocks
    MockInterviewServiceImpl service;

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID SESSION_ID = UUID.randomUUID();
    private static final UUID QUESTION_ID = UUID.randomUUID();

    @Test
    void startSession_success_persistsSessionWithQuestions() {
        when(claudeInterviewService.generateQuestions("Backend Developer", "ENTRY"))
                .thenReturn(List.of(
                        new QuestionTemplate("Q1", "TECHNICAL", 1),
                        new QuestionTemplate("Q2", "BEHAVIORAL", 2)));

        service.startSession(new StartSessionRequest("Backend Developer", Difficulty.ENTRY), USER_ID);

        ArgumentCaptor<InterviewSession> captor = ArgumentCaptor.forClass(InterviewSession.class);
        verify(sessionRepository).save(captor.capture());
        InterviewSession saved = captor.getValue();
        assertThat(saved.getUserId()).isEqualTo(USER_ID);
        assertThat(saved.getTargetRole()).isEqualTo("Backend Developer");
        assertThat(saved.getDifficulty()).isEqualTo("ENTRY");
        assertThat(saved.getStatus()).isEqualTo("IN_PROGRESS");
        assertThat(saved.getQuestions()).hasSize(2);
        assertThat(saved.getQuestions().get(0).getQuestionText()).isEqualTo("Q1");
        assertThat(saved.getQuestions().get(0).getSession()).isEqualTo(saved);
    }

    @Test
    void startSession_emptyQuestions_throwsAiServiceException() {
        when(claudeInterviewService.generateQuestions(any(), any())).thenReturn(List.of());

        assertThatThrownBy(() -> service.startSession(
                new StartSessionRequest("Backend Developer", Difficulty.ENTRY), USER_ID))
                .isInstanceOf(AiServiceException.class);

        verify(sessionRepository, never()).save(any());
    }

    @Test
    void submitAnswer_success_evaluatesAndPersists() {
        InterviewSession session = sessionWithQuestion("IN_PROGRESS", null);
        when(sessionRepository.findByIdAndUserId(SESSION_ID, USER_ID)).thenReturn(Optional.of(session));
        when(claudeInterviewService.evaluateAnswer(any(), any(), any(), any(), eq("my answer")))
                .thenReturn(new AnswerEvaluationTemplate(7, "Good."));

        QuestionResponse response = service.submitAnswer(SESSION_ID, QUESTION_ID,
                new SubmitAnswerRequest("my answer"), USER_ID);

        assertThat(response.score()).isEqualTo(7);
        assertThat(response.userAnswer()).isEqualTo("my answer");
        verify(sessionRepository).save(session);
        assertThat(session.getQuestions().get(0).getScore()).isEqualTo(7);
        assertThat(session.getQuestions().get(0).getAnsweredAt()).isNotNull();
    }

    @Test
    void submitAnswer_sessionNotFound_throws404() {
        when(sessionRepository.findByIdAndUserId(SESSION_ID, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.submitAnswer(SESSION_ID, QUESTION_ID,
                new SubmitAnswerRequest("answer"), USER_ID))
                .isInstanceOf(SessionNotFoundException.class);
    }

    @Test
    void submitAnswer_completedSession_throws409() {
        InterviewSession session = sessionWithQuestion("COMPLETED", null);
        when(sessionRepository.findByIdAndUserId(SESSION_ID, USER_ID)).thenReturn(Optional.of(session));

        assertThatThrownBy(() -> service.submitAnswer(SESSION_ID, QUESTION_ID,
                new SubmitAnswerRequest("answer"), USER_ID))
                .isInstanceOf(SessionAlreadyCompletedException.class);
    }

    @Test
    void submitAnswer_questionNotFound_throws404() {
        InterviewSession session = sessionWithQuestion("IN_PROGRESS", null);
        when(sessionRepository.findByIdAndUserId(SESSION_ID, USER_ID)).thenReturn(Optional.of(session));

        assertThatThrownBy(() -> service.submitAnswer(SESSION_ID, UUID.randomUUID(),
                new SubmitAnswerRequest("answer"), USER_ID))
                .isInstanceOf(SessionNotFoundException.class);
    }

    @Test
    void submitAnswer_alreadyAnswered_throws409() {
        InterviewSession session = sessionWithQuestion("IN_PROGRESS", "previous answer");
        when(sessionRepository.findByIdAndUserId(SESSION_ID, USER_ID)).thenReturn(Optional.of(session));

        assertThatThrownBy(() -> service.submitAnswer(SESSION_ID, QUESTION_ID,
                new SubmitAnswerRequest("answer"), USER_ID))
                .isInstanceOf(QuestionAlreadyAnsweredException.class);
    }

    @Test
    void completeSession_success_setsCompletedFields() {
        InterviewSession session = sessionWithQuestion("IN_PROGRESS", "answered");
        when(sessionRepository.findByIdAndUserId(SESSION_ID, USER_ID)).thenReturn(Optional.of(session));
        when(questionRepository.existsBySessionIdAndUserAnswerIsNull(SESSION_ID)).thenReturn(false);
        when(claudeInterviewService.generateSummary(any(), any(), any()))
                .thenReturn(new SessionSummaryTemplate(72, "Solid."));

        SessionResponse response = service.completeSession(SESSION_ID, USER_ID);

        assertThat(response.status()).isEqualTo("COMPLETED");
        assertThat(response.overallScore()).isEqualTo(72);
        assertThat(response.overallFeedback()).isEqualTo("Solid.");
        assertThat(session.getCompletedAt()).isNotNull();
        verify(sessionRepository).save(session);
    }

    @Test
    void completeSession_notFound_throws404() {
        when(sessionRepository.findByIdAndUserId(SESSION_ID, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.completeSession(SESSION_ID, USER_ID))
                .isInstanceOf(SessionNotFoundException.class);
    }

    @Test
    void completeSession_alreadyCompleted_throws409() {
        InterviewSession session = sessionWithQuestion("COMPLETED", "answered");
        when(sessionRepository.findByIdAndUserId(SESSION_ID, USER_ID)).thenReturn(Optional.of(session));

        assertThatThrownBy(() -> service.completeSession(SESSION_ID, USER_ID))
                .isInstanceOf(SessionAlreadyCompletedException.class);
    }

    @Test
    void completeSession_incomplete_throws422() {
        InterviewSession session = sessionWithQuestion("IN_PROGRESS", null);
        when(sessionRepository.findByIdAndUserId(SESSION_ID, USER_ID)).thenReturn(Optional.of(session));
        when(questionRepository.existsBySessionIdAndUserAnswerIsNull(SESSION_ID)).thenReturn(true);

        assertThatThrownBy(() -> service.completeSession(SESSION_ID, USER_ID))
                .isInstanceOf(SessionIncompleteException.class);
    }

    @Test
    void getSessions_returnsSummariesNewestFirst() {
        InterviewSession s1 = sessionWithQuestion("COMPLETED", "a");
        InterviewSession s2 = sessionWithQuestion("IN_PROGRESS", null);
        when(sessionRepository.findByUserIdOrderByCreatedAtDesc(USER_ID)).thenReturn(List.of(s1, s2));

        List<SessionSummaryResponse> result = service.getSessions(USER_ID);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).status()).isEqualTo("COMPLETED");
        assertThat(result.get(0).targetRole()).isEqualTo("Backend Developer");
    }

    @Test
    void getSession_success_returnsFullSession() {
        InterviewSession session = sessionWithQuestion("IN_PROGRESS", null);
        when(sessionRepository.findByIdAndUserId(SESSION_ID, USER_ID)).thenReturn(Optional.of(session));

        SessionResponse response = service.getSession(SESSION_ID, USER_ID);

        assertThat(response.id()).isEqualTo(SESSION_ID);
        assertThat(response.questions()).hasSize(1);
        assertThat(response.questions().get(0).questionText()).isEqualTo("Explain REST");
    }

    @Test
    void getSession_notFound_throws404() {
        when(sessionRepository.findByIdAndUserId(SESSION_ID, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getSession(SESSION_ID, USER_ID))
                .isInstanceOf(SessionNotFoundException.class);
    }

    @Test
    void deleteSession_success_deletesSession() {
        InterviewSession session = sessionWithQuestion("IN_PROGRESS", null);
        when(sessionRepository.findByIdAndUserId(SESSION_ID, USER_ID)).thenReturn(Optional.of(session));

        service.deleteSession(SESSION_ID, USER_ID);

        verify(sessionRepository).delete(session);
    }

    @Test
    void deleteSession_notFound_throws404() {
        when(sessionRepository.findByIdAndUserId(SESSION_ID, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deleteSession(SESSION_ID, USER_ID))
                .isInstanceOf(SessionNotFoundException.class);
    }

    // ===== US6 — transcribe =====

    private MultipartFile audioFile(String mime) {
        return new MockMultipartFile("audio", "answer.m4a", mime, new byte[]{1, 2, 3, 4});
    }

    @Test
    void transcribe_validAudio_returnsTranscript() {
        when(sessionRepository.findByIdAndUserId(SESSION_ID, USER_ID))
                .thenReturn(Optional.of(sessionWithQuestion("IN_PROGRESS", null)));
        when(whisperTranscriptionService.transcribe(any(byte[].class), eq("audio/m4a")))
                .thenReturn("I would use REST.");

        TranscribeResponse result = service.transcribe(SESSION_ID, QUESTION_ID, audioFile("audio/m4a"), USER_ID);

        assertThat(result.transcript()).isEqualTo("I would use REST.");
    }

    @Test
    void transcribe_nullAudio_throws400() {
        assertThatThrownBy(() -> service.transcribe(SESSION_ID, QUESTION_ID, null, USER_ID))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void transcribe_emptyAudio_throws400() {
        MultipartFile empty = new MockMultipartFile("audio", "answer.m4a", "audio/m4a", new byte[0]);

        assertThatThrownBy(() -> service.transcribe(SESSION_ID, QUESTION_ID, empty, USER_ID))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void transcribe_wrongMime_throws400() {
        assertThatThrownBy(() -> service.transcribe(SESSION_ID, QUESTION_ID, audioFile("video/mp4"), USER_ID))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void transcribe_sessionNotFound_throws404() {
        when(sessionRepository.findByIdAndUserId(SESSION_ID, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transcribe(SESSION_ID, QUESTION_ID, audioFile("audio/m4a"), USER_ID))
                .isInstanceOf(SessionNotFoundException.class);
    }

    @Test
    void transcribe_completedSession_throws409() {
        when(sessionRepository.findByIdAndUserId(SESSION_ID, USER_ID))
                .thenReturn(Optional.of(sessionWithQuestion("COMPLETED", null)));

        assertThatThrownBy(() -> service.transcribe(SESSION_ID, QUESTION_ID, audioFile("audio/m4a"), USER_ID))
                .isInstanceOf(SessionAlreadyCompletedException.class);
    }

    @Test
    void transcribe_alreadyAnsweredQuestion_throws409() {
        when(sessionRepository.findByIdAndUserId(SESSION_ID, USER_ID))
                .thenReturn(Optional.of(sessionWithQuestion("IN_PROGRESS", "previous answer")));

        assertThatThrownBy(() -> service.transcribe(SESSION_ID, QUESTION_ID, audioFile("audio/m4a"), USER_ID))
                .isInstanceOf(QuestionAlreadyAnsweredException.class);
    }

    @Test
    void transcribe_unknownQuestion_throws404() {
        when(sessionRepository.findByIdAndUserId(SESSION_ID, USER_ID))
                .thenReturn(Optional.of(sessionWithQuestion("IN_PROGRESS", null)));

        assertThatThrownBy(() -> service.transcribe(SESSION_ID, UUID.randomUUID(), audioFile("audio/m4a"), USER_ID))
                .isInstanceOf(SessionNotFoundException.class);
    }

    @Test
    void transcribe_emptyTranscriptFromWhisper_throwsEmptyTranscript() {
        when(sessionRepository.findByIdAndUserId(SESSION_ID, USER_ID))
                .thenReturn(Optional.of(sessionWithQuestion("IN_PROGRESS", null)));
        when(whisperTranscriptionService.transcribe(any(byte[].class), eq("audio/m4a")))
                .thenThrow(new EmptyTranscriptException("No speech detected"));

        assertThatThrownBy(() -> service.transcribe(SESSION_ID, QUESTION_ID, audioFile("audio/m4a"), USER_ID))
                .isInstanceOf(EmptyTranscriptException.class);
    }

    @Test
    void transcribe_whisperDown_throwsAiService() {
        when(sessionRepository.findByIdAndUserId(SESSION_ID, USER_ID))
                .thenReturn(Optional.of(sessionWithQuestion("IN_PROGRESS", null)));
        when(whisperTranscriptionService.transcribe(any(byte[].class), eq("audio/m4a")))
                .thenThrow(new AiServiceException("AI service unavailable"));

        assertThatThrownBy(() -> service.transcribe(SESSION_ID, QUESTION_ID, audioFile("audio/m4a"), USER_ID))
                .isInstanceOf(AiServiceException.class);
    }

    private InterviewSession sessionWithQuestion(String status, String existingAnswer) {
        InterviewSession session = new InterviewSession();
        session.setId(SESSION_ID);
        session.setUserId(USER_ID);
        session.setTargetRole("Backend Developer");
        session.setDifficulty("ENTRY");
        session.setStatus(status);
        session.setCreatedAt(Instant.parse("2026-07-08T10:00:00Z"));

        InterviewQuestion question = new InterviewQuestion();
        question.setId(QUESTION_ID);
        question.setQuestionText("Explain REST");
        question.setCategory("TECHNICAL");
        question.setOrderIndex(1);
        question.setUserAnswer(existingAnswer);
        if (existingAnswer != null) {
            question.setScore(7);
            question.setFeedback("Good.");
            question.setAnsweredAt(Instant.parse("2026-07-08T10:05:00Z"));
        }
        session.addQuestion(question);
        return session;
    }
}
