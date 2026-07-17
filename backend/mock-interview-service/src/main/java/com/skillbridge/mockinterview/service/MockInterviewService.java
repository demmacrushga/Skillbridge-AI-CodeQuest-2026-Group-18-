package com.skillbridge.mockinterview.service;

import com.skillbridge.mockinterview.dto.request.StartSessionRequest;
import com.skillbridge.mockinterview.dto.request.SubmitAnswerRequest;
import com.skillbridge.mockinterview.dto.response.QuestionResponse;
import com.skillbridge.mockinterview.dto.response.SessionResponse;
import com.skillbridge.mockinterview.dto.response.SessionSummaryResponse;
import com.skillbridge.mockinterview.dto.response.TranscribeResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

public interface MockInterviewService {

    SessionResponse startSession(StartSessionRequest request, UUID userId);

    QuestionResponse submitAnswer(UUID sessionId, UUID questionId, SubmitAnswerRequest request, UUID userId);

    SessionResponse completeSession(UUID sessionId, UUID userId);

    List<SessionSummaryResponse> getSessions(UUID userId);

    SessionResponse getSession(UUID sessionId, UUID userId);

    void deleteSession(UUID sessionId, UUID userId);

    TranscribeResponse transcribe(UUID sessionId, UUID questionId, MultipartFile audio, UUID userId);
}
