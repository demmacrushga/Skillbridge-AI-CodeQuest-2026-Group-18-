package com.skillbridge.skillgap.service;

import com.skillbridge.skillgap.service.dto.RecommendationTemplate;
import com.skillbridge.skillgap.service.dto.SkillGapTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
public class UrlVerifierService {

    private static final Logger log = LoggerFactory.getLogger(UrlVerifierService.class);

    private final HttpClient httpClient;

    public UrlVerifierService(HttpClient httpClient) {
        this.httpClient = httpClient;
    }

    public List<SkillGapTemplate> stripBrokenUrls(List<SkillGapTemplate> gaps) {
        // Deduplicate URLs and check them all concurrently
        Map<String, CompletableFuture<Boolean>> checks = gaps.stream()
                .flatMap(g -> g.recommendations().stream())
                .map(RecommendationTemplate::url)
                .filter(url -> url != null && !url.isBlank())
                .distinct()
                .collect(Collectors.toMap(url -> url, this::isAlive, (a, b) -> a));

        if (checks.isEmpty()) return gaps;

        try {
            CompletableFuture.allOf(checks.values().toArray(new CompletableFuture[0]))
                    .get(10, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.warn("URL verification did not complete within timeout, proceeding with partial results");
        }

        return gaps.stream().map(gap -> new SkillGapTemplate(
                gap.skillName(),
                gap.importanceRank(),
                gap.description(),
                gap.recommendations().stream()
                        .map(rec -> {
                            if (rec.url() == null) return rec;
                            boolean alive = checks
                                    .getOrDefault(rec.url(), CompletableFuture.completedFuture(false))
                                    .getNow(false);
                            if (!alive) log.info("Nulling broken URL: {}", rec.url());
                            return alive ? rec : new RecommendationTemplate(rec.type(), rec.title(), null);
                        })
                        .toList()
        )).toList();
    }

    private CompletableFuture<Boolean> isAlive(String url) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                URI uri = URI.create(url);
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(uri)
                        .method("HEAD", HttpRequest.BodyPublishers.noBody())
                        .timeout(Duration.ofSeconds(5))
                        .header("User-Agent", "Mozilla/5.0 SkillBridge/1.0")
                        .build();
                HttpResponse<Void> response = httpClient.send(request, HttpResponse.BodyHandlers.discarding());
                int status = response.statusCode();
                log.debug("URL {} → {}", url, status);
                // 405 = server alive but doesn't allow HEAD — treat as valid
                return status < 400 || status == 405;
            } catch (Exception e) {
                log.debug("URL check failed for {}: {}", url, e.getMessage());
                return false;
            }
        });
    }
}
