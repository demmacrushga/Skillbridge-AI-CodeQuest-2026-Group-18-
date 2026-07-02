package com.skillbridge.career.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillbridge.career.exception.AiServiceException;
import com.skillbridge.career.service.dto.MilestoneTemplate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClaudeServiceTest {

    @Mock RestTemplate restTemplate;

    ClaudeService claudeService;

    private static final String VALID_RESPONSE = """
            {"content":[{"text":"[{\\"semester\\":1,\\"title\\":\\"Learn Java\\",\\"description\\":\\"Core Java\\",\\"milestoneType\\":\\"SKILL\\",\\"displayOrder\\":1}]"}]}
            """;

    @BeforeEach
    void setUp() {
        claudeService = new ClaudeService(
                restTemplate, new ObjectMapper(),
                "sk-ant-test", "claude-sonnet-4-6", 4096);
    }

    @Test
    void generateRoadmap_validResponse_returnsMilestoneTemplates() {
        when(restTemplate.postForObject(any(String.class), any(), eq(String.class)))
                .thenReturn(VALID_RESPONSE);

        List<MilestoneTemplate> result = claudeService.generateRoadmap(
                "Software Engineer", "Level 200", List.of("Python"));

        assertThat(result).hasSize(1);
        assertThat(result.get(0).title()).isEqualTo("Learn Java");
    }

    @Test
    void generateRoadmap_httpError_throwsAiServiceException() {
        when(restTemplate.postForObject(any(String.class), any(), eq(String.class)))
                .thenThrow(new RestClientException("Connection refused"));

        assertThatThrownBy(() -> claudeService.generateRoadmap(
                "Software Engineer", "Level 200", List.of()))
                .isInstanceOf(AiServiceException.class)
                .hasMessageContaining("unavailable");
    }

    @Test
    void generateRoadmap_malformedJson_throwsAiServiceException() {
        String badResponse = "{\"content\":[{\"text\":\"not-valid-json\"}]}";
        when(restTemplate.postForObject(any(String.class), any(), eq(String.class)))
                .thenReturn(badResponse);

        assertThatThrownBy(() -> claudeService.generateRoadmap(
                "Software Engineer", "Level 200", List.of()))
                .isInstanceOf(AiServiceException.class);
    }
}
