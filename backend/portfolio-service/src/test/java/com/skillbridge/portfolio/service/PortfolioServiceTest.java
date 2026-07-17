package com.skillbridge.portfolio.service;

import com.skillbridge.portfolio.dto.request.BatchCreateItemsRequest;
import com.skillbridge.portfolio.dto.request.PortfolioItemRequest;
import com.skillbridge.portfolio.dto.request.PortfolioItemUpdateRequest;
import com.skillbridge.portfolio.dto.request.VerificationDecisionRequest;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PortfolioServiceTest {

    @Mock private PortfolioItemRepository portfolioItemRepository;
    @Mock private VerificationRequestRepository verificationRequestRepository;
    @Mock private PortfolioLinkRepository portfolioLinkRepository;
    @Mock private ShareTokenGenerator shareTokenGenerator;
    @Mock private ClaudeVerificationService claudeVerificationService;
    @Mock private ClaudeExtractionService claudeExtractionService;
    @Mock private FileParserService fileParserService;
    @Mock private WebsiteFetchService websiteFetchService;

    @InjectMocks private PortfolioServiceImpl portfolioService;

    private UUID userId;
    private UUID itemId;
    private PortfolioItem item;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        itemId = UUID.randomUUID();
        item = new PortfolioItem();
        item.setId(itemId);
        item.setUserId(userId);
        item.setItemType("PROJECT");
        item.setTitle("Test Project");
        item.setCreatedAt(Instant.now());
        item.setUpdatedAt(Instant.now());
    }

    // ── US1: Item CRUD ────────────────────────────────────────────────────────

    @Test
    void createItem_happyPath_returnsItemWithVerificationStatusNone() {
        PortfolioItemRequest req = new PortfolioItemRequest("PROJECT", "Test", null, null);
        when(portfolioItemRepository.save(any())).thenReturn(item);

        PortfolioItemResponse response = portfolioService.createItem(req, userId);

        assertThat(response.verificationStatus()).isEqualTo("NONE");
        assertThat(response.verified()).isFalse();
    }

    @Test
    void updateItem_notFound_throwsPortfolioItemNotFoundException() {
        when(portfolioItemRepository.findByIdAndUserId(itemId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> portfolioService.updateItem(itemId,
                new PortfolioItemUpdateRequest("New Title", null, null, null), userId))
                .isInstanceOf(PortfolioItemNotFoundException.class);
    }

    @Test
    void updateItem_wrongUser_throwsPortfolioItemNotFoundException() {
        UUID otherUser = UUID.randomUUID();
        when(portfolioItemRepository.findByIdAndUserId(itemId, otherUser)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> portfolioService.updateItem(itemId,
                new PortfolioItemUpdateRequest("Title", null, null, null), otherUser))
                .isInstanceOf(PortfolioItemNotFoundException.class);
    }

    @Test
    void deleteItem_happyPath_callsRepositoryDelete() {
        when(portfolioItemRepository.findByIdAndUserId(itemId, userId)).thenReturn(Optional.of(item));

        portfolioService.deleteItem(itemId, userId);

        verify(portfolioItemRepository).delete(item);
    }

    @Test
    void deleteItem_notFound_throwsPortfolioItemNotFoundException() {
        when(portfolioItemRepository.findByIdAndUserId(itemId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> portfolioService.deleteItem(itemId, userId))
                .isInstanceOf(PortfolioItemNotFoundException.class);
    }

    // ── US2: Portfolio View ───────────────────────────────────────────────────

    @Test
    void getMyPortfolio_itemWithNoRequest_returnsVerificationStatusNone() {
        item.setVerificationRequests(new HashSet<>());
        when(portfolioItemRepository.findByUserIdWithVerificationRequests(userId))
                .thenReturn(List.of(item));

        List<PortfolioItemResponse> result = portfolioService.getMyPortfolio(userId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).verificationStatus()).isEqualTo("NONE");
    }

    @Test
    void getMyPortfolio_itemWithPendingRequest_returnsVerificationStatusPending() {
        VerificationRequest vr = new VerificationRequest();
        vr.setStatus("PENDING");
        vr.setPortfolioItem(item);
        vr.setRequestedAt(Instant.now());
        item.setVerificationRequests(Set.of(vr));
        when(portfolioItemRepository.findByUserIdWithVerificationRequests(userId))
                .thenReturn(List.of(item));

        List<PortfolioItemResponse> result = portfolioService.getMyPortfolio(userId);

        assertThat(result.get(0).verificationStatus()).isEqualTo("PENDING");
    }

    @Test
    void getMyPortfolio_verifiedItem_returnsVerificationStatusApproved() {
        item.setVerified(true);
        item.setVerificationRequests(new HashSet<>());
        when(portfolioItemRepository.findByUserIdWithVerificationRequests(userId))
                .thenReturn(List.of(item));

        List<PortfolioItemResponse> result = portfolioService.getMyPortfolio(userId);

        assertThat(result.get(0).verificationStatus()).isEqualTo("APPROVED");
    }

    @Test
    void getPublicPortfolio_returnsOnlyVerifiedItems() {
        item.setVerified(true);
        when(portfolioItemRepository.findByUserIdAndVerifiedTrue(userId)).thenReturn(List.of(item));

        List<PortfolioItemResponse> result = portfolioService.getPublicPortfolio(userId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).verificationStatus()).isEqualTo("APPROVED");
    }

    // ── US3: Verification ─────────────────────────────────────────────────────

    @Test
    void requestVerification_itemNotOwned_throwsPortfolioItemNotFoundException() {
        when(portfolioItemRepository.findByIdAndUserId(itemId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> portfolioService.requestVerification(itemId, userId))
                .isInstanceOf(PortfolioItemNotFoundException.class);
    }

    @Test
    void requestVerification_pendingAlreadyExists_throwsDuplicateVerificationException() {
        when(portfolioItemRepository.findByIdAndUserId(itemId, userId)).thenReturn(Optional.of(item));
        when(verificationRequestRepository.existsByPortfolioItemIdAndStatus(itemId, "PENDING"))
                .thenReturn(true);

        assertThatThrownBy(() -> portfolioService.requestVerification(itemId, userId))
                .isInstanceOf(DuplicateVerificationException.class);
    }

    @Test
    void requestVerification_aiApproves_returnsApprovedRequest() {
        when(portfolioItemRepository.findByIdAndUserId(itemId, userId)).thenReturn(Optional.of(item));
        when(verificationRequestRepository.existsByPortfolioItemIdAndStatus(itemId, "PENDING"))
                .thenReturn(false);
        when(claudeVerificationService.verify(item))
                .thenReturn(new ClaudeVerificationResponse("APPROVED", "Strong project."));
        when(portfolioItemRepository.save(any())).thenReturn(item);
        VerificationRequest saved = new VerificationRequest();
        saved.setId(UUID.randomUUID());
        saved.setPortfolioItem(item);
        saved.setStatus("APPROVED");
        saved.setReviewSource("AI");
        saved.setRequestedAt(Instant.now());
        saved.setReviewedAt(Instant.now());
        when(verificationRequestRepository.save(any())).thenReturn(saved);

        VerificationRequestResponse resp = portfolioService.requestVerification(itemId, userId);

        assertThat(resp.status()).isEqualTo("APPROVED");
        assertThat(resp.reviewSource()).isEqualTo("AI");
    }

    @Test
    void requestVerification_aiFails_fallsToPending() {
        when(portfolioItemRepository.findByIdAndUserId(itemId, userId)).thenReturn(Optional.of(item));
        when(verificationRequestRepository.existsByPortfolioItemIdAndStatus(itemId, "PENDING"))
                .thenReturn(false);
        when(claudeVerificationService.verify(item))
                .thenThrow(new AiServiceException("timeout"));
        VerificationRequest saved = new VerificationRequest();
        saved.setId(UUID.randomUUID());
        saved.setPortfolioItem(item);
        saved.setStatus("PENDING");
        saved.setReviewSource("PENDING_FALLBACK");
        saved.setRequestedAt(Instant.now());
        when(verificationRequestRepository.save(any())).thenReturn(saved);

        VerificationRequestResponse resp = portfolioService.requestVerification(itemId, userId);

        assertThat(resp.status()).isEqualTo("PENDING");
        assertThat(resp.reviewSource()).isEqualTo("PENDING_FALLBACK");
    }

    @Test
    void reviewVerification_nonAdmin_throwsAccessDeniedException() {
        UUID requestId = UUID.randomUUID();
        VerificationDecisionRequest decision = new VerificationDecisionRequest("APPROVED", null);

        assertThatThrownBy(() -> portfolioService.reviewVerification(requestId, decision, userId, "STUDENT"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void reviewVerification_alreadyResolved_throwsVerificationAlreadyResolvedException() {
        UUID requestId = UUID.randomUUID();
        VerificationRequest vr = new VerificationRequest();
        vr.setId(requestId);
        vr.setStatus("APPROVED");
        vr.setPortfolioItem(item);
        when(verificationRequestRepository.findById(requestId)).thenReturn(Optional.of(vr));

        assertThatThrownBy(() -> portfolioService.reviewVerification(requestId,
                new VerificationDecisionRequest("APPROVED", null), userId, "ADMIN"))
                .isInstanceOf(VerificationAlreadyResolvedException.class);
    }

    @Test
    void reviewVerification_approved_setsItemVerifiedTrue() {
        UUID requestId = UUID.randomUUID();
        VerificationRequest vr = new VerificationRequest();
        vr.setId(requestId);
        vr.setStatus("PENDING");
        vr.setPortfolioItem(item);
        vr.setRequestedAt(Instant.now());
        when(verificationRequestRepository.findById(requestId)).thenReturn(Optional.of(vr));
        when(verificationRequestRepository.save(any())).thenReturn(vr);
        when(portfolioItemRepository.save(any())).thenReturn(item);

        portfolioService.reviewVerification(requestId,
                new VerificationDecisionRequest("APPROVED", "Looks good"), userId, "ADMIN");

        assertThat(item.isVerified()).isTrue();
    }

    @Test
    void reviewVerification_rejected_itemRemainsUnverified() {
        UUID requestId = UUID.randomUUID();
        VerificationRequest vr = new VerificationRequest();
        vr.setId(requestId);
        vr.setStatus("PENDING");
        vr.setPortfolioItem(item);
        vr.setRequestedAt(Instant.now());
        when(verificationRequestRepository.findById(requestId)).thenReturn(Optional.of(vr));
        when(verificationRequestRepository.save(any())).thenReturn(vr);

        portfolioService.reviewVerification(requestId,
                new VerificationDecisionRequest("REJECTED", "Not enough evidence"), userId, "ADMIN");

        assertThat(item.isVerified()).isFalse();
        verify(portfolioItemRepository, never()).save(any());
    }

    // ── US4: Share Link ───────────────────────────────────────────────────────

    @Test
    void generateShareLink_firstCall_persistsAndReturnsToken() {
        when(portfolioLinkRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(shareTokenGenerator.generateToken()).thenReturn("test-token-43chars-padded-to-length-here");
        PortfolioLink link = new PortfolioLink();
        link.setShareToken("test-token-43chars-padded-to-length-here");
        link.setUserId(userId);
        link.setActive(true);
        link.setCreatedAt(Instant.now());
        when(portfolioLinkRepository.save(any())).thenReturn(link);

        ShareLinkResponse resp = portfolioService.generateShareLink(userId, "http://localhost:8004");

        assertThat(resp.shareToken()).isEqualTo("test-token-43chars-padded-to-length-here");
        verify(portfolioLinkRepository).save(any());
    }

    @Test
    void generateShareLink_secondCall_returnsExistingToken() {
        PortfolioLink existing = new PortfolioLink();
        existing.setShareToken("existing-token");
        existing.setUserId(userId);
        existing.setActive(true);
        existing.setCreatedAt(Instant.now());
        when(portfolioLinkRepository.findByUserId(userId)).thenReturn(Optional.of(existing));

        ShareLinkResponse resp = portfolioService.generateShareLink(userId, "http://localhost:8004");

        assertThat(resp.shareToken()).isEqualTo("existing-token");
        verify(portfolioLinkRepository, never()).save(any());
    }

    @Test
    void getSharePortfolio_invalidToken_throwsException() {
        when(portfolioLinkRepository.findByShareTokenAndActiveTrue("bad-token"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> portfolioService.getSharePortfolio("bad-token"))
                .isInstanceOf(PortfolioItemNotFoundException.class)
                .hasMessageContaining("Share link not found");
    }

    @Test
    void getSharePortfolio_validToken_returnsVerifiedItems() {
        PortfolioLink link = new PortfolioLink();
        link.setUserId(userId);
        link.setShareToken("valid-token");
        link.setActive(true);
        link.setCreatedAt(Instant.now());
        item.setVerified(true);
        when(portfolioLinkRepository.findByShareTokenAndActiveTrue("valid-token"))
                .thenReturn(Optional.of(link));
        when(portfolioItemRepository.findByUserIdAndVerifiedTrue(userId)).thenReturn(List.of(item));

        List<PortfolioItemResponse> result = portfolioService.getSharePortfolio("valid-token");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).verificationStatus()).isEqualTo("APPROVED");
    }

    // ── Batch Create ───────────────────────────────────────────────────────────

    @Test
    void batchCreateItems_happyPath_savesAllItems() {
        PortfolioItemRequest item1 = new PortfolioItemRequest("PROJECT", "Project A", "desc A", null);
        PortfolioItemRequest item2 = new PortfolioItemRequest("CERTIFICATION", "Cert B", null, null);
        BatchCreateItemsRequest batchReq = new BatchCreateItemsRequest(List.of(item1, item2));

        when(portfolioItemRepository.save(any())).thenAnswer(inv -> {
            PortfolioItem saved = inv.getArgument(0);
            saved.setId(UUID.randomUUID());
            saved.setCreatedAt(Instant.now());
            saved.setUpdatedAt(Instant.now());
            return saved;
        });

        List<PortfolioItemResponse> result = portfolioService.batchCreateItems(batchReq, userId);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).title()).isEqualTo("Project A");
        assertThat(result.get(1).title()).isEqualTo("Cert B");
        verify(portfolioItemRepository, times(2)).save(any());
    }

    @Test
    void batchCreateItems_setsCorrectUserId() {
        PortfolioItemRequest itemReq = new PortfolioItemRequest("PROJECT", "Test", null, null);
        BatchCreateItemsRequest batchReq = new BatchCreateItemsRequest(List.of(itemReq));

        when(portfolioItemRepository.save(any())).thenAnswer(inv -> {
            PortfolioItem saved = inv.getArgument(0);
            saved.setId(UUID.randomUUID());
            saved.setCreatedAt(Instant.now());
            saved.setUpdatedAt(Instant.now());
            return saved;
        });

        List<PortfolioItemResponse> result = portfolioService.batchCreateItems(batchReq, userId);

        assertThat(result.get(0).userId()).isEqualTo(userId);
    }

    @Test
    void batchCreateItems_allItemsReturnVerificationStatusNone() {
        PortfolioItemRequest itemReq = new PortfolioItemRequest("PROJECT", "Test", null, null);
        BatchCreateItemsRequest batchReq = new BatchCreateItemsRequest(List.of(itemReq));

        when(portfolioItemRepository.save(any())).thenAnswer(inv -> {
            PortfolioItem saved = inv.getArgument(0);
            saved.setId(UUID.randomUUID());
            saved.setCreatedAt(Instant.now());
            saved.setUpdatedAt(Instant.now());
            return saved;
        });

        List<PortfolioItemResponse> result = portfolioService.batchCreateItems(batchReq, userId);

        assertThat(result.get(0).verificationStatus()).isEqualTo("NONE");
        assertThat(result.get(0).verified()).isFalse();
    }
}
