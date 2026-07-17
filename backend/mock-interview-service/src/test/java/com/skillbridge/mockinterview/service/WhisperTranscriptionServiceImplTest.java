package com.skillbridge.mockinterview.service;

import com.skillbridge.mockinterview.exception.AiServiceException;
import com.skillbridge.mockinterview.exception.EmptyTranscriptException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhisperTranscriptionServiceImplTest {

    @Mock
    RestTemplate restTemplate;

    private WhisperTranscriptionServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new WhisperTranscriptionServiceImpl(restTemplate, "http://whisper:9000", 60000);
    }

    @Test
    void transcribe_validJson_returnsTrimmedTranscript() {
        when(restTemplate.postForObject(eq("http://whisper:9000/asr"), any(), eq(String.class)))
                .thenReturn("{\"text\":\"REST is resource-oriented and stateless.\"}");

        String result = service.transcribe(new byte[]{1, 2, 3}, "audio/mpeg");

        assertThat(result).isEqualTo("REST is resource-oriented and stateless.");
    }

    @Test
    void transcribe_jsonWithMarkdown_returnsTrimmedTranscript() {
        when(restTemplate.postForObject(eq("http://whisper:9000/asr"), any(), eq(String.class)))
                .thenReturn("```json\n{\"text\":\"hello world\"}\n```");

        String result = service.transcribe(new byte[]{1, 2, 3}, "audio/m4a");

        assertThat(result).isEqualTo("hello world");
    }

    @Test
    void transcribe_plainTextResponse_returnsAsIs() {
        when(restTemplate.postForObject(eq("http://whisper:9000/asr"), any(), eq(String.class)))
                .thenReturn("REST is resource-oriented and stateless.");

        String result = service.transcribe(new byte[]{1, 2, 3}, "audio/wav");

        assertThat(result).isEqualTo("REST is resource-oriented and stateless.");
    }

    @Test
    void transcribe_emptyBytes_throwsEmptyTranscript() {
        assertThatThrownBy(() -> service.transcribe(new byte[0], "audio/mpeg"))
                .isInstanceOf(EmptyTranscriptException.class);
    }

    @Test
    void transcribe_nullBytes_throwsEmptyTranscript() {
        assertThatThrownBy(() -> service.transcribe(null, "audio/mpeg"))
                .isInstanceOf(EmptyTranscriptException.class);
    }

    @Test
    void transcribe_emptyTranscriptFromWhisper_throwsEmptyTranscript() {
        when(restTemplate.postForObject(eq("http://whisper:9000/asr"), any(), eq(String.class)))
                .thenReturn("{\"text\":\"\"}");

        assertThatThrownBy(() -> service.transcribe(new byte[]{1}, "audio/mpeg"))
                .isInstanceOf(EmptyTranscriptException.class);
    }

    @Test
    void transcribe_blankTranscriptFromWhisper_throwsEmptyTranscript() {
        when(restTemplate.postForObject(eq("http://whisper:9000/asr"), any(), eq(String.class)))
                .thenReturn("{\"text\":\"   \"}");

        assertThatThrownBy(() -> service.transcribe(new byte[]{1}, "audio/mpeg"))
                .isInstanceOf(EmptyTranscriptException.class);
    }

    @Test
    void transcribe_nullBody_throwsEmptyTranscript() {
        when(restTemplate.postForObject(eq("http://whisper:9000/asr"), any(), eq(String.class)))
                .thenReturn(null);

        assertThatThrownBy(() -> service.transcribe(new byte[]{1}, "audio/mpeg"))
                .isInstanceOf(EmptyTranscriptException.class);
    }

    @Test
    void transcribe_whisperRestFailure_throwsAiService() {
        when(restTemplate.postForObject(eq("http://whisper:9000/asr"), any(), eq(String.class)))
                .thenThrow(new RestClientException("connection refused"));

        assertThatThrownBy(() -> service.transcribe(new byte[]{1}, "audio/mpeg"))
                .isInstanceOf(AiServiceException.class);
    }

    @Test
    void transcribe_nullContentType_defaultsM4aExtension() {
        when(restTemplate.postForObject(eq("http://whisper:9000/asr"), any(), eq(String.class)))
                .thenReturn("{\"text\":\"hello\"}");

        String result = service.transcribe(new byte[]{1}, null);

        assertThat(result).isEqualTo("hello");
    }
}