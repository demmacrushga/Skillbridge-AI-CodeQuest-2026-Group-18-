package com.skillbridge.skillgap.controller;

import com.skillbridge.skillgap.dto.response.ReportResponse;
import com.skillbridge.skillgap.security.JwtUserDetails;
import com.skillbridge.skillgap.service.SkillGapService;
import jakarta.validation.constraints.NotBlank;
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
@RequestMapping("/skill-gap")
@Validated
public class SkillGapController {

    private final SkillGapService skillGapService;

    public SkillGapController(SkillGapService skillGapService) {
        this.skillGapService = skillGapService;
    }

    @PostMapping(value = "/analyse", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ReportResponse analyseCV(
            @RequestPart("file") MultipartFile file,
            @RequestParam @NotBlank String targetRole,
            @AuthenticationPrincipal JwtUserDetails principal) {
        return skillGapService.analyseCV(file, targetRole, principal.userId());
    }

    @GetMapping("/reports/{reportId}")
    public ReportResponse getReport(
            @PathVariable UUID reportId,
            @AuthenticationPrincipal JwtUserDetails principal) {
        return skillGapService.getReport(reportId, principal.userId());
    }

    @GetMapping("/reports")
    public List<ReportResponse> getUserReports(
            @AuthenticationPrincipal JwtUserDetails principal) {
        return skillGapService.getUserReports(principal.userId());
    }

    @DeleteMapping("/reports/{reportId}")
    public ResponseEntity<Void> deleteReport(
            @PathVariable UUID reportId,
            @AuthenticationPrincipal JwtUserDetails principal) {
        skillGapService.deleteReport(reportId, principal.userId());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP"));
    }
}
