package com.skillbridge.portfolio.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillbridge.portfolio.dto.request.BatchCreateItemsRequest;
import com.skillbridge.portfolio.dto.request.ExtractUrlRequest;
import com.skillbridge.portfolio.dto.request.PortfolioItemRequest;
import com.skillbridge.portfolio.dto.request.PortfolioItemUpdateRequest;
import com.skillbridge.portfolio.dto.request.VerificationDecisionRequest;
import com.skillbridge.portfolio.dto.response.ExtractedItemResponse;
import com.skillbridge.portfolio.dto.response.PortfolioItemResponse;
import com.skillbridge.portfolio.dto.response.ShareLinkResponse;
import com.skillbridge.portfolio.dto.response.VerificationRequestResponse;
import com.skillbridge.portfolio.exception.AiServiceException;
import com.skillbridge.portfolio.exception.DuplicateVerificationException;
import com.skillbridge.portfolio.exception.FileParsingException;
import com.skillbridge.portfolio.exception.FileSizeExceededException;
import com.skillbridge.portfolio.exception.PortfolioItemNotFoundException;
import com.skillbridge.portfolio.exception.UnsupportedFileTypeException;
import com.skillbridge.portfolio.exception.WebsiteFetchException;
import com.skillbridge.portfolio.security.JwtService;
import com.skillbridge.portfolio.security.JwtUserDetails;
import com.skillbridge.portfolio.service.PortfolioService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PortfolioController.class)
@AutoConfigureMockMvc(addFilters = false)
class PortfolioControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean private PortfolioService portfolioService;
    @MockBean private JwtService jwtService;

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID ITEM_ID = UUID.randomUUID();

    private static final PortfolioItemResponse ITEM_RESPONSE = new PortfolioItemResponse(
            ITEM_ID, USER_ID, "PROJECT", "Test Project",
            "A test project", "http://github.com/test", false, "NONE", 0, Instant.now());

    @BeforeEach
    void setUpAuth() {
        JwtUserDetails principal = new JwtUserDetails(USER_ID, "user@example.com", "STUDENT");
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    // ── US1: Item CRUD ────────────────────────────────────────────────────────

    @Test
    void createItem_validRequest_returns201() throws Exception {
        when(portfolioService.createItem(any(), eq(USER_ID))).thenReturn(ITEM_RESPONSE);

        mockMvc.perform(post("/portfolio/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new PortfolioItemRequest("PROJECT", "Test Project", null, null))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.itemType").value("PROJECT"))
                .andExpect(jsonPath("$.verificationStatus").value("NONE"));
    }

    @Test
    void createItem_missingTitle_returns400() throws Exception {
        mockMvc.perform(post("/portfolio/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new PortfolioItemRequest("PROJECT", null, null, null))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void createItem_missingItemType_returns400() throws Exception {
        mockMvc.perform(post("/portfolio/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new PortfolioItemRequest(null, "Test", null, null))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateItem_validRequest_returns200() throws Exception {
        when(portfolioService.updateItem(eq(ITEM_ID), any(), eq(USER_ID))).thenReturn(ITEM_RESPONSE);

        mockMvc.perform(put("/portfolio/items/" + ITEM_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new PortfolioItemUpdateRequest("Updated Title", null, null, null))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Test Project"));
    }

    @Test
    void updateItem_notFound_returns404() throws Exception {
        when(portfolioService.updateItem(eq(ITEM_ID), any(), eq(USER_ID)))
                .thenThrow(new PortfolioItemNotFoundException("Not found"));

        mockMvc.perform(put("/portfolio/items/" + ITEM_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new PortfolioItemUpdateRequest("Title", null, null, null))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void deleteItem_happyPath_returns204() throws Exception {
        doNothing().when(portfolioService).deleteItem(eq(ITEM_ID), eq(USER_ID));

        mockMvc.perform(delete("/portfolio/items/" + ITEM_ID))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteItem_notFound_returns404() throws Exception {
        doThrow(new PortfolioItemNotFoundException("Not found"))
                .when(portfolioService).deleteItem(eq(ITEM_ID), eq(USER_ID));

        mockMvc.perform(delete("/portfolio/items/" + ITEM_ID))
                .andExpect(status().isNotFound());
    }

    // ── US2: Portfolio View ───────────────────────────────────────────────────

    @Test
    void getMyPortfolio_returns200WithList() throws Exception {
        when(portfolioService.getMyPortfolio(USER_ID)).thenReturn(List.of(ITEM_RESPONSE));

        mockMvc.perform(get("/portfolio/mine"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Test Project"))
                .andExpect(jsonPath("$[0].verificationStatus").value("NONE"));
    }

    @Test
    void getMyPortfolio_emptyPortfolio_returns200EmptyList() throws Exception {
        when(portfolioService.getMyPortfolio(USER_ID)).thenReturn(List.of());

        mockMvc.perform(get("/portfolio/mine"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void getPublicPortfolio_returns200() throws Exception {
        UUID targetUserId = UUID.randomUUID();
        when(portfolioService.getPublicPortfolio(targetUserId)).thenReturn(List.of(ITEM_RESPONSE));

        mockMvc.perform(get("/portfolio/" + targetUserId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].verified").value(false));
    }

    // ── US3: Verification ─────────────────────────────────────────────────────

    @Test
    void requestVerification_aiVerification_returns200() throws Exception {
        VerificationRequestResponse vrResponse = new VerificationRequestResponse(
                UUID.randomUUID(), ITEM_ID, "APPROVED", "Solid project.", "AI", Instant.now(), Instant.now());
        when(portfolioService.requestVerification(eq(ITEM_ID), eq(USER_ID))).thenReturn(vrResponse);

        mockMvc.perform(post("/portfolio/items/" + ITEM_ID + "/verify"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.reviewSource").value("AI"));
    }

    @Test
    void requestVerification_duplicatePending_returns409() throws Exception {
        when(portfolioService.requestVerification(eq(ITEM_ID), eq(USER_ID)))
                .thenThrow(new DuplicateVerificationException("Already pending"));

        mockMvc.perform(post("/portfolio/items/" + ITEM_ID + "/verify"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void reviewVerification_adminApproves_returns200() throws Exception {
        JwtUserDetails adminPrincipal = new JwtUserDetails(USER_ID, "admin@example.com", "ADMIN");
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(adminPrincipal, null, adminPrincipal.getAuthorities()));

        UUID requestId = UUID.randomUUID();
        VerificationRequestResponse vrResponse = new VerificationRequestResponse(
                requestId, ITEM_ID, "APPROVED", "Good work", "HUMAN", Instant.now(), Instant.now());
        when(portfolioService.reviewVerification(eq(requestId), any(), eq(USER_ID), eq("ADMIN")))
                .thenReturn(vrResponse);

        mockMvc.perform(patch("/portfolio/verification/" + requestId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new VerificationDecisionRequest("APPROVED", "Good work"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.reviewSource").value("HUMAN"));
    }

    @Test
    void reviewVerification_nonAdmin_returns403() throws Exception {
        UUID requestId = UUID.randomUUID();
        when(portfolioService.reviewVerification(eq(requestId), any(), eq(USER_ID), eq("STUDENT")))
                .thenThrow(new AccessDeniedException("Access denied"));

        mockMvc.perform(patch("/portfolio/verification/" + requestId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new VerificationDecisionRequest("APPROVED", null))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    void reviewVerification_missingDecision_returns400() throws Exception {
        UUID requestId = UUID.randomUUID();

        mockMvc.perform(patch("/portfolio/verification/" + requestId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new VerificationDecisionRequest(null, null))))
                .andExpect(status().isBadRequest());
    }

    // ── US4: Share Link ───────────────────────────────────────────────────────

    @Test
    void generateShareLink_returns200WithToken() throws Exception {
        ShareLinkResponse shareResponse = new ShareLinkResponse(
                "abc123token", "http://localhost/portfolio/share/abc123token", true, Instant.now());
        when(portfolioService.generateShareLink(eq(USER_ID), any())).thenReturn(shareResponse);

        mockMvc.perform(post("/portfolio/share"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shareToken").value("abc123token"))
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void getSharePortfolio_validToken_returns200() throws Exception {
        when(portfolioService.getSharePortfolio("valid-token")).thenReturn(List.of(ITEM_RESPONSE));

        mockMvc.perform(get("/portfolio/share/valid-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].verified").value(false));
    }

    @Test
    void getSharePortfolio_invalidToken_returns404() throws Exception {
        when(portfolioService.getSharePortfolio("bad-token"))
                .thenThrow(new PortfolioItemNotFoundException("Share link not found"));

        mockMvc.perform(get("/portfolio/share/bad-token"))
                .andExpect(status().isNotFound());
    }

    // ── Health ────────────────────────────────────────────────────────────────

    @Test
    void health_returns200() throws Exception {
        mockMvc.perform(get("/portfolio/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    // ── Batch Create ───────────────────────────────────────────────────────────

    @Test
    void batchCreateItems_validRequest_returns201() throws Exception {
        when(portfolioService.batchCreateItems(any(), eq(USER_ID)))
                .thenReturn(List.of(ITEM_RESPONSE));

        BatchCreateItemsRequest batchReq = new BatchCreateItemsRequest(List.of(
                new PortfolioItemRequest("PROJECT", "Test Project", null, null)));

        mockMvc.perform(post("/portfolio/items/batch")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(batchReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$[0].title").value("Test Project"));
    }

    @Test
    void batchCreateItems_emptyItems_returns400() throws Exception {
        BatchCreateItemsRequest batchReq = new BatchCreateItemsRequest(List.of());

        mockMvc.perform(post("/portfolio/items/batch")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(batchReq)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void batchCreateItems_nullItems_returns400() throws Exception {
        mockMvc.perform(post("/portfolio/items/batch")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":null}"))
                .andExpect(status().isBadRequest());
    }

    // ── CV Extraction ──────────────────────────────────────────────────────────

    private static final ExtractedItemResponse EXTRACTED_ITEM = new ExtractedItemResponse(
            "PROJECT", "E-commerce API", "Spring Boot API", "https://github.com/user/repo", 0.9);

    @Test
    void extractFromCV_validPdf_returns200WithItems() throws Exception {
        when(portfolioService.extractFromCV(any(), eq(USER_ID)))
                .thenReturn(List.of(EXTRACTED_ITEM));

        MockMultipartFile file = new MockMultipartFile(
                "file", "cv.pdf", "application/pdf", "fake pdf content".getBytes());

        mockMvc.perform(multipart("/portfolio/extract").file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].itemType").value("PROJECT"))
                .andExpect(jsonPath("$[0].confidence").value(0.9));
    }

    @Test
    void extractFromCV_emptyResult_returns200WithEmptyArray() throws Exception {
        when(portfolioService.extractFromCV(any(), eq(USER_ID)))
                .thenReturn(List.of());

        MockMultipartFile file = new MockMultipartFile(
                "file", "cv.pdf", "application/pdf", "fake pdf".getBytes());

        mockMvc.perform(multipart("/portfolio/extract").file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void extractFromCV_fileTooLarge_returns400() throws Exception {
        when(portfolioService.extractFromCV(any(), eq(USER_ID)))
                .thenThrow(new FileSizeExceededException("File exceeds maximum allowed size of 5MB"));

        MockMultipartFile file = new MockMultipartFile(
                "file", "big.pdf", "application/pdf", new byte[10]);

        mockMvc.perform(multipart("/portfolio/extract").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void extractFromCV_unsupportedFileType_returns400() throws Exception {
        when(portfolioService.extractFromCV(any(), eq(USER_ID)))
                .thenThrow(new UnsupportedFileTypeException("Only PDF and DOCX"));

        MockMultipartFile file = new MockMultipartFile(
                "file", "image.png", "image/png", "data".getBytes());

        mockMvc.perform(multipart("/portfolio/extract").file(file))
                .andExpect(status().isBadRequest());
    }

    @Test
    void extractFromCV_claudeDown_returns503() throws Exception {
        when(portfolioService.extractFromCV(any(), eq(USER_ID)))
                .thenThrow(new AiServiceException("AI service unavailable"));

        MockMultipartFile file = new MockMultipartFile(
                "file", "cv.pdf", "application/pdf", "pdf".getBytes());

        mockMvc.perform(multipart("/portfolio/extract").file(file))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value(503));
    }

    @Test
    void extractFromCV_passwordProtectedPdf_returns400() throws Exception {
        when(portfolioService.extractFromCV(any(), eq(USER_ID)))
                .thenThrow(new FileParsingException("Could not parse PDF — the file may be password-protected or corrupted."));

        MockMultipartFile file = new MockMultipartFile(
                "file", "encrypted.pdf", "application/pdf", "encrypted".getBytes());

        mockMvc.perform(multipart("/portfolio/extract").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("password-protected")));
    }

    // ── URL Extraction ─────────────────────────────────────────────────────────

    @Test
    void extractFromUrl_validUrl_returns200WithItems() throws Exception {
        when(portfolioService.extractFromUrl(any(), eq(USER_ID)))
                .thenReturn(List.of(EXTRACTED_ITEM));

        mockMvc.perform(post("/portfolio/extract-url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ExtractUrlRequest("https://github.com/user"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].itemType").value("PROJECT"));
    }

    @Test
    void extractFromUrl_invalidUrl_returns400() throws Exception {
        mockMvc.perform(post("/portfolio/extract-url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ExtractUrlRequest("not-a-url"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void extractFromUrl_unreachableUrl_returns502() throws Exception {
        when(portfolioService.extractFromUrl(any(), eq(USER_ID)))
                .thenThrow(new WebsiteFetchException("Could not fetch content from the provided URL"));

        mockMvc.perform(post("/portfolio/extract-url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ExtractUrlRequest("https://github.com/user"))))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.status").value(502));
    }

    @Test
    void extractFromUrl_claudeDown_returns503() throws Exception {
        when(portfolioService.extractFromUrl(any(), eq(USER_ID)))
                .thenThrow(new AiServiceException("AI service unavailable"));

        mockMvc.perform(post("/portfolio/extract-url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ExtractUrlRequest("https://github.com/user"))))
                .andExpect(status().isServiceUnavailable());
    }
}
