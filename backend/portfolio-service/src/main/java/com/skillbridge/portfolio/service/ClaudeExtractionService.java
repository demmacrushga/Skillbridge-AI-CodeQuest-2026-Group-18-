package com.skillbridge.portfolio.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillbridge.portfolio.exception.AiServiceException;
import com.skillbridge.portfolio.service.dto.ExtractedItemTemplate;
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
public class ClaudeExtractionService {

    private static final Logger log = LoggerFactory.getLogger(ClaudeExtractionService.class);

    private static final String PROMPT_NAME = "PORTFOLIO_EXTRACTION_V1";
    private static final String ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
    private static final String ANTHROPIC_VERSION = "2023-06-01";
    private static final int MAX_ITEMS = 50;

    private static final String SYSTEM_PROMPT = """
            You are a portfolio builder for a student career platform.
            Given CV/resume text or website content, extract all portfolio-worthy items
            (projects, certifications, awards, publications, and other notable achievements).

            Return ONLY a valid JSON array of objects with exactly these fields:
              itemType (string — one of: PROJECT, CERTIFICATION, AWARD, PUBLICATION, OTHER),
              title (string — concise name of the item),
              description (string — 1-2 sentence summary, or null if not enough info),
              externalUrl (string — URL if available, or null),
              confidence (number — 0.0 to 1.0, how confident you are this is a real portfolio item)

            If no portfolio-worthy items are found, return an empty array: []

            No preamble. No markdown. No code fences. Valid JSON array only.
            """;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String model;
    private final int maxTokens;

    public ClaudeExtractionService(
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            @Value("${anthropic.api-key}") String apiKey,
            @Value("${anthropic.model}") String model,
            @Value("${anthropic.extraction-max-tokens}") int maxTokens) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.model = model;
        this.maxTokens = maxTokens;
    }

    public List<ExtractedItemTemplate> extract(String content) {
        String userMessage = "Content to extract portfolio items from:\n%s".formatted(content);

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
        log.info("prompt={} contentLength={}", PROMPT_NAME, content.length());

        String rawText;
        try {
            String responseBody = restTemplate.postForObject(
                    ANTHROPIC_API_URL,
                    new HttpEntity<>(requestBody, headers),
                    String.class);
            JsonNode root = objectMapper.readTree(responseBody);
            rawText = root.path("content").get(0).path("text").asText();
        } catch (RestClientException e) {
            log.error("prompt={} Claude API call failed: {}", PROMPT_NAME, e.getMessage());
            throw new AiServiceException("AI service unavailable. Please try again or add items manually.", e);
        } catch (Exception e) {
            log.error("prompt={} Failed to read Claude API response: {}", PROMPT_NAME, e.getMessage());
            throw new AiServiceException("AI service unavailable. Please try again or add items manually.", e);
        }

        long latencyMs = System.currentTimeMillis() - start;
        log.info("prompt={} latencyMs={}", PROMPT_NAME, latencyMs);
        log.debug("prompt={} rawResponse={}", PROMPT_NAME, rawText);

        try {
            String json = rawText.strip();
            if (json.startsWith("```")) {
                json = json.replaceFirst("^```[a-zA-Z]*\\r?\\n?", "")
                           .replaceFirst("\\r?\\n?```$", "")
                           .strip();
            }
            if (!json.startsWith("[")) {
                int arrayStart = json.indexOf('[');
                if (arrayStart < 0) {
                    log.error("prompt={} Claude response contains no JSON array: {}", PROMPT_NAME, json);
                    throw new AiServiceException("AI service returned an invalid response.");
                }
                json = json.substring(arrayStart);
            }
            List<ExtractedItemTemplate> result = objectMapper.readValue(
                    json, new TypeReference<List<ExtractedItemTemplate>>() {});

            if (result == null) {
                result = List.of();
            }

            if (result.size() > MAX_ITEMS) {
                log.info("prompt={} itemCount={} truncated to {}", PROMPT_NAME, result.size(), MAX_ITEMS);
                result = result.subList(0, MAX_ITEMS);
            }

            log.info("prompt={} itemCount={}", PROMPT_NAME, result.size());

            if (result.isEmpty()) {
                log.info("prompt={} Claude returned no portfolio-worthy items", PROMPT_NAME);
            } else {
                for (int i = 0; i < result.size(); i++) {
                    ExtractedItemTemplate item = result.get(i);
                    log.info("prompt={} item[{}] type={} title=\"{}\" confidence={} url={}",
                            PROMPT_NAME, i, item.itemType(), item.title(),
                            item.confidence(),
                            item.externalUrl() != null ? item.externalUrl() : "none");
                }
            }

            return result;
        } catch (JsonProcessingException e) {
            log.error("prompt={} Failed to parse Claude JSON: {}", PROMPT_NAME, rawText, e);
            throw new AiServiceException("AI service returned an invalid response.");
        }
    }
}
