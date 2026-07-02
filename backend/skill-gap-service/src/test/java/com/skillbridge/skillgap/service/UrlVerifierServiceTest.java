package com.skillbridge.skillgap.service;

import com.skillbridge.skillgap.service.dto.RecommendationTemplate;
import com.skillbridge.skillgap.service.dto.SkillGapTemplate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UrlVerifierServiceTest {

    @Mock HttpClient httpClient;

    UrlVerifierService verifier;

    @BeforeEach
    void setUp() {
        verifier = new UrlVerifierService(httpClient);
    }

    @Test
    void stripBrokenUrls_allNullUrls_returnsUnchangedWithoutHttpCall() {
        List<SkillGapTemplate> gaps = List.of(
                new SkillGapTemplate("Java", 1, "Lacks Java",
                        List.of(new RecommendationTemplate("BOOK", "Clean Code by Robert Martin", null)))
        );

        List<SkillGapTemplate> result = verifier.stripBrokenUrls(gaps);

        assertThat(result).isEqualTo(gaps);
        verifyNoInteractions(httpClient);
    }

    @Test
    @SuppressWarnings("unchecked")
    void stripBrokenUrls_validUrl_keepsUrl() throws Exception {
        HttpResponse<Void> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);

        List<SkillGapTemplate> gaps = List.of(
                new SkillGapTemplate("Docker", 1, "No container experience",
                        List.of(new RecommendationTemplate("COURSE", "Docker 101", "https://docs.docker.com")))
        );

        List<SkillGapTemplate> result = verifier.stripBrokenUrls(gaps);

        assertThat(result.get(0).recommendations().get(0).url()).isEqualTo("https://docs.docker.com");
    }

    @Test
    @SuppressWarnings("unchecked")
    void stripBrokenUrls_404Url_nullsUrl() throws Exception {
        HttpResponse<Void> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(404);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);

        List<SkillGapTemplate> gaps = List.of(
                new SkillGapTemplate("Kubernetes", 1, "No k8s experience",
                        List.of(new RecommendationTemplate("COURSE", "K8s Course", "https://broken.example.com/k8s")))
        );

        List<SkillGapTemplate> result = verifier.stripBrokenUrls(gaps);

        assertThat(result.get(0).recommendations().get(0).url()).isNull();
    }

    @Test
    @SuppressWarnings("unchecked")
    void stripBrokenUrls_405Url_keepsUrl() throws Exception {
        HttpResponse<Void> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(405);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);

        List<SkillGapTemplate> gaps = List.of(
                new SkillGapTemplate("Spring", 1, "desc",
                        List.of(new RecommendationTemplate("COURSE", "Spring Docs", "https://docs.spring.io")))
        );

        List<SkillGapTemplate> result = verifier.stripBrokenUrls(gaps);

        assertThat(result.get(0).recommendations().get(0).url()).isEqualTo("https://docs.spring.io");
    }

    @Test
    @SuppressWarnings("unchecked")
    void stripBrokenUrls_networkError_nullsUrl() throws Exception {
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenThrow(new IOException("Connection refused"));

        List<SkillGapTemplate> gaps = List.of(
                new SkillGapTemplate("AWS", 1, "No cloud experience",
                        List.of(new RecommendationTemplate("COURSE", "AWS Training", "https://unreachable.example.com")))
        );

        List<SkillGapTemplate> result = verifier.stripBrokenUrls(gaps);

        assertThat(result.get(0).recommendations().get(0).url()).isNull();
    }

    @Test
    @SuppressWarnings("unchecked")
    void stripBrokenUrls_deduplicatesUrlChecks() throws Exception {
        HttpResponse<Void> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);

        String sharedUrl = "https://docs.docker.com";
        List<SkillGapTemplate> gaps = List.of(
                new SkillGapTemplate("Docker", 1, "desc",
                        List.of(
                                new RecommendationTemplate("COURSE", "Docker Intro", sharedUrl),
                                new RecommendationTemplate("COURSE", "Docker Advanced", sharedUrl)
                        ))
        );

        verifier.stripBrokenUrls(gaps);

        // Same URL appears twice but should only be checked once
        verify(httpClient, times(1)).send(any(), any());
    }
}
