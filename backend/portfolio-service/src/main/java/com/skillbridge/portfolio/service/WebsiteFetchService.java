package com.skillbridge.portfolio.service;

import com.skillbridge.portfolio.exception.WebsiteFetchException;
import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

@Service
public class WebsiteFetchService {

    private static final Logger log = LoggerFactory.getLogger(WebsiteFetchService.class);

    private final RestTemplate restTemplate;
    private final int maxHtmlChars;

    public WebsiteFetchService(
            RestTemplateBuilder builder,
            @Value("${portfolio.extraction.max-html-chars}") int maxHtmlChars,
            @Value("${portfolio.extraction.url-connect-timeout-ms}") int connectTimeoutMs,
            @Value("${portfolio.extraction.url-read-timeout-ms}") int readTimeoutMs) {
        this.restTemplate = builder
                .setConnectTimeout(Duration.ofMillis(connectTimeoutMs))
                .setReadTimeout(Duration.ofMillis(readTimeoutMs))
                .build();
        this.maxHtmlChars = maxHtmlChars;
    }

    public String fetchAndClean(String url) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("User-Agent", "SkillBridgeAI/1.0 (portfolio extraction)");
        headers.setAccept(java.util.List.of(MediaType.TEXT_HTML));

        ResponseEntity<String> response;
        try {
            response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), String.class);
        } catch (ResourceAccessException e) {
            log.error("Failed to fetch URL {}: {}", url, e.getMessage());
            throw new WebsiteFetchException("Could not fetch content from the provided URL", e);
        } catch (Exception e) {
            log.error("Failed to fetch URL {}: {}", url, e.getMessage());
            throw new WebsiteFetchException("Could not fetch content from the provided URL", e);
        }

        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new WebsiteFetchException("Could not fetch content from the provided URL");
        }

        MediaType contentType = response.getHeaders().getContentType();
        if (contentType == null || !contentType.isCompatibleWith(MediaType.TEXT_HTML)) {
            throw new WebsiteFetchException("URL must point to an HTML page, not a file download.");
        }

        String html = response.getBody();
        if (html == null || html.isBlank()) {
            throw new WebsiteFetchException("Could not fetch content from the provided URL");
        }

        String cleanedHtml = Jsoup.clean(html, Safelist.relaxed());
        String text = Jsoup.parse(cleanedHtml).text();

        if (text.length() > maxHtmlChars) {
            log.warn("Fetched HTML from {} truncated from {} to {} chars", url, text.length(), maxHtmlChars);
            text = text.substring(0, maxHtmlChars);
        }

        return text;
    }
}
