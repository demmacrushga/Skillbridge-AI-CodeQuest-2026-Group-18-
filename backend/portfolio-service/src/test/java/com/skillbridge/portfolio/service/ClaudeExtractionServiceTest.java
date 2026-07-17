package com.skillbridge.portfolio.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillbridge.portfolio.exception.AiServiceException;
import com.skillbridge.portfolio.service.dto.ExtractedItemTemplate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ClaudeExtractionServiceTest {

    @Mock private RestTemplate restTemplate;

    private ClaudeExtractionService service;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        service = new ClaudeExtractionService(restTemplate, objectMapper,
                "test-api-key", "claude-sonnet-4-6", 4096);
    }

    private String claudeResponse(String text) {
        return """
                {"id":"msg_1","type":"message","role":"assistant",
                 "content":[{"type":"text","text":"%s"}],
                 "model":"claude-sonnet-4-6","stop_reason":"end_turn","usage":{"input_tokens":50,"output_tokens":20}}
                """.formatted(text.replace("\"", "\\\"").replace("\n", "\\n"));
    }

    @Test
    void extract_validItems_returnsExtractedItems() {
        String itemsJson = """
                [{"itemType":"PROJECT","title":"E-commerce API","description":"Spring Boot API","externalUrl":"https://github.com/user/repo","confidence":0.9},
                 {"itemType":"CERTIFICATION","title":"AWS CCP","description":"Cloud cert","externalUrl":null,"confidence":0.8}]""";
        when(restTemplate.postForObject(anyString(), any(HttpEntity.class), eq(String.class)))
                .thenReturn(claudeResponse(itemsJson));

        List<ExtractedItemTemplate> result = service.extract("some cv text");

        assertThat(result).hasSize(2);
        assertThat(result.get(0).itemType()).isEqualTo("PROJECT");
        assertThat(result.get(0).title()).isEqualTo("E-commerce API");
        assertThat(result.get(0).confidence()).isEqualTo(0.9);
    }

    @Test
    void extract_emptyArray_returnsEmptyList() {
        when(restTemplate.postForObject(anyString(), any(HttpEntity.class), eq(String.class)))
                .thenReturn(claudeResponse("[]"));

        List<ExtractedItemTemplate> result = service.extract("courses only cv");

        assertThat(result).isEmpty();
    }

    @Test
    void extract_httpError_throwsAiServiceException() {
        when(restTemplate.postForObject(anyString(), any(HttpEntity.class), eq(String.class)))
                .thenThrow(new ResourceAccessException("Connection refused"));

        assertThatThrownBy(() -> service.extract("some text"))
                .isInstanceOf(AiServiceException.class)
                .hasMessageContaining("AI service unavailable");
    }

    @Test
    void extract_malformedJson_throwsAiServiceException() {
        when(restTemplate.postForObject(anyString(), any(HttpEntity.class), eq(String.class)))
                .thenReturn(claudeResponse("not valid json"));

        assertThatThrownBy(() -> service.extract("some text"))
                .isInstanceOf(AiServiceException.class)
                .hasMessageContaining("AI service returned an invalid response");
    }

    @Test
    void extract_moreThan50Items_truncatesTo50() {
        StringBuilder itemsJson = new StringBuilder("[");
        for (int i = 0; i < 60; i++) {
            if (i > 0) itemsJson.append(",");
            itemsJson.append("{\"itemType\":\"PROJECT\",\"title\":\"Project ").append(i)
                    .append("\",\"description\":\"desc\",\"externalUrl\":null,\"confidence\":0.5}");
        }
        itemsJson.append("]");

        when(restTemplate.postForObject(anyString(), any(HttpEntity.class), eq(String.class)))
                .thenReturn(claudeResponse(itemsJson.toString()));

        List<ExtractedItemTemplate> result = service.extract("big cv");

        assertThat(result).hasSize(50);
    }

    @Test
    void extract_fencedJsonResponse_stripsAndParsesCorrectly() {
        String itemsJson = """
                ```json
                [{"itemType":"AWARD","title":"Dean's List","description":"Academic excellence","externalUrl":null,"confidence":0.85}]
                ```""";
        when(restTemplate.postForObject(anyString(), any(HttpEntity.class), eq(String.class)))
                .thenReturn(claudeResponse(itemsJson));

        List<ExtractedItemTemplate> result = service.extract("cv text");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).itemType()).isEqualTo("AWARD");
        assertThat(result.get(0).title()).isEqualTo("Dean's List");
    }
}
