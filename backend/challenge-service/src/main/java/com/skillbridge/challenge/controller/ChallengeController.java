package com.skillbridge.challenge.controller;

import com.skillbridge.challenge.dto.request.PostChallengeRequest;
import com.skillbridge.challenge.dto.request.ScoreSubmissionRequest;
import com.skillbridge.challenge.dto.request.SubmitSolutionRequest;
import com.skillbridge.challenge.dto.response.ChallengeListResponse;
import com.skillbridge.challenge.dto.response.ChallengeResponse;
import com.skillbridge.challenge.dto.response.LeaderboardResponse;
import com.skillbridge.challenge.dto.response.MySubmissionResponse;
import com.skillbridge.challenge.dto.response.SubmissionResponse;
import com.skillbridge.challenge.dto.response.SubmissionReviewResponse;
import com.skillbridge.challenge.security.JwtUserDetails;
import com.skillbridge.challenge.service.ChallengeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/challenge")
@RequiredArgsConstructor
public class ChallengeController {

    private final ChallengeService challengeService;

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP"));
    }

    // ── US1: Post challenge (RECRUITER) ────────────────────────────────
    @PostMapping
    @PreAuthorize("hasRole('RECRUITER')")
    public ResponseEntity<ChallengeResponse> postChallenge(
            @Valid @RequestBody PostChallengeRequest request,
            @AuthenticationPrincipal JwtUserDetails user) {
        ChallengeResponse response = challengeService.postChallenge(request, user.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // ── US2: Browse active challenges (any authenticated) ──────────────
    @GetMapping
    public ResponseEntity<ChallengeListResponse> getActiveChallenges(
            @AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(challengeService.getActiveChallenges(user.userId()));
    }

    // ── US3: Submit solution (STUDENT) ─────────────────────────────────
    @PostMapping("/{challengeId}/submissions")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<SubmissionResponse> submit(
            @PathVariable UUID challengeId,
            @Valid @RequestBody SubmitSolutionRequest request,
            @AuthenticationPrincipal JwtUserDetails user) {
        SubmissionResponse response = challengeService.submit(challengeId, request, user.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // ── US4: My submissions (STUDENT) ──────────────────────────────────
    @GetMapping("/my-submissions")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<List<MySubmissionResponse>> getMySubmissions(
            @AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(challengeService.getMySubmissions(user.userId()));
    }

    // ── US5: Score submissions (RECRUITER, owner) ──────────────────────
    @GetMapping("/{challengeId}/submissions")
    @PreAuthorize("hasRole('RECRUITER')")
    public ResponseEntity<List<SubmissionReviewResponse>> getSubmissionsForReview(
            @PathVariable UUID challengeId,
            @AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(challengeService.getSubmissionsForReview(challengeId, user.userId()));
    }

    @PostMapping("/{challengeId}/submissions/{submissionId}/score")
    @PreAuthorize("hasRole('RECRUITER')")
    public ResponseEntity<SubmissionReviewResponse> scoreSubmission(
            @PathVariable UUID challengeId,
            @PathVariable UUID submissionId,
            @Valid @RequestBody ScoreSubmissionRequest request,
            @AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(
                challengeService.scoreSubmission(challengeId, submissionId, request, user.userId()));
    }

    // ── US6: Leaderboard (any authenticated) ───────────────────────────
    @GetMapping("/{challengeId}/leaderboard")
    public ResponseEntity<LeaderboardResponse> getLeaderboard(
            @PathVariable UUID challengeId) {
        return ResponseEntity.ok(challengeService.getLeaderboard(challengeId));
    }

    // ── US7: Recruiter management (RECRUITER) ──────────────────────────
    @GetMapping("/mine")
    @PreAuthorize("hasRole('RECRUITER')")
    public ResponseEntity<List<ChallengeResponse>> getMyChallenges(
            @AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(challengeService.getMyChallenges(user.userId()));
    }

    @PostMapping("/{challengeId}/deactivate")
    @PreAuthorize("hasRole('RECRUITER')")
    public ResponseEntity<ChallengeResponse> deactivate(
            @PathVariable UUID challengeId,
            @AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(challengeService.deactivate(challengeId, user.userId()));
    }
}
