package com.skillbridge.mockinterview.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillbridge.mockinterview.exception.AiServiceException;
import com.skillbridge.mockinterview.service.dto.AnswerEvaluationTemplate;
import com.skillbridge.mockinterview.service.dto.QuestionTemplate;
import com.skillbridge.mockinterview.service.dto.SessionSummaryTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class ClaudeInterviewService {

    private static final Logger log = LoggerFactory.getLogger(ClaudeInterviewService.class);

    private static final String ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
    private static final String ANTHROPIC_VERSION = "2023-06-01";

    static final String MOCK_INTERVIEW_QUESTIONS_V1 = "MOCK_INTERVIEW_QUESTIONS_V1";
    static final String MOCK_INTERVIEW_ANSWER_V1 = "MOCK_INTERVIEW_ANSWER_V1";
    static final String MOCK_INTERVIEW_SUMMARY_V1 = "MOCK_INTERVIEW_SUMMARY_V1";

    private static final String QUESTIONS_SYSTEM_PROMPT = """
            You are a technical interviewer for university students preparing for job interviews.
            Given a target role and a difficulty level (ENTRY, MID, or SENIOR), generate interview
            questions appropriate for that role and difficulty.

            Return ONLY a valid JSON array of question objects with exactly these fields:
              questionText (string),
              category (string, one of TECHNICAL | BEHAVIORAL | SITUATIONAL),
              orderIndex (int, starting at 1, ordered by suggested interview flow).
            Generate between 3 and 7 questions. Mix categories appropriately for the role.

            No preamble. No markdown. No code fences. Valid JSON array only.
            """;

    private static final String ANSWER_SYSTEM_PROMPT = """
            You are a technical interviewer evaluating a student's answer to an interview question.
            Given the target role, the difficulty, the question, its category, and the student's
            answer, assign a score from 0 to 10 and provide concise feedback.

            Return ONLY a valid JSON object with exactly these fields:
              score (int, 0-10),
              feedback (string, 2-4 sentences: what was good, what was missing, how to improve).
            No preamble. No markdown. No code fences. Valid JSON object only.
            """;

    private static final String SUMMARY_SYSTEM_PROMPT = """
            You are a technical interviewer producing an overall summary of a completed mock
            interview. Given the target role, the difficulty, and the full list of questions with
            the student's answers and per-question scores, produce an overall score from 0 to 100
            and a summary.

            Return ONLY a valid JSON object with exactly these fields:
              overallScore (int, 0-100),
              overallFeedback (string, 3-6 sentences summarizing strengths, weaknesses, and next steps).
            No preamble. No markdown. No code fences. Valid JSON object only.
            """;

    private static final Set<String> VALID_CATEGORIES =
            Set.of("TECHNICAL", "BEHAVIORAL", "SITUATIONAL", "OTHER");

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String model;
    private final int maxTokens;

    public ClaudeInterviewService(
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

    public List<QuestionTemplate> generateQuestions(String targetRole, String difficulty) {
        String userMessage = "Target role: %s%nDifficulty: %s".formatted(targetRole, difficulty);
        String rawJson = callClaude(QUESTIONS_SYSTEM_PROMPT, userMessage, MOCK_INTERVIEW_QUESTIONS_V1);
        String json = extractJson(rawJson, '[', MOCK_INTERVIEW_QUESTIONS_V1);

        try {
            List<QuestionTemplate> parsed = objectMapper.readValue(
                    json, new TypeReference<List<QuestionTemplate>>() {});
            if (parsed == null || parsed.isEmpty()) {
                throw new AiServiceException("AI returned no interview questions");
            }
            List<QuestionTemplate> normalized = new ArrayList<>(parsed.size());
            for (int i = 0; i < parsed.size(); i++) {
                QuestionTemplate q = parsed.get(i);
                normalized.add(new QuestionTemplate(
                        q.questionText(), normalizeCategory(q.category()), i + 1));
            }
            return normalized;
        } catch (JsonProcessingException e) {
            log.error("Failed to parse Claude questions JSON: {}", rawJson, e);
            throw new AiServiceException("AI service returned invalid response");
        }
    }

    public AnswerEvaluationTemplate evaluateAnswer(String targetRole, String difficulty,
                                                   String questionText, String category, String answer) {
        String userMessage = """
                Target role: %s
                Difficulty: %s
                Question: %s
                Category: %s
                Student answer: %s
                """.formatted(targetRole, difficulty, questionText, category, answer);
        String rawJson = callClaude(ANSWER_SYSTEM_PROMPT, userMessage, MOCK_INTERVIEW_ANSWER_V1);
        String json = extractJson(rawJson, '{', MOCK_INTERVIEW_ANSWER_V1);

        try {
            return objectMapper.readValue(json, AnswerEvaluationTemplate.class);
        } catch (JsonProcessingException e) {
            log.error("Failed to parse Claude answer evaluation JSON: {}", rawJson, e);
            throw new AiServiceException("AI service returned invalid response");
        }
    }

    public SessionSummaryTemplate generateSummary(String targetRole, String difficulty, String qaDigest) {
        String userMessage = """
                Target role: %s
                Difficulty: %s

                Questions and answers:
                %s
                """.formatted(targetRole, difficulty, qaDigest);
        String rawJson = callClaude(SUMMARY_SYSTEM_PROMPT, userMessage, MOCK_INTERVIEW_SUMMARY_V1);
        String json = extractJson(rawJson, '{', MOCK_INTERVIEW_SUMMARY_V1);

        try {
            return objectMapper.readValue(json, SessionSummaryTemplate.class);
        } catch (JsonProcessingException e) {
            log.error("Failed to parse Claude summary JSON: {}", rawJson, e);
            throw new AiServiceException("AI service returned invalid response");
        }
    }

    private String callClaude(String systemPrompt, String userMessage, String promptName) {
        Map<String, Object> requestBody = Map.of(
                "model", model,
                "max_tokens", maxTokens,
                "system", systemPrompt,
                "messages", List.of(Map.of("role", "user", "content", userMessage)));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", ANTHROPIC_VERSION);

        long start = System.currentTimeMillis();
        log.info("prompt={} messageLength={}", promptName, userMessage.length());

        try {
            String responseBody = restTemplate.postForObject(
                    ANTHROPIC_API_URL,
                    new HttpEntity<>(requestBody, headers),
                    String.class);
            JsonNode root = objectMapper.readTree(responseBody);
            return root.path("content").get(0).path("text").asText();
        } catch (RestClientException e) {
            log.error("Claude API call failed for prompt={}", promptName, e);
            throw new AiServiceException("AI service unavailable", e);
        } catch (Exception e) {
            log.error("Failed to read Claude API response for prompt={}", promptName, e);
            throw new AiServiceException("AI service unavailable", e);
        } finally {
            log.info("prompt={} latencyMs={}", promptName, System.currentTimeMillis() - start);
        }
    }

    private String extractJson(String rawJson, char openChar, String promptName) {
        String json = rawJson.strip();
        if (json.startsWith("```")) {
            json = json.replaceFirst("^```[a-zA-Z]*\\r?\\n?", "")
                       .replaceFirst("\\r?\\n?```$", "")
                       .strip();
        }
        if (json.indexOf(openChar) != 0) {
            int start = json.indexOf(openChar);
            if (start < 0) {
                log.error("prompt={} Claude response contains no JSON {}: {}",
                        promptName, openChar, json);
                throw new AiServiceException("AI service returned invalid response");
            }
            json = json.substring(start);
        }
        return json;
    }

    private String normalizeCategory(String category) {
        if (category == null) {
            return "OTHER";
        }
        String upper = category.strip().toUpperCase();
        return VALID_CATEGORIES.contains(upper) ? upper : "OTHER";
    }
}
