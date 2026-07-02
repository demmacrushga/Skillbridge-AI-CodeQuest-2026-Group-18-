package com.skillbridge.skillgap.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillbridge.skillgap.exception.AiServiceException;
import com.skillbridge.skillgap.service.dto.SkillGapTemplate;
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

    @Mock
    RestTemplate restTemplate;

    ClaudeService claudeService;

    private static final String VALID_RESPONSE = """
            {"content":[{"text":"[{\\"skillName\\":\\"Spring Boot\\",\\"importanceRank\\":1,\\"description\\":\\"Lacks backend experience\\",\\"recommendations\\":[{\\"type\\":\\"COURSE\\",\\"title\\":\\"Spring Boot in Practice\\",\\"url\\":\\"https://example.com\\"}]}]"}]}
            """;

    @BeforeEach
    void setUp() {
        claudeService = new ClaudeService(
                restTemplate, new ObjectMapper(),
                "sk-ant-test", "claude-sonnet-4-6", 4096);
    }

    @Test
    void analyseGaps_validResponse_returnsSkillGapTemplates() {
        when(restTemplate.postForObject(any(String.class), any(), eq(String.class)))
                .thenReturn(VALID_RESPONSE);

        List<SkillGapTemplate> result = claudeService.analyseGaps("Sample CV text", "Backend Developer");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).skillName()).isEqualTo("Spring Boot");
        assertThat(result.get(0).importanceRank()).isEqualTo(1);
        assertThat(result.get(0).recommendations()).hasSize(1);
    }

    @Test
    void analyseGaps_httpError_throwsAiServiceException() {
        when(restTemplate.postForObject(any(String.class), any(), eq(String.class)))
                .thenThrow(new RestClientException("Connection refused"));

        assertThatThrownBy(() -> claudeService.analyseGaps("CV text", "Backend Developer"))
                .isInstanceOf(AiServiceException.class)
                .hasMessageContaining("unavailable");
    }

    @Test
    void analyseGaps_malformedJson_throwsAiServiceException() {
        String badResponse = "{\"content\":[{\"text\":\"not-valid-json\"}]}";
        when(restTemplate.postForObject(any(String.class), any(), eq(String.class)))
                .thenReturn(badResponse);

        assertThatThrownBy(() -> claudeService.analyseGaps("CV text", "Backend Developer"))
                .isInstanceOf(AiServiceException.class);
    }

    @Test
    void analyseGaps_emptyArray_throwsAiServiceException() {
        String emptyResponse = "{\"content\":[{\"text\":\"[]\"}]}";
        when(restTemplate.postForObject(any(String.class), any(), eq(String.class)))
                .thenReturn(emptyResponse);

        assertThatThrownBy(() -> claudeService.analyseGaps("CV text", "Backend Developer"))
                .isInstanceOf(AiServiceException.class)
                .hasMessageContaining("empty");
    }

    @Test
    void analyseGaps_responseWithMarkdownFences_parsesSuccessfully() {
        String fencedResponse = "{\"content\":[{\"text\":\"```json\\n[{\\\"skillName\\\":\\\"Docker\\\",\\\"importanceRank\\\":1,\\\"description\\\":\\\"No containerization experience\\\",\\\"recommendations\\\":[{\\\"type\\\":\\\"PROJECT\\\",\\\"title\\\":\\\"Build a Docker app\\\",\\\"url\\\":null}]}]\\n```\"}]}";
        when(restTemplate.postForObject(any(String.class), any(), eq(String.class)))
                .thenReturn(fencedResponse);

        List<SkillGapTemplate> result = claudeService.analyseGaps("CV text", "DevOps Engineer");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).skillName()).isEqualTo("Docker");
    }
}
