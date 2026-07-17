package com.skillbridge.portfolio.controller;

import com.skillbridge.portfolio.dto.request.BatchCreateItemsRequest;
import com.skillbridge.portfolio.dto.request.ExtractUrlRequest;
import com.skillbridge.portfolio.dto.request.PortfolioItemRequest;
import com.skillbridge.portfolio.dto.request.PortfolioItemUpdateRequest;
import com.skillbridge.portfolio.dto.request.VerificationDecisionRequest;
import com.skillbridge.portfolio.dto.response.ExtractedItemResponse;
import com.skillbridge.portfolio.dto.response.PortfolioItemResponse;
import com.skillbridge.portfolio.dto.response.ShareLinkResponse;
import com.skillbridge.portfolio.dto.response.VerificationRequestResponse;
import com.skillbridge.portfolio.security.JwtUserDetails;
import com.skillbridge.portfolio.service.PortfolioService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/portfolio")
@RequiredArgsConstructor
public class PortfolioController {

    private final PortfolioService portfolioService;

    @PostMapping("/items")
    public ResponseEntity<PortfolioItemResponse> createItem(
            @Valid @RequestBody PortfolioItemRequest request,
            @AuthenticationPrincipal JwtUserDetails principal) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(portfolioService.createItem(request, principal.userId()));
    }

    @PostMapping("/items/batch")
    public ResponseEntity<List<PortfolioItemResponse>> batchCreateItems(
            @Valid @RequestBody BatchCreateItemsRequest request,
            @AuthenticationPrincipal JwtUserDetails principal) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(portfolioService.batchCreateItems(request, principal.userId()));
    }

    @PostMapping(value = "/extract", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<List<ExtractedItemResponse>> extractFromCV(
            @RequestPart("file") MultipartFile file,
            @AuthenticationPrincipal JwtUserDetails principal) {
        return ResponseEntity.ok(portfolioService.extractFromCV(file, principal.userId()));
    }

    @PostMapping("/extract-url")
    public ResponseEntity<List<ExtractedItemResponse>> extractFromUrl(
            @Valid @RequestBody ExtractUrlRequest request,
            @AuthenticationPrincipal JwtUserDetails principal) {
        return ResponseEntity.ok(portfolioService.extractFromUrl(request, principal.userId()));
    }

    @GetMapping("/mine")
    public ResponseEntity<List<PortfolioItemResponse>> getMyPortfolio(
            @AuthenticationPrincipal JwtUserDetails principal) {
        return ResponseEntity.ok(portfolioService.getMyPortfolio(principal.userId()));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<List<PortfolioItemResponse>> getPublicPortfolio(
            @PathVariable UUID userId) {
        return ResponseEntity.ok(portfolioService.getPublicPortfolio(userId));
    }

    @PutMapping("/items/{itemId}")
    public ResponseEntity<PortfolioItemResponse> updateItem(
            @PathVariable UUID itemId,
            @Valid @RequestBody PortfolioItemUpdateRequest request,
            @AuthenticationPrincipal JwtUserDetails principal) {
        return ResponseEntity.ok(portfolioService.updateItem(itemId, request, principal.userId()));
    }

    @DeleteMapping("/items/{itemId}")
    public ResponseEntity<Void> deleteItem(
            @PathVariable UUID itemId,
            @AuthenticationPrincipal JwtUserDetails principal) {
        portfolioService.deleteItem(itemId, principal.userId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/items/{itemId}/verify")
    public ResponseEntity<VerificationRequestResponse> requestVerification(
            @PathVariable UUID itemId,
            @AuthenticationPrincipal JwtUserDetails principal) {
        return ResponseEntity.ok(portfolioService.requestVerification(itemId, principal.userId()));
    }

    @PatchMapping("/verification/{requestId}")
    public ResponseEntity<VerificationRequestResponse> reviewVerification(
            @PathVariable UUID requestId,
            @Valid @RequestBody VerificationDecisionRequest decision,
            @AuthenticationPrincipal JwtUserDetails principal) {
        return ResponseEntity.ok(portfolioService.reviewVerification(
                requestId, decision, principal.userId(), principal.role()));
    }

    @PostMapping("/share")
    public ResponseEntity<ShareLinkResponse> generateShareLink(
            @AuthenticationPrincipal JwtUserDetails principal,
            HttpServletRequest request) {
        String baseUrl = request.getScheme() + "://" + request.getServerName()
                + ":" + request.getServerPort();
        return ResponseEntity.ok(portfolioService.generateShareLink(principal.userId(), baseUrl));
    }

    @GetMapping("/share/{token}")
    public ResponseEntity<List<PortfolioItemResponse>> getSharePortfolio(
            @PathVariable String token) {
        return ResponseEntity.ok(portfolioService.getSharePortfolio(token));
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP"));
    }
}
