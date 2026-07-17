package com.skillbridge.portfolio.service;

import com.skillbridge.portfolio.exception.WebsiteFetchException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.time.Duration;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WebsiteFetchServiceTest {

    @Mock private RestTemplateBuilder builder;
    @Mock private RestTemplate restTemplate;

    private WebsiteFetchService service;

    @BeforeEach
    void setUp() {
        when(builder.setConnectTimeout(any(Duration.class))).thenReturn(builder);
        when(builder.setReadTimeout(any(Duration.class))).thenReturn(builder);
        when(builder.build()).thenReturn(restTemplate);
        service = new WebsiteFetchService(builder, 50000, 15000, 30000);
    }

    @Test
    void fetchAndClean_validHtml_returnsCleanedText() {
        String html = "<html><head><script>alert('xss')</script></head><body><h1>My Projects</h1><p>Built an API</p></body></html>";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_HTML);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>(html, headers, 200));

        String result = service.fetchAndClean("https://example.com");

        assertThat(result).contains("My Projects");
        assertThat(result).contains("Built an API");
        assertThat(result).doesNotContain("alert");
    }

    @Test
    void fetchAndClean_404_throwsWebsiteFetchException() {
        HttpHeaders headers = new HttpHeaders();
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>(null, headers, 404));

        assertThatThrownBy(() -> service.fetchAndClean("https://example.com/missing"))
                .isInstanceOf(WebsiteFetchException.class)
                .hasMessageContaining("Could not fetch");
    }

    @Test
    void fetchAndClean_timeout_throwsWebsiteFetchException() {
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenThrow(new ResourceAccessException("Read timed out"));

        assertThatThrownBy(() -> service.fetchAndClean("https://slow-site.com"))
                .isInstanceOf(WebsiteFetchException.class)
                .hasMessageContaining("Could not fetch");
    }

    @Test
    void fetchAndClean_nonHtmlContentType_throwsWebsiteFetchException() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>("binary data", headers, 200));

        assertThatThrownBy(() -> service.fetchAndClean("https://example.com/file.pdf"))
                .isInstanceOf(WebsiteFetchException.class)
                .hasMessageContaining("HTML page");
    }

    @Test
    void fetchAndClean_largeHtml_truncatesToMaxChars() {
        StringBuilder html = new StringBuilder("<html><body>");
        StringBuilder text = new StringBuilder();
        for (int i = 0; i < 60000; i++) {
            html.append("<p>word").append(i).append("</p>");
            text.append("word").append(i).append(" ");
        }
        html.append("</body></html>");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_HTML);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>(html.toString(), headers, 200));

        String result = service.fetchAndClean("https://example.com/big");

        assertThat(result.length()).isLessThanOrEqualTo(50000);
    }
}
