package com.skillbridge.skillgap.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillbridge.skillgap.exception.AiServiceException;
import com.skillbridge.skillgap.service.dto.SkillGapTemplate;
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
public class ClaudeService {

    private static final Logger log = LoggerFactory.getLogger(ClaudeService.class);

    private static final String ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
    private static final String ANTHROPIC_VERSION  = "2023-06-01";

    private static final String PROMPT_NAME = "SKILL_GAP_ANALYSIS_V5";

    private static final String PREFERRED_PLATFORMS = """
            COURSE PLATFORMS:
              https://www.coursera.org          – university courses & certificates
              https://www.udemy.com             – practical courses
              https://www.w3schools.com         – HTML, CSS, JavaScript, SQL
              https://www.edx.org               – university-level courses
              https://www.codecademy.com        – interactive coding
              https://www.freecodecamp.org      – free coding curriculum
              https://www.theodinproject.com    – full-stack web development
              https://www.khanacademy.org       – CS fundamentals
              https://ocw.mit.edu               – MIT courses
              https://cs50.harvard.edu          – computer science
              https://www.udacity.com           – AI, data, cloud
              https://www.linkedin.com/learning – professional development
              https://www.pluralsight.com       – software engineering
              https://www.datacamp.com          – data science
              https://scrimba.com               – interactive frontend
              https://frontendmasters.com       – advanced frontend
              https://www.educative.io          – text-based coding courses
              https://egghead.io                – JavaScript & React
              https://training.linuxfoundation.org – Linux & Kubernetes
              https://skillbuilder.aws          – AWS
              https://learn.microsoft.com/training – Azure & .NET
              https://www.cloudskillsboost.google  – Google Cloud
              https://www.netacad.com           – networking
              https://www.jetbrains.com/academy – Java, Kotlin, Python
              https://leetcode.com              – algorithms & interview prep
              https://www.hackerrank.com        – coding challenges

            YOUTUBE CHANNELS:
              https://www.youtube.com/@freecodecamp        – complete programming courses
              https://www.youtube.com/@TraversyMedia       – web development
              https://www.youtube.com/@NetNinja            – JavaScript & frameworks
              https://www.youtube.com/@programmingwithmosh – beginner-friendly programming
              https://www.youtube.com/@academind           – React, Next.js, Node.js
              https://www.youtube.com/@Fireship            – fast tech overviews
              https://www.youtube.com/@Codevolution        – React & Node
              https://www.youtube.com/@KevinPowell         – CSS
              https://www.youtube.com/@WebDevSimplified    – JavaScript
              https://www.youtube.com/@CSDojo              – algorithms & interviews
              https://www.youtube.com/@TechWithTim         – Python
              https://www.youtube.com/@javascriptmastery   – full-stack JavaScript
              https://www.youtube.com/@hnasr               – backend engineering
              https://www.youtube.com/@ByteByteGo          – system design
              https://www.youtube.com/@Computerphile       – computer science
              https://www.youtube.com/@amigoscode          – Java & Spring Boot
              https://www.youtube.com/@DaveGrayTeachesCode – React, Node, TypeScript
              https://www.youtube.com/@NetworkChuck        – networking, Linux, cybersecurity
              https://www.youtube.com/@TechWorldwithNana   – Docker, Kubernetes, DevOps
            """;

    private static final String SYSTEM_PROMPT = """
            You are a technical skills assessor for university students in Ghana.
            Given a CV/resume text and a target job role, identify the top skill gaps
            the candidate has for that role.

            Return ONLY a valid JSON array of gap objects with exactly these fields:
              skillName (string),
              importanceRank (int, 1 = most important),
              description (string, 1-2 sentences explaining the gap),
              recommendations (array of objects with: type (COURSE | BOOK | PROJECT),
                title (string), url (string or null)).
            Identify 3-7 skill gaps total. Provide 3-5 recommendations per gap.

            URL RULES:
            - COURSE: provide a URL for the resource. Prefer the platforms in the PREFERRED
                PLATFORMS list below — use their exact base URLs with no trailing paths.
                You may also use any other well-known platform, official documentation site,
                or YouTube channel NOT in the list if it is a better fit for the skill
                (e.g. docs.docker.com, developer.mozilla.org, spring.io/guides, roadmap.sh,
                git-scm.com, missing.csail.mit.edu, neetcode.io, or any reputable tech platform).
                For YouTube, always use the channel homepage URL (youtube.com/@channelname),
                never a specific video URL.
                Set url to null only if no suitable platform exists for this skill.
            - BOOK: set url to null. Put "Title by Author" in the title field.
            - PROJECT: set url to null. Describe the project idea in the title field.

            PREFERRED PLATFORMS:
            """ + PREFERRED_PLATFORMS + """

            No preamble. No markdown. No code fences. Valid JSON array only.
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

    public List<SkillGapTemplate> analyseGaps(String cvText, String targetRole) {
        String userMessage = "Target role: %s%n%nCV text:%n%s".formatted(targetRole, cvText);

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
        log.info("prompt={} targetRole={} cvTextLength={}", PROMPT_NAME, targetRole, cvText.length());

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

        log.info("prompt={} latencyMs={}", PROMPT_NAME, System.currentTimeMillis() - start);

        try {
            String json = rawJson.strip();
            if (json.startsWith("```")) {
                json = json.replaceFirst("^```[a-zA-Z]*\\r?\\n?", "")
                           .replaceFirst("\\r?\\n?```$", "")
                           .strip();
            }
            List<SkillGapTemplate> result = objectMapper.readValue(
                    json, new TypeReference<List<SkillGapTemplate>>() {});

            if (result == null || result.isEmpty()) {
                throw new AiServiceException("AI returned empty skill gap analysis");
            }
            return result;
        } catch (JsonProcessingException e) {
            log.error("Failed to parse Claude JSON response: {}", rawJson, e);
            throw new AiServiceException("AI service returned invalid response");
        }
    }
}
