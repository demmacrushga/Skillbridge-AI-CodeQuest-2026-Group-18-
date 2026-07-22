package com.skillbridge.career.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillbridge.career.exception.AiServiceException;
import com.skillbridge.career.service.dto.MilestoneTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
public class ClaudeService {

    private static final Logger log = LoggerFactory.getLogger(ClaudeService.class);

    private static final String ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
    private static final String ANTHROPIC_VERSION = "2023-06-01";

    private static final String STUDENT_SYSTEM_PROMPT = """
            You are a career development advisor for KNUST university students in Ghana.
            Given a student's career path, academic level, and current skills, return ONLY
            a valid JSON array of milestone objects with exactly these fields:
            semester (int 1-8), title (string), description (string),
            milestoneType (one of: SKILL, PROJECT, CERT, EXPERIENCE), displayOrder (int).
            Generate exactly 3 milestones per semester. Only include semesters the student
            has not yet completed: Level 100 starts at semester 1, Level 200 at semester 3,
            Level 300 at semester 5, Level 400 at semester 7.
            No preamble. No markdown. Valid JSON only.
            """;

    private static final String ALUMNI_SYSTEM_PROMPT = """
            You are a career development advisor for KNUST alumni in Ghana.
            Given an alumnus's career path, career stage, and current skills, return ONLY
            a valid JSON array of milestone objects with exactly these fields:
            semester (int 1-4), title (string), description (string),
            milestoneType (one of: SKILL, PROJECT, CERT, EXPERIENCE), displayOrder (int).
            Treat semester as a 3-month career phase. Generate exactly 3 milestones per phase.
            Phase 1 covers months 0-3, Phase 2 months 3-6, Phase 3 months 6-9, Phase 4 months 9-12.
            For "Career Changer" or "Recent Graduate" start at phase 1.
            For "Early Career" start at phase 1 but make milestones more advanced.
            For "Mid Career" start at phase 2.
            Milestones should be practical for working professionals: skills to sharpen, projects to ship,
            certifications to earn, and experience to gain (e.g., leadership, freelancing, interviews, networking).
            No preamble. No markdown. Valid JSON only.
            """;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String model;
    private final int maxTokens;

    public ClaudeService(
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            @Value("${anthropic.api-key}") String apiKey,
            @Value("${anthropic.model}") String model,
            @Value("${anthropic.max-tokens}") int maxTokens) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.model = model;
        this.maxTokens = maxTokens;
    }

    @Cacheable(value = "roadmap-templates", key = "#careerPath + ':' + #academicLevel + ':' + #role")
    public List<MilestoneTemplate> generateRoadmap(String careerPath, String academicLevel, List<String> currentSkills, String role) {
        String systemPrompt = "ALUMNI".equals(role) ? ALUMNI_SYSTEM_PROMPT : STUDENT_SYSTEM_PROMPT;
        String levelLabel = "ALUMNI".equals(role) ? "Career stage" : "Academic level";
        String userMessage = String.format(
                "Career path: %s%n%s: %s%nCurrent skills: %s",
                careerPath, levelLabel, academicLevel, String.join(", ", currentSkills));

        Map<String, Object> requestBody = Map.of(
                "model", model,
                "max_tokens", maxTokens,
                "system", systemPrompt,
                "messages", List.of(Map.of("role", "user", "content", userMessage))
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", ANTHROPIC_VERSION);

        String rawJson;
        try {
            String responseBody = restTemplate.postForObject(
                    ANTHROPIC_API_URL,
                    new HttpEntity<>(requestBody, headers),
                    String.class);

            JsonNode root = objectMapper.readTree(responseBody);
            rawJson = root.path("content").get(0).path("text").asText();
        } catch (RestClientException e) {
            log.error("Claude API call failed", e);
            throw new AiServiceException("AI service unavailable", e);
        } catch (Exception e) {
            log.error("Failed to read Claude API response", e);
            throw new AiServiceException("AI service unavailable", e);
        }

        try {
            String json = rawJson.strip();
            if (json.startsWith("```")) {
                json = json.replaceFirst("^```[a-zA-Z]*\\r?\\n?", "").replaceFirst("\\r?\\n?```$", "").strip();
            }
            return objectMapper.readValue(json, new TypeReference<List<MilestoneTemplate>>() {});
        } catch (JsonProcessingException e) {
            log.error("Failed to parse Claude JSON response: {}", rawJson, e);
            throw new AiServiceException("AI service returned invalid response");
        }
    }
}
