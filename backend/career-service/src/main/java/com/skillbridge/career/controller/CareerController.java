package com.skillbridge.career.controller;

import com.skillbridge.career.dto.request.CompleteMilestoneRequest;
import com.skillbridge.career.dto.request.GenerateRoadmapRequest;
import com.skillbridge.career.dto.response.CareerPathResponse;
import com.skillbridge.career.dto.response.CompletionResponse;
import com.skillbridge.career.dto.response.RoadmapResponse;
import com.skillbridge.career.security.JwtUserDetails;
import com.skillbridge.career.service.CareerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/career")
@RequiredArgsConstructor
public class CareerController {

    private final CareerService careerService;

    @PostMapping("/roadmap/generate")
    public ResponseEntity<RoadmapResponse> generateRoadmap(
            @Valid @RequestBody GenerateRoadmapRequest request,
            @AuthenticationPrincipal JwtUserDetails principal) {
        if (!principal.role().equals(request.role())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        RoadmapResponse response = careerService.generateRoadmap(request, principal.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/roadmap/{userId}")
    public ResponseEntity<RoadmapResponse> getRoadmap(
            @PathVariable UUID userId,
            @AuthenticationPrincipal JwtUserDetails principal) {
        return ResponseEntity.ok(careerService.getRoadmap(userId, principal.userId()));
    }

    @PatchMapping("/milestones/{milestoneId}/complete")
    public ResponseEntity<CompletionResponse> completeMilestone(
            @PathVariable UUID milestoneId,
            @RequestBody(required = false) CompleteMilestoneRequest request,
            @AuthenticationPrincipal JwtUserDetails principal) {
        return ResponseEntity.ok(careerService.completeMilestone(milestoneId, principal.userId(), request));
    }

    @GetMapping("/paths")
    public ResponseEntity<List<CareerPathResponse>> getCareerPaths() {
        return ResponseEntity.ok(careerService.getCareerPaths());
    }
}
