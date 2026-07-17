package com.skillbridge.mockinterview.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillbridge.mockinterview.exception.AiServiceException;
import com.skillbridge.mockinterview.service.dto.AnswerEvaluationTemplate;
import com.skillbridge.mockinterview.service.dto.QuestionTemplate;
import com.skillbridge.mockinterview.service.dto.SessionSummaryTemplate;
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
class ClaudeInterviewServiceTest {

    @Mock
    RestTemplate restTemplate;

    ClaudeInterviewService claudeInterviewService;

    @BeforeEach
    void setUp() {
        claudeInterviewService = new ClaudeInterviewService(
                restTemplate, new ObjectMapper(),
                "sk-ant-test", "claude-sonnet-4-6", 2048);
    }

    @Test
    void generateQuestions_validArray_returnsTemplates() {
        String response = """
                {"content":[{"text":"[{\\\"questionText\\\":\\\"Explain REST\\\",\\\"category\\\":\\\"TECHNICAL\\\",\\\"orderIndex\\\":1}]"}]}
                """;
        when(restTemplate.postForObject(any(String.class), any(), eq(String.class)))
                .thenReturn(response);

        List<QuestionTemplate> result = claudeInterviewService.generateQuestions("Backend Developer", "ENTRY");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).questionText()).isEqualTo("Explain REST");
        assertThat(result.get(0).category()).isEqualTo("TECHNICAL");
        assertThat(result.get(0).orderIndex()).isEqualTo(1);
    }

    @Test
    void generateQuestions_markdownFences_parsesSuccessfully() {
        String response = """
                {"content":[{"text":"```json\\n[{\\\"questionText\\\":\\\"Q1\\\",\\\"category\\\":\\\"BEHAVIORAL\\\",\\\"orderIndex\\\":1}]\\n```"}]}
                """;
        when(restTemplate.postForObject(any(String.class), any(), eq(String.class)))
                .thenReturn(response);

        List<QuestionTemplate> result = claudeInterviewService.generateQuestions("DevOps Engineer", "MID");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).category()).isEqualTo("BEHAVIORAL");
    }

    @Test
    void generateQuestions_preambleBeforeArray_parsesSuccessfully() {
        String response = """
                {"content":[{"text":"Here are the questions:\\n[{\\\"questionText\\\":\\\"Q1\\\",\\\"category\\\":\\\"SITUATIONAL\\\",\\\"orderIndex\\\":1}]"}]}
                """;
        when(restTemplate.postForObject(any(String.class), any(), eq(String.class)))
                .thenReturn(response);

        List<QuestionTemplate> result = claudeInterviewService.generateQuestions("Analyst", "SENIOR");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).category()).isEqualTo("SITUATIONAL");
    }

    @Test
    void generateQuestions_unknownCategory_normalizedToOther() {
        String response = """
                {"content":[{"text":"[{\\\"questionText\\\":\\\"Q1\\\",\\\"category\\\":\\\"CODING\\\",\\\"orderIndex\\\":5}]"}]}
                """;
        when(restTemplate.postForObject(any(String.class), any(), eq(String.class)))
                .thenReturn(response);

        List<QuestionTemplate> result = claudeInterviewService.generateQuestions("Backend Developer", "ENTRY");

        assertThat(result.get(0).category()).isEqualTo("OTHER");
        assertThat(result.get(0).orderIndex()).isEqualTo(1);
    }

    @Test
    void generateQuestions_emptyArray_throwsAiServiceException() {
        String response = """
                {"content":[{"text":"[]"}]}
                """;
        when(restTemplate.postForObject(any(String.class), any(), eq(String.class)))
                .thenReturn(response);

        assertThatThrownBy(() -> claudeInterviewService.generateQuestions("Backend Developer", "ENTRY"))
                .isInstanceOf(AiServiceException.class);
    }

    @Test
    void generateQuestions_httpError_throwsAiServiceException() {
        when(restTemplate.postForObject(any(String.class), any(), eq(String.class)))
                .thenThrow(new RestClientException("Connection refused"));

        assertThatThrownBy(() -> claudeInterviewService.generateQuestions("Backend Developer", "ENTRY"))
                .isInstanceOf(AiServiceException.class)
                .hasMessageContaining("unavailable");
    }

    @Test
    void generateQuestions_malformedJson_throwsAiServiceException() {
        String response = """
                {"content":[{"text":"not-valid-json"}]}
                """;
        when(restTemplate.postForObject(any(String.class), any(), eq(String.class)))
                .thenReturn(response);

        assertThatThrownBy(() -> claudeInterviewService.generateQuestions("Backend Developer", "ENTRY"))
                .isInstanceOf(AiServiceException.class);
    }

    @Test
    void evaluateAnswer_validObject_returnsEvaluation() {
        String response = """
                {"content":[{"text":"{\\\"score\\\":7,\\\"feedback\\\":\\\"Good grasp of REST fundamentals.\\\"}"}]}
                """;
        when(restTemplate.postForObject(any(String.class), any(), eq(String.class)))
                .thenReturn(response);

        AnswerEvaluationTemplate result = claudeInterviewService.evaluateAnswer(
                "Backend Developer", "ENTRY", "Explain REST", "TECHNICAL", "REST is for CRUD.");

        assertThat(result.score()).isEqualTo(7);
        assertThat(result.feedback()).contains("REST");
    }

    @Test
    void evaluateAnswer_fencedWithPreamble_parsesSuccessfully() {
        String response = """
                {"content":[{"text":"Here is the evaluation:\\n```json\\n{\\\"score\\\":8,\\\"feedback\\\":\\\"Great.\\\"}\\n```"}]}
                """;
        when(restTemplate.postForObject(any(String.class), any(), eq(String.class)))
                .thenReturn(response);

        AnswerEvaluationTemplate result = claudeInterviewService.evaluateAnswer(
                "Backend Developer", "ENTRY", "Explain REST", "TECHNICAL", "REST is for CRUD.");

        assertThat(result.score()).isEqualTo(8);
    }

    @Test
    void generateSummary_validObject_returnsSummary() {
        String response = """
                {"content":[{"text":"{\\\"overallScore\\\":72,\\\"overallFeedback\\\":\\\"Solid performance.\\\"}"}]}
                """;
        when(restTemplate.postForObject(any(String.class), any(), eq(String.class)))
                .thenReturn(response);

        SessionSummaryTemplate result = claudeInterviewService.generateSummary(
                "Backend Developer", "ENTRY", "Q1: ...\nAnswer: ...\nScore: 7\n");

        assertThat(result.overallScore()).isEqualTo(72);
        assertThat(result.overallFeedback()).contains("Solid");
    }

    @Test
    void generateSummary_httpError_throwsAiServiceException() {
        when(restTemplate.postForObject(any(String.class), any(), eq(String.class)))
                .thenThrow(new RestClientException("Connection refused"));

        assertThatThrownBy(() -> claudeInterviewService.generateSummary(
                "Backend Developer", "ENTRY", "digest"))
                .isInstanceOf(AiServiceException.class);
    }
}
