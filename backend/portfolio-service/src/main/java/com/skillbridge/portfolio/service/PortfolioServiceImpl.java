package com.skillbridge.portfolio.service;

import com.skillbridge.portfolio.dto.request.BatchCreateItemsRequest;
import com.skillbridge.portfolio.dto.request.ExtractUrlRequest;
import com.skillbridge.portfolio.dto.request.PortfolioItemRequest;
import com.skillbridge.portfolio.dto.request.PortfolioItemUpdateRequest;
import com.skillbridge.portfolio.dto.request.VerificationDecisionRequest;
import com.skillbridge.portfolio.dto.response.ExtractedItemResponse;
import com.skillbridge.portfolio.dto.response.PortfolioItemResponse;
import com.skillbridge.portfolio.dto.response.ShareLinkResponse;
import com.skillbridge.portfolio.dto.response.VerificationRequestResponse;
import com.skillbridge.portfolio.entity.PortfolioItem;
import com.skillbridge.portfolio.entity.PortfolioLink;
import com.skillbridge.portfolio.entity.VerificationRequest;
import com.skillbridge.portfolio.exception.AiServiceException;
import com.skillbridge.portfolio.exception.DuplicateVerificationException;
import com.skillbridge.portfolio.exception.PortfolioItemNotFoundException;
import com.skillbridge.portfolio.exception.VerificationAlreadyResolvedException;
import com.skillbridge.portfolio.exception.VerificationRequestNotFoundException;
import com.skillbridge.portfolio.repository.PortfolioItemRepository;
import com.skillbridge.portfolio.repository.PortfolioLinkRepository;
import com.skillbridge.portfolio.repository.VerificationRequestRepository;
import com.skillbridge.portfolio.service.dto.ClaudeVerificationResponse;
import com.skillbridge.portfolio.service.dto.ExtractedItemTemplate;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PortfolioServiceImpl implements PortfolioService {

    private static final Logger log = LoggerFactory.getLogger(PortfolioServiceImpl.class);

    private final PortfolioItemRepository portfolioItemRepository;
    private final VerificationRequestRepository verificationRequestRepository;
    private final PortfolioLinkRepository portfolioLinkRepository;
    private final ShareTokenGenerator shareTokenGenerator;
    private final ClaudeVerificationService claudeVerificationService;
    private final ClaudeExtractionService claudeExtractionService;
    private final FileParserService fileParserService;
    private final WebsiteFetchService websiteFetchService;

    @Override
    public PortfolioItemResponse createItem(PortfolioItemRequest request, UUID userId) {
        PortfolioItem item = new PortfolioItem();
        item.setUserId(userId);
        item.setItemType(request.itemType());
        item.setTitle(request.title());
        item.setDescription(request.description());
        item.setExternalUrl(request.externalUrl());
        PortfolioItem saved = portfolioItemRepository.save(item);
        return toResponse(saved, "NONE");
    }

    @Override
    public PortfolioItemResponse updateItem(UUID itemId, PortfolioItemUpdateRequest request, UUID userId) {
        PortfolioItem item = portfolioItemRepository.findByIdAndUserId(itemId, userId)
                .orElseThrow(() -> new PortfolioItemNotFoundException("Portfolio item not found: " + itemId));
        if (request.title() != null) item.setTitle(request.title());
        if (request.description() != null) item.setDescription(request.description());
        if (request.externalUrl() != null) item.setExternalUrl(request.externalUrl());
        if (request.displayOrder() != null) item.setDisplayOrder(request.displayOrder());
        PortfolioItem saved = portfolioItemRepository.save(item);
        String status = deriveVerificationStatus(saved.isVerified(), saved.getVerificationRequests());
        return toResponse(saved, status);
    }

    @Override
    @Transactional
    public void deleteItem(UUID itemId, UUID userId) {
        PortfolioItem item = portfolioItemRepository.findByIdAndUserId(itemId, userId)
                .orElseThrow(() -> new PortfolioItemNotFoundException("Portfolio item not found: " + itemId));
        portfolioItemRepository.delete(item);
    }

    @Override
    public List<PortfolioItemResponse> getMyPortfolio(UUID userId) {
        return portfolioItemRepository.findByUserIdWithVerificationRequests(userId)
                .stream()
                .map(item -> {
                    String status = deriveVerificationStatus(item.isVerified(), item.getVerificationRequests());
                    return toResponse(item, status);
                })
                .toList();
    }

    @Override
    public List<PortfolioItemResponse> getPublicPortfolio(UUID userId) {
        return portfolioItemRepository.findByUserIdAndVerifiedTrue(userId)
                .stream()
                .sorted(Comparator.comparingInt(PortfolioItem::getDisplayOrder)
                        .thenComparing(Comparator.comparing(PortfolioItem::getCreatedAt).reversed()))
                .map(item -> toResponse(item, "APPROVED"))
                .toList();
    }

    @Override
    @Transactional
    public VerificationRequestResponse requestVerification(UUID itemId, UUID requestedBy) {
        PortfolioItem item = portfolioItemRepository.findByIdAndUserId(itemId, requestedBy)
                .orElseThrow(() -> new PortfolioItemNotFoundException("Portfolio item not found: " + itemId));
        if (verificationRequestRepository.existsByPortfolioItemIdAndStatus(itemId, "PENDING")) {
            throw new DuplicateVerificationException(
                    "A verification request is already pending for this item");
        }
        VerificationRequest vr = new VerificationRequest();
        vr.setPortfolioItem(item);
        vr.setRequestedBy(requestedBy);
        vr.setRequestedAt(Instant.now());

        try {
            ClaudeVerificationResponse aiResult = claudeVerificationService.verify(item);
            String decision = aiResult.decision();
            vr.setStatus(decision);
            vr.setReviewerNote(aiResult.reason());
            vr.setReviewSource("AI");
            vr.setReviewedAt(Instant.now());
            if ("APPROVED".equals(decision)) {
                item.setVerified(true);
                portfolioItemRepository.save(item);
            }
        } catch (AiServiceException e) {
            log.warn("AI verification failed for item {}, falling back to PENDING: {}", itemId, e.getMessage());
            vr.setStatus("PENDING");
            vr.setReviewSource("PENDING_FALLBACK");
        }

        VerificationRequest saved = verificationRequestRepository.save(vr);
        return toVerificationResponse(saved);
    }

    @Override
    @Transactional
    public VerificationRequestResponse reviewVerification(UUID requestId, VerificationDecisionRequest decision,
                                                          UUID reviewedBy, String reviewerRole) {
        if (!reviewerRole.equals("ADMIN")) {
            throw new AccessDeniedException("Access denied");
        }
        VerificationRequest vr = verificationRequestRepository.findById(requestId)
                .orElseThrow(() -> new VerificationRequestNotFoundException(
                        "Verification request not found: " + requestId));
        if (!vr.getStatus().equals("PENDING")) {
            throw new VerificationAlreadyResolvedException("Verification request is already resolved");
        }
        vr.setStatus(decision.decision());
        vr.setReviewedBy(reviewedBy);
        vr.setReviewerNote(decision.reviewerNote());
        vr.setReviewedAt(Instant.now());
        vr.setReviewSource("HUMAN");
        if ("APPROVED".equals(decision.decision())) {
            vr.getPortfolioItem().setVerified(true);
            portfolioItemRepository.save(vr.getPortfolioItem());
        }
        return toVerificationResponse(verificationRequestRepository.save(vr));
    }

    @Override
    public ShareLinkResponse generateShareLink(UUID userId, String baseUrl) {
        return portfolioLinkRepository.findByUserId(userId)
                .map(link -> toShareResponse(link, baseUrl))
                .orElseGet(() -> {
                    PortfolioLink link = new PortfolioLink();
                    link.setUserId(userId);
                    link.setShareToken(shareTokenGenerator.generateToken());
                    return toShareResponse(portfolioLinkRepository.save(link), baseUrl);
                });
    }

    @Override
    public List<PortfolioItemResponse> getSharePortfolio(String token) {
        PortfolioLink link = portfolioLinkRepository.findByShareTokenAndActiveTrue(token)
                .orElseThrow(() -> new PortfolioItemNotFoundException("Share link not found"));
        return getPublicPortfolio(link.getUserId());
    }

    @Override
    @Transactional
    public List<PortfolioItemResponse> batchCreateItems(BatchCreateItemsRequest request, UUID userId) {
        return request.items().stream()
                .map(itemReq -> {
                    PortfolioItem item = new PortfolioItem();
                    item.setUserId(userId);
                    item.setItemType(itemReq.itemType());
                    item.setTitle(itemReq.title());
                    item.setDescription(itemReq.description());
                    item.setExternalUrl(itemReq.externalUrl());
                    return portfolioItemRepository.save(item);
                })
                .map(item -> toResponse(item, "NONE"))
                .toList();
    }

    @Override
    public List<ExtractedItemResponse> extractFromCV(MultipartFile file, UUID userId) {
        log.info("Extraction request: userId={} source=CV filename={} size={}bytes", userId, file.getOriginalFilename(), file.getSize());
        String text = fileParserService.extractText(file);
        log.info("CV text extracted: {} chars", text.length());
        List<ExtractedItemTemplate> templates = claudeExtractionService.extract(text);
        List<ExtractedItemTemplate> deduped = deduplicate(templates, userId);
        return deduped.stream()
                .map(this::toExtractedResponse)
                .toList();
    }

    @Override
    public List<ExtractedItemResponse> extractFromUrl(ExtractUrlRequest request, UUID userId) {
        log.info("Extraction request: userId={} source=URL url={}", userId, request.url());
        String text = websiteFetchService.fetchAndClean(request.url());
        log.info("Website text fetched: {} chars", text.length());
        List<ExtractedItemTemplate> templates = claudeExtractionService.extract(text);
        List<ExtractedItemTemplate> deduped = deduplicate(templates, userId);
        return deduped.stream()
                .map(this::toExtractedResponse)
                .toList();
    }

    private static final Set<String> ALLOWED_ITEM_TYPES = Set.of(
            "PROJECT", "CERTIFICATION", "AWARD", "PUBLICATION", "OTHER");

    private List<ExtractedItemTemplate> deduplicate(List<ExtractedItemTemplate> templates, UUID userId) {
        int before = templates.size();

        Set<String> existingTitles = portfolioItemRepository.findByUserIdWithVerificationRequests(userId)
                .stream()
                .map(item -> normaliseTitle(item.getTitle()))
                .collect(java.util.stream.Collectors.toSet());

        Set<String> seen = new java.util.LinkedHashSet<>();
        List<ExtractedItemTemplate> result = new java.util.ArrayList<>();

        for (ExtractedItemTemplate template : templates) {
            String key = normaliseTitle(template.title());
            if (seen.contains(key)) {
                log.info("Dedup: removed duplicate within extraction: \"{}\"", template.title());
                continue;
            }
            if (existingTitles.contains(key)) {
                log.info("Dedup: removed item already in portfolio: \"{}\"", template.title());
                continue;
            }
            seen.add(key);
            result.add(template);
        }

        int removed = before - result.size();
        if (removed > 0) {
            log.info("Dedup: removed {} duplicate(s), {} item(s) remaining", removed, result.size());
        }
        return result;
    }

    private static String normaliseTitle(String title) {
        if (title == null) return "";
        return title.trim().toLowerCase().replaceAll("\\s+", " ");
    }

    private ExtractedItemResponse toExtractedResponse(ExtractedItemTemplate template) {
        String normalisedType = template.itemType() != null
                ? template.itemType().toUpperCase().trim()
                : "OTHER";
        if (!ALLOWED_ITEM_TYPES.contains(normalisedType)) {
            log.info("Normalising unknown itemType '{}' to OTHER for item \"{}\"", template.itemType(), template.title());
            normalisedType = "OTHER";
        }
        return new ExtractedItemResponse(
                normalisedType,
                template.title(),
                template.description(),
                template.externalUrl(),
                template.confidence()
        );
    }

    private String deriveVerificationStatus(boolean verified, Set<VerificationRequest> requests) {
        if (verified) return "APPROVED";
        if (requests == null || requests.isEmpty()) return "NONE";
        boolean hasPending = requests.stream().anyMatch(r -> "PENDING".equals(r.getStatus()));
        if (hasPending) return "PENDING";
        boolean hasRejected = requests.stream().anyMatch(r -> "REJECTED".equals(r.getStatus()));
        if (hasRejected) return "REJECTED";
        return "NONE";
    }

    private PortfolioItemResponse toResponse(PortfolioItem item, String verificationStatus) {
        return new PortfolioItemResponse(
                item.getId(), item.getUserId(), item.getItemType(), item.getTitle(),
                item.getDescription(), item.getExternalUrl(), item.isVerified(),
                verificationStatus, item.getDisplayOrder(), item.getCreatedAt()
        );
    }

    private VerificationRequestResponse toVerificationResponse(VerificationRequest vr) {
        return new VerificationRequestResponse(
                vr.getId(), vr.getPortfolioItem().getId(), vr.getStatus(),
                vr.getReviewerNote(), vr.getReviewSource(),
                vr.getRequestedAt(), vr.getReviewedAt()
        );
    }

    private ShareLinkResponse toShareResponse(PortfolioLink link, String baseUrl) {
        return new ShareLinkResponse(
                link.getShareToken(),
                baseUrl + "/portfolio/share/" + link.getShareToken(),
                link.isActive(),
                link.getCreatedAt()
        );
    }
}
