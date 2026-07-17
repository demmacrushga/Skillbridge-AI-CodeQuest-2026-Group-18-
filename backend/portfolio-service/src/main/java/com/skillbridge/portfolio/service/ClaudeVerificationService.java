package com.skillbridge.portfolio.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillbridge.portfolio.entity.PortfolioItem;
import com.skillbridge.portfolio.exception.AiServiceException;
import com.skillbridge.portfolio.service.dto.ClaudeVerificationResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
public class ClaudeVerificationService {

    private static final Logger log = LoggerFactory.getLogger(ClaudeVerificationService.class);

    private static final String PROMPT_NAME = "PORTFOLIO_VERIFICATION_V1";
    private static final String ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
    private static final String ANTHROPIC_VERSION = "2023-06-01";
    private static final int MAX_DESCRIPTION_LENGTH = 2000;

    private static final String SYSTEM_PROMPT = """
            You are a portfolio verifier for a student career platform.
            Given a portfolio item's details, assess whether it is a real, specific, and demonstrable achievement.
            Return ONLY a valid JSON object with exactly these two fields:
            - "decision": either "APPROVED" or "REJECTED"
            - "reason": a concise one or two sentence explanation of your decision
            No preamble. No markdown. No code fences. Valid JSON only.
            Example: {"decision":"APPROVED","reason":"Clear project with a public repository and detailed description."}
            """;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String model;
    private final int maxTokens;

    public ClaudeVerificationService(
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            @Value("${anthropic.api-key}") String apiKey,
            @Value("${anthropic.model}") String model,
            @Value("${anthropic.verification-max-tokens}") int maxTokens) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.model = model;
        this.maxTokens = maxTokens;
    }

    public ClaudeVerificationResponse verify(PortfolioItem item) {
        String description = item.getDescription() != null ? item.getDescription() : "";
        if (description.length() > MAX_DESCRIPTION_LENGTH) {
            log.warn("Portfolio item {} description truncated from {} to {} chars for Claude review",
                    item.getId(), description.length(), MAX_DESCRIPTION_LENGTH);
            description = description.substring(0, MAX_DESCRIPTION_LENGTH);
        }

        String userMessage = "Item type: %s\nTitle: %s\nDescription: %s\nExternal URL: %s".formatted(
                item.getItemType(),
                item.getTitle(),
                description.isBlank() ? "none" : description,
                item.getExternalUrl() != null ? item.getExternalUrl() : "none"
        );

        Map<String, Object> requestBody = Map.of(
                "model", model,
                "max_tokens", maxTokens,
                "system", SYSTEM_PROMPT,
                "messages", List.of(Map.of("role", "user", "content", userMessage))
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", ANTHROPIC_VERSION);

        long start = System.currentTimeMillis();
        String rawText;
        try {
            String responseBody = restTemplate.postForObject(
                    ANTHROPIC_API_URL,
                    new HttpEntity<>(requestBody, headers),
                    String.class);
            JsonNode root = objectMapper.readTree(responseBody);
            rawText = root.path("content").get(0).path("text").asText();
        } catch (RestClientException e) {
            log.error("Claude API call failed for item {}", item.getId(), e);
            throw new AiServiceException("AI service unavailable", e);
        } catch (Exception e) {
            log.error("Failed to read Claude API response for item {}", item.getId(), e);
            throw new AiServiceException("AI service unavailable", e);
        }
        long latencyMs = System.currentTimeMillis() - start;
        log.info("prompt={}, latencyMs={}", PROMPT_NAME, latencyMs);

        try {
            String json = rawText.strip();
            if (json.startsWith("```")) {
                json = json.replaceFirst("^```[a-zA-Z]*\\r?\\n?", "").replaceFirst("\\r?\\n?```$", "").strip();
            }
            return objectMapper.readValue(json, ClaudeVerificationResponse.class);
        } catch (JsonProcessingException e) {
            log.error("Failed to parse Claude JSON for item {}: {}", item.getId(), rawText, e);
            throw new AiServiceException("AI service returned invalid response");
        }
    }
}
