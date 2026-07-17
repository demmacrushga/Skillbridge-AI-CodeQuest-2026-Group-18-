package com.skillbridge.mockinterview.controller;

import com.skillbridge.mockinterview.dto.request.StartSessionRequest;
import com.skillbridge.mockinterview.dto.request.SubmitAnswerRequest;
import com.skillbridge.mockinterview.dto.response.QuestionResponse;
import com.skillbridge.mockinterview.dto.response.SessionResponse;
import com.skillbridge.mockinterview.dto.response.SessionSummaryResponse;
import com.skillbridge.mockinterview.dto.response.TranscribeResponse;
import com.skillbridge.mockinterview.security.JwtUserDetails;
import com.skillbridge.mockinterview.service.MockInterviewService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/mock-interview")
@Validated
public class MockInterviewController {

    private final MockInterviewService mockInterviewService;

    public MockInterviewController(MockInterviewService mockInterviewService) {
        this.mockInterviewService = mockInterviewService;
    }

    @PostMapping("/sessions")
    @ResponseStatus(HttpStatus.CREATED)
    public SessionResponse startSession(
            @Valid @RequestBody StartSessionRequest request,
            @AuthenticationPrincipal JwtUserDetails principal) {
        return mockInterviewService.startSession(request, principal.userId());
    }

    @GetMapping("/sessions")
    public List<SessionSummaryResponse> listSessions(
            @AuthenticationPrincipal JwtUserDetails principal) {
        return mockInterviewService.getSessions(principal.userId());
    }

    @GetMapping("/sessions/{sessionId}")
    public SessionResponse getSession(
            @PathVariable UUID sessionId,
            @AuthenticationPrincipal JwtUserDetails principal) {
        return mockInterviewService.getSession(sessionId, principal.userId());
    }

    @PostMapping("/sessions/{sessionId}/questions/{questionId}/answer")
    public QuestionResponse submitAnswer(
            @PathVariable UUID sessionId,
            @PathVariable UUID questionId,
            @Valid @RequestBody SubmitAnswerRequest request,
            @AuthenticationPrincipal JwtUserDetails principal) {
        return mockInterviewService.submitAnswer(sessionId, questionId, request, principal.userId());
    }

@PostMapping(
            path = "/sessions/{sessionId}/questions/{questionId}/transcribe",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public TranscribeResponse transcribeAnswer(
            @PathVariable UUID sessionId,
            @PathVariable UUID questionId,
            @RequestParam("audio") MultipartFile audio,
            @AuthenticationPrincipal JwtUserDetails principal) {
        return mockInterviewService.transcribe(sessionId, questionId, audio, principal.userId());
    }

    @PostMapping("/sessions/{sessionId}/complete")
    public SessionResponse completeSession(
            @PathVariable UUID sessionId,
            @AuthenticationPrincipal JwtUserDetails principal) {
        return mockInterviewService.completeSession(sessionId, principal.userId());
    }

    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<Void> deleteSession(
            @PathVariable UUID sessionId,
            @AuthenticationPrincipal JwtUserDetails principal) {
        mockInterviewService.deleteSession(sessionId, principal.userId());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP"));
    }
}
