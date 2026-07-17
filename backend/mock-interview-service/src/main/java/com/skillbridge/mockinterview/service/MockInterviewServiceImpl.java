package com.skillbridge.mockinterview.service;

import com.skillbridge.mockinterview.dto.request.StartSessionRequest;
import com.skillbridge.mockinterview.dto.request.SubmitAnswerRequest;
import com.skillbridge.mockinterview.dto.response.QuestionResponse;
import com.skillbridge.mockinterview.dto.response.SessionResponse;
import com.skillbridge.mockinterview.dto.response.SessionSummaryResponse;
import com.skillbridge.mockinterview.dto.response.TranscribeResponse;
import com.skillbridge.mockinterview.entity.InterviewQuestion;
import com.skillbridge.mockinterview.entity.InterviewSession;
import com.skillbridge.mockinterview.exception.AiServiceException;
import com.skillbridge.mockinterview.exception.QuestionAlreadyAnsweredException;
import com.skillbridge.mockinterview.exception.SessionAlreadyCompletedException;
import com.skillbridge.mockinterview.exception.SessionIncompleteException;
import com.skillbridge.mockinterview.exception.SessionNotFoundException;
import com.skillbridge.mockinterview.repository.InterviewQuestionRepository;
import com.skillbridge.mockinterview.repository.InterviewSessionRepository;
import com.skillbridge.mockinterview.service.dto.AnswerEvaluationTemplate;
import com.skillbridge.mockinterview.service.dto.QuestionTemplate;
import com.skillbridge.mockinterview.service.dto.SessionSummaryTemplate;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MockInterviewServiceImpl implements MockInterviewService {

    private static final long MAX_AUDIO_BYTES = 25L * 1024 * 1024;
    private static final Set<String> ALLOWED_AUDIO_TYPES = Set.of("audio/mpeg", "audio/m4a", "audio/wav");

    private final InterviewSessionRepository sessionRepository;
    private final InterviewQuestionRepository questionRepository;
    private final ClaudeInterviewService claudeInterviewService;
    private final WhisperTranscriptionService whisperTranscriptionService;

    @Override
    @Transactional
    public SessionResponse startSession(StartSessionRequest request, UUID userId) {
        List<QuestionTemplate> templates = claudeInterviewService.generateQuestions(
                request.targetRole(), request.difficulty().name());
        if (templates == null || templates.isEmpty()) {
            throw new AiServiceException("AI returned no interview questions");
        }

        InterviewSession session = new InterviewSession();
        session.setUserId(userId);
        session.setTargetRole(request.targetRole());
        session.setDifficulty(request.difficulty().name());

        for (QuestionTemplate t : templates) {
            InterviewQuestion question = new InterviewQuestion();
            question.setQuestionText(t.questionText());
            question.setCategory(t.category());
            question.setOrderIndex(t.orderIndex());
            session.addQuestion(question);
        }

        sessionRepository.save(session);
        return toSessionResponse(session);
    }

    @Override
    @Transactional
    public QuestionResponse submitAnswer(UUID sessionId, UUID questionId,
                                         SubmitAnswerRequest request, UUID userId) {
        InterviewSession session = sessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new SessionNotFoundException("Session not found"));

        if ("COMPLETED".equals(session.getStatus())) {
            throw new SessionAlreadyCompletedException("Session is already completed");
        }

        InterviewQuestion question = session.getQuestions().stream()
                .filter(q -> q.getId().equals(questionId))
                .findFirst()
                .orElseThrow(() -> new SessionNotFoundException("Question not found"));

        if (question.getUserAnswer() != null) {
            throw new QuestionAlreadyAnsweredException("Question has already been answered");
        }

        AnswerEvaluationTemplate evaluation = claudeInterviewService.evaluateAnswer(
                session.getTargetRole(),
                session.getDifficulty(),
                question.getQuestionText(),
                question.getCategory(),
                request.answer());

        question.setUserAnswer(request.answer());
        question.setScore(evaluation.score());
        question.setFeedback(evaluation.feedback());
        question.setAnsweredAt(Instant.now());

        sessionRepository.save(session);
        return toQuestionResponse(question);
    }

    @Override
    @Transactional
    public SessionResponse completeSession(UUID sessionId, UUID userId) {
        InterviewSession session = sessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new SessionNotFoundException("Session not found"));

        if ("COMPLETED".equals(session.getStatus())) {
            throw new SessionAlreadyCompletedException("Session is already completed");
        }

        if (questionRepository.existsBySessionIdAndUserAnswerIsNull(sessionId)) {
            throw new SessionIncompleteException("Not all questions have been answered");
        }

        String qaDigest = buildQaDigest(session);
        SessionSummaryTemplate summary = claudeInterviewService.generateSummary(
                session.getTargetRole(), session.getDifficulty(), qaDigest);

        session.setOverallScore(summary.overallScore());
        session.setOverallFeedback(summary.overallFeedback());
        session.setCompletedAt(Instant.now());
        session.setStatus("COMPLETED");

        sessionRepository.save(session);
        return toSessionResponse(session);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SessionSummaryResponse> getSessions(UUID userId) {
        return sessionRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toSessionSummaryResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public SessionResponse getSession(UUID sessionId, UUID userId) {
        InterviewSession session = sessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new SessionNotFoundException("Session not found"));
        return toSessionResponse(session);
    }

    @Override
    @Transactional
    public void deleteSession(UUID sessionId, UUID userId) {
        InterviewSession session = sessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new SessionNotFoundException("Session not found"));
        sessionRepository.delete(session);
    }

    @Override
    @Transactional
    public TranscribeResponse transcribe(UUID sessionId, UUID questionId, MultipartFile audio, UUID userId) {
        if (audio == null || audio.isEmpty()) {
            throw new IllegalArgumentException("audio file is required");
        }
        if (audio.getSize() > MAX_AUDIO_BYTES) {
            throw new IllegalArgumentException("audio file exceeds 25 MB limit");
        }
        String contentType = audio.getContentType();
        if (contentType == null || !ALLOWED_AUDIO_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("audio must be audio/mpeg, audio/m4a, or audio/wav");
        }

        InterviewSession session = sessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new SessionNotFoundException("Session not found"));
        if ("COMPLETED".equals(session.getStatus())) {
            throw new SessionAlreadyCompletedException("Session is already completed");
        }
        InterviewQuestion question = session.getQuestions().stream()
                .filter(q -> q.getId().equals(questionId))
                .findFirst()
                .orElseThrow(() -> new SessionNotFoundException("Question not found"));
        if (question.getUserAnswer() != null) {
            throw new QuestionAlreadyAnsweredException("Question has already been answered");
        }

        byte[] bytes;
        try {
            bytes = audio.getBytes();
        } catch (IOException e) {
            throw new AiServiceException("Could not read audio upload", e);
        }

        String transcript = whisperTranscriptionService.transcribe(bytes, contentType);
        return new TranscribeResponse(transcript);
    }

    private String buildQaDigest(InterviewSession session) {
        StringBuilder sb = new StringBuilder();
        for (InterviewQuestion q : session.getQuestions()) {
            sb.append("Q%d: %s [%s]%n".formatted(q.getOrderIndex(), q.getQuestionText(), q.getCategory()));
            sb.append("Answer: %s%n".formatted(q.getUserAnswer()));
            sb.append("Score: %d%n%n".formatted(q.getScore()));
        }
        return sb.toString();
    }

    private QuestionResponse toQuestionResponse(InterviewQuestion q) {
        return new QuestionResponse(
                q.getId(),
                q.getQuestionText(),
                q.getCategory(),
                q.getOrderIndex(),
                q.getUserAnswer(),
                q.getScore(),
                q.getFeedback(),
                q.getAnsweredAt());
    }

    private SessionResponse toSessionResponse(InterviewSession s) {
        List<QuestionResponse> questions = s.getQuestions().stream()
                .map(this::toQuestionResponse)
                .toList();
        return new SessionResponse(
                s.getId(),
                s.getTargetRole(),
                s.getDifficulty(),
                s.getStatus(),
                s.getOverallScore(),
                s.getOverallFeedback(),
                s.getCreatedAt(),
                s.getCompletedAt(),
                questions);
    }

    private SessionSummaryResponse toSessionSummaryResponse(InterviewSession s) {
        return new SessionSummaryResponse(
                s.getId(),
                s.getTargetRole(),
                s.getDifficulty(),
                s.getStatus(),
                s.getOverallScore(),
                s.getCreatedAt());
    }
}
