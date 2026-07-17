package com.skillbridge.mockinterview.service;

import com.skillbridge.mockinterview.exception.AiServiceException;
import com.skillbridge.mockinterview.exception.EmptyTranscriptException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

@Service
public class WhisperTranscriptionServiceImpl implements WhisperTranscriptionService {

    private static final Logger log = LoggerFactory.getLogger(WhisperTranscriptionServiceImpl.class);

    static final String WHISPER_TRANSCRIBE_V1 = "WHISPER_TRANSCRIBE_V1";

    private final RestTemplate restTemplate;
    private final String whisperUrl;
    private final int timeoutMs;

    public WhisperTranscriptionServiceImpl(
            RestTemplate restTemplate,
            @Value("${whisper.url:http://whisper-service:9000}") String whisperUrl,
            @Value("${whisper.timeout-ms:60000}") int timeoutMs) {
        this.restTemplate = restTemplate;
        this.whisperUrl = whisperUrl;
        this.timeoutMs = timeoutMs;
    }

    @Override
    public String transcribe(byte[] audioBytes, String contentType) {
        if (audioBytes == null || audioBytes.length == 0) {
            throw new EmptyTranscriptException("No speech detected");
        }

        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("audio_file", new ByteArrayResource(audioBytes) {
            @Override
            public String getFilename() {
                return "answer." + extensionFor(contentType);
            }
        });

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        long start = System.currentTimeMillis();
        log.info("prompt={} audioBytes={}", WHISPER_TRANSCRIBE_V1, audioBytes.length);

        String responseBody;
        try {
            responseBody = restTemplate.postForObject(
                    whisperUrl + "/asr",
                    new HttpEntity<>(form, headers),
                    String.class);
        } catch (RestClientException e) {
            log.error("Whisper API call failed for prompt={}", WHISPER_TRANSCRIBE_V1, e);
            throw new AiServiceException("AI service unavailable", e);
        } catch (Exception e) {
            log.error("Unexpected error calling Whisper for prompt={}", WHISPER_TRANSCRIBE_V1, e);
            throw new AiServiceException("AI service unavailable", e);
        } finally {
            log.info("prompt={} latencyMs={}", WHISPER_TRANSCRIBE_V1, System.currentTimeMillis() - start);
        }

        String text = parseTranscript(responseBody);
        if (text == null || text.isBlank()) {
            log.warn("prompt={} whisper returned empty transcript", WHISPER_TRANSCRIBE_V1);
            throw new EmptyTranscriptException("No speech detected");
        }
        return text.strip();
    }

    private String parseTranscript(String body) {
        if (body == null || body.isBlank()) {
            return null;
        }
        String json = body.strip();
        if (json.startsWith("```")) {
            json = json.replaceFirst("^```[a-zA-Z]*\\r?\\n?", "")
                    .replaceFirst("\\r?\\n?```$", "")
                    .strip();
        }
        int brace = json.indexOf('{');
        if (brace < 0) {
            // Some Whisper servers return plain text when output_txt mode is set.
            return json;
        }
        json = json.substring(brace);
        int colon = json.indexOf(":");
        if (colon < 0) {
            return null;
        }
        int valueStart = colon + 1;
        int valueEnd = json.length() - 1;
        while (valueStart < json.length() && Character.isWhitespace(json.charAt(valueStart))) {
            valueStart++;
        }
        boolean quoted = valueStart < json.length() && json.charAt(valueStart) == '"';
        if (quoted) {
            valueStart++;
            int close = json.indexOf('"', valueStart);
            if (close < 0) {
                return json.substring(valueStart).strip();
            }
            return json.substring(valueStart, close);
        }
        if (valueEnd >= valueStart) {
            return json.substring(valueStart, valueEnd).strip();
        }
        return null;
    }

    private String extensionFor(String contentType) {
        if (contentType == null) {
            return "m4a";
        }
        return switch (contentType) {
            case "audio/mpeg" -> "mp3";
            case "audio/wav" -> "wav";
            default -> "m4a";
        };
    }
}