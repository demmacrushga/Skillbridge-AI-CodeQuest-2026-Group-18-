package com.skillbridge.mentorship.controller;

import com.skillbridge.mentorship.dto.request.SendMessageRequest;
import com.skillbridge.mentorship.dto.request.SendRequestRequest;
import com.skillbridge.mentorship.dto.request.UpsertProfileRequest;
import com.skillbridge.mentorship.dto.response.AlumniSearchResponse;
import com.skillbridge.mentorship.dto.response.MessageResponse;
import com.skillbridge.mentorship.dto.response.PairResponse;
import com.skillbridge.mentorship.dto.response.ProfileResponse;
import com.skillbridge.mentorship.dto.response.RequestResponse;
import com.skillbridge.mentorship.dto.response.ThreadResponse;
import com.skillbridge.mentorship.security.JwtUserDetails;
import com.skillbridge.mentorship.service.MentorshipService;
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
@RequestMapping("/mentorship")
@RequiredArgsConstructor
public class MentorshipController {

    private final MentorshipService mentorshipService;

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP"));
    }

    // ── US1: Mentor profile (ALUMNI) ───────────────────────────────────
    @GetMapping("/profile")
    @PreAuthorize("hasRole('ALUMNI')")
    public ResponseEntity<ProfileResponse> getProfile(@AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(mentorshipService.getProfile(user.userId()));
    }

    @PutMapping("/profile")
    @PreAuthorize("hasRole('ALUMNI')")
    public ResponseEntity<ProfileResponse> upsertProfile(
            @Valid @RequestBody UpsertProfileRequest request,
            @AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(mentorshipService.upsertProfile(user.userId(), request));
    }

    // ── US2: Discover alumni (STUDENT) ─────────────────────────────────
    @GetMapping("/alumni")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<AlumniSearchResponse> searchAlumni(
            @RequestParam(name = "interest", required = false) List<String> interests,
            @RequestParam(name = "industry", required = false) String industry) {
        return ResponseEntity.ok(mentorshipService.searchAlumni(interests, industry));
    }

    // ── US3: Mentorship requests (STUDENT) ─────────────────────────────
    @PostMapping("/requests")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<RequestResponse> sendRequest(
            @Valid @RequestBody SendRequestRequest request,
            @AuthenticationPrincipal JwtUserDetails user) {
        RequestResponse response = mentorshipService.sendRequest(user.userId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/requests/{requestId}/cancel")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<RequestResponse> cancelRequest(
            @PathVariable UUID requestId,
            @AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(mentorshipService.cancelRequest(user.userId(), requestId));
    }

    @GetMapping("/requests/mine")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<List<RequestResponse>> getMyRequests(@AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(mentorshipService.getMyRequests(user.userId()));
    }

    // ── US4: Respond to requests (ALUMNI) ──────────────────────────────
    @GetMapping("/requests/incoming")
    @PreAuthorize("hasRole('ALUMNI')")
    public ResponseEntity<List<RequestResponse>> getIncomingRequests(@AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(mentorshipService.getIncomingRequests(user.userId()));
    }

    @PostMapping("/requests/{requestId}/accept")
    @PreAuthorize("hasRole('ALUMNI')")
    public ResponseEntity<PairResponse> acceptRequest(
            @PathVariable UUID requestId,
            @AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(mentorshipService.acceptRequest(user.userId(), requestId));
    }

    @PostMapping("/requests/{requestId}/decline")
    @PreAuthorize("hasRole('ALUMNI')")
    public ResponseEntity<RequestResponse> declineRequest(
            @PathVariable UUID requestId,
            @AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(mentorshipService.declineRequest(user.userId(), requestId));
    }

    // ── US6: My pairs / end (participant, any authenticated role) ──────
    @GetMapping("/pairs/mine")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<PairResponse>> getMyPairs(@AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(mentorshipService.getMyPairs(user.userId()));
    }

    @PostMapping("/pairs/{pairId}/end")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PairResponse> endPair(
            @PathVariable UUID pairId,
            @AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(mentorshipService.endPair(user.userId(), pairId));
    }

    // ── US5: Message thread (participant) ──────────────────────────────
    @GetMapping("/pairs/{pairId}/messages")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ThreadResponse> getThread(
            @PathVariable UUID pairId,
            @AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(mentorshipService.getThread(user.userId(), pairId));
    }

    @PostMapping("/pairs/{pairId}/messages")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageResponse> sendMessage(
            @PathVariable UUID pairId,
            @Valid @RequestBody SendMessageRequest request,
            @AuthenticationPrincipal JwtUserDetails user) {
        MessageResponse response = mentorshipService.sendMessage(user.userId(), pairId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
