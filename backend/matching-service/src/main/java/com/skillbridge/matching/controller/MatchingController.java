package com.skillbridge.matching.controller;

import com.skillbridge.matching.dto.request.PostOpportunityRequest;
import com.skillbridge.matching.dto.request.UpdateSkillsRequest;
import com.skillbridge.matching.dto.response.ApplicantResponse;
import com.skillbridge.matching.dto.response.ApplicationResponse;
import com.skillbridge.matching.dto.response.ApplicationWithOpportunityResponse;
import com.skillbridge.matching.dto.response.MatchListResponse;
import com.skillbridge.matching.dto.response.OpportunityResponse;
import com.skillbridge.matching.dto.response.SkillsResponse;
import com.skillbridge.matching.security.JwtUserDetails;
import com.skillbridge.matching.service.MatchingService;
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
@RequestMapping("/matching")
@RequiredArgsConstructor
public class MatchingController {

    private final MatchingService matchingService;

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP"));
    }

    // ── US1: Post opportunity (RECRUITER) ──────────────────────────────
    @PostMapping("/opportunities")
    @PreAuthorize("hasRole('RECRUITER')")
    public ResponseEntity<OpportunityResponse> postOpportunity(
            @Valid @RequestBody PostOpportunityRequest request,
            @AuthenticationPrincipal JwtUserDetails user) {
        OpportunityResponse response = matchingService.postOpportunity(request, user.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // ── US2: Ranked matches (any authenticated) ────────────────────────
    @GetMapping("/opportunities")
    public ResponseEntity<MatchListResponse> getMatches(
            @AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(matchingService.getMatches(user.userId()));
    }

    // ── US3: Apply (STUDENT) ───────────────────────────────────────────
    @PostMapping("/opportunities/{opportunityId}/apply")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApplicationResponse> apply(
            @PathVariable UUID opportunityId,
            @AuthenticationPrincipal JwtUserDetails user) {
        ApplicationResponse response = matchingService.apply(opportunityId, user.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // ── US4: My applications (STUDENT) ─────────────────────────────────
    @GetMapping("/applications")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<List<ApplicationWithOpportunityResponse>> getApplications(
            @AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(matchingService.getApplications(user.userId()));
    }

    // ── US5: Skill profile (STUDENT) ───────────────────────────────────
    @GetMapping("/profile/skills")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<SkillsResponse> getSkills(
            @AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(matchingService.getSkills(user.userId()));
    }

    @PutMapping("/profile/skills")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<SkillsResponse> updateSkills(
            @Valid @RequestBody UpdateSkillsRequest request,
            @AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(matchingService.updateSkills(request, user.userId()));
    }

    // ── US6: Recruiter management (RECRUITER) ──────────────────────────
    @GetMapping("/opportunities/mine")
    @PreAuthorize("hasRole('RECRUITER')")
    public ResponseEntity<List<OpportunityResponse>> getMyPostings(
            @AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(matchingService.getMyPostings(user.userId()));
    }

    @PostMapping("/opportunities/{opportunityId}/deactivate")
    @PreAuthorize("hasRole('RECRUITER')")
    public ResponseEntity<OpportunityResponse> deactivate(
            @PathVariable UUID opportunityId,
            @AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(matchingService.deactivate(opportunityId, user.userId()));
    }

    @GetMapping("/opportunities/{opportunityId}/applications")
    @PreAuthorize("hasRole('RECRUITER')")
    public ResponseEntity<List<ApplicantResponse>> getApplicants(
            @PathVariable UUID opportunityId,
            @AuthenticationPrincipal JwtUserDetails user) {
        return ResponseEntity.ok(matchingService.getApplicants(opportunityId, user.userId()));
    }
}
