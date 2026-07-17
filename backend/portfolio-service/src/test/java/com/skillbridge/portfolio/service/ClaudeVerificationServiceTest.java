package com.skillbridge.portfolio.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillbridge.portfolio.entity.PortfolioItem;
import com.skillbridge.portfolio.exception.AiServiceException;
import com.skillbridge.portfolio.service.dto.ClaudeVerificationResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ClaudeVerificationServiceTest {

    @Mock private RestTemplate restTemplate;

    private ClaudeVerificationService service;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        service = new ClaudeVerificationService(restTemplate, objectMapper,
                "test-api-key", "claude-sonnet-4-6", 256);
    }

    private PortfolioItem buildItem(String description) {
        PortfolioItem item = new PortfolioItem();
        item.setId(UUID.randomUUID());
        item.setItemType("PROJECT");
        item.setTitle("My Project");
        item.setDescription(description);
        item.setExternalUrl("http://github.com/test");
        return item;
    }

    @Test
    void verify_approvedResponse_returnsApproved() {
        String apiResponse = """
                {"id":"msg_1","type":"message","role":"assistant",
                 "content":[{"type":"text","text":"{\\"decision\\":\\"APPROVED\\",\\"reason\\":\\"Clear project.\\"}"}],
                 "model":"claude-sonnet-4-6","stop_reason":"end_turn","usage":{"input_tokens":50,"output_tokens":20}}
                """;
        when(restTemplate.postForObject(anyString(), any(HttpEntity.class), eq(String.class)))
                .thenReturn(apiResponse);

        ClaudeVerificationResponse result = service.verify(buildItem("A solid project with code."));

        assertThat(result.decision()).isEqualTo("APPROVED");
        assertThat(result.reason()).isEqualTo("Clear project.");
    }

    @Test
    void verify_rejectedResponse_returnsRejected() {
        String apiResponse = """
                {"id":"msg_2","type":"message","role":"assistant",
                 "content":[{"type":"text","text":"{\\"decision\\":\\"REJECTED\\",\\"reason\\":\\"Too vague.\\"}"}],
                 "model":"claude-sonnet-4-6","stop_reason":"end_turn","usage":{"input_tokens":50,"output_tokens":10}}
                """;
        when(restTemplate.postForObject(anyString(), any(HttpEntity.class), eq(String.class)))
                .thenReturn(apiResponse);

        ClaudeVerificationResponse result = service.verify(buildItem("I did stuff"));

        assertThat(result.decision()).isEqualTo("REJECTED");
        assertThat(result.reason()).isEqualTo("Too vague.");
    }

    @Test
    void verify_httpError_throwsAiServiceException() {
        when(restTemplate.postForObject(anyString(), any(HttpEntity.class), eq(String.class)))
                .thenThrow(new ResourceAccessException("Connection refused"));

        assertThatThrownBy(() -> service.verify(buildItem("Some project")))
                .isInstanceOf(AiServiceException.class)
                .hasMessageContaining("AI service unavailable");
    }

    @Test
    void verify_malformedJson_throwsAiServiceException() {
        String apiResponse = """
                {"id":"msg_3","type":"message","role":"assistant",
                 "content":[{"type":"text","text":"not valid json at all"}],
                 "model":"claude-sonnet-4-6","stop_reason":"end_turn","usage":{"input_tokens":50,"output_tokens":5}}
                """;
        when(restTemplate.postForObject(anyString(), any(HttpEntity.class), eq(String.class)))
                .thenReturn(apiResponse);

        assertThatThrownBy(() -> service.verify(buildItem("Some project")))
                .isInstanceOf(AiServiceException.class)
                .hasMessageContaining("AI service returned invalid response");
    }

    @Test
    void verify_longDescription_truncatedTo2000Chars() {
        String longDesc = "x".repeat(3000);
        String apiResponse = """
                {"id":"msg_4","type":"message","role":"assistant",
                 "content":[{"type":"text","text":"{\\"decision\\":\\"APPROVED\\",\\"reason\\":\\"OK.\\"}"}],
                 "model":"claude-sonnet-4-6","stop_reason":"end_turn","usage":{"input_tokens":200,"output_tokens":10}}
                """;
        when(restTemplate.postForObject(anyString(), any(HttpEntity.class), eq(String.class)))
                .thenReturn(apiResponse);

        ClaudeVerificationResponse result = service.verify(buildItem(longDesc));

        assertThat(result.decision()).isEqualTo("APPROVED");
        verify(restTemplate).postForObject(anyString(), argThat(entity -> {
            String body = entity.toString();
            return !body.contains("x".repeat(2001));
        }), eq(String.class));
    }

    @Test
    void verify_fencedJsonResponse_stripsAndParsesCorrectly() {
        String apiResponse = """
                {"id":"msg_5","type":"message","role":"assistant",
                 "content":[{"type":"text","text":"```json\\n{\\"decision\\":\\"APPROVED\\",\\"reason\\":\\"Nice.\\"}\\n```"}],
                 "model":"claude-sonnet-4-6","stop_reason":"end_turn","usage":{"input_tokens":50,"output_tokens":15}}
                """;
        when(restTemplate.postForObject(anyString(), any(HttpEntity.class), eq(String.class)))
                .thenReturn(apiResponse);

        ClaudeVerificationResponse result = service.verify(buildItem("A project"));

        assertThat(result.decision()).isEqualTo("APPROVED");
        assertThat(result.reason()).isEqualTo("Nice.");
    }
}
