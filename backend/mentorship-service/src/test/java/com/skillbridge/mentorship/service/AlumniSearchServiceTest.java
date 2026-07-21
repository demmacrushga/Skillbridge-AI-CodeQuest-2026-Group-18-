package com.skillbridge.mentorship.service;

import com.skillbridge.mentorship.dto.response.AlumniSearchEntry;
import com.skillbridge.mentorship.entity.AlumniProfile;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AlumniSearchServiceTest {

    private final AlumniSearchService searchService = new AlumniSearchService();

    private AlumniProfile profile(String industry, Instant updatedAt, String... tags) {
        AlumniProfile p = new AlumniProfile();
        p.setId(UUID.randomUUID());
        p.setUserId(UUID.randomUUID());
        p.setIndustry(industry);
        p.setCareerInterests(List.of(tags));
        p.setUpdatedAt(updatedAt);
        p.setAvailable(true);
        return p;
    }

    private static final Instant T1 = Instant.parse("2026-07-01T00:00:00Z");
    private static final Instant T2 = Instant.parse("2026-07-10T00:00:00Z");

    @Test
    void ranksByMatchingTagCountDescending() {
        AlumniProfile twoTags = profile("Fintech", T1, "fintech", "backend engineering");
        AlumniProfile oneTag = profile("Fintech", T2, "fintech");

        List<AlumniSearchEntry> result = searchService.search(
                List.of(oneTag, twoTags), List.of("fintech", "backend engineering"), null);

        assertThat(result).extracting(AlumniSearchEntry::matchingTags).containsExactly(2, 1);
        assertThat(result.get(0).alumniId()).isEqualTo(twoTags.getUserId());
    }

    @Test
    void tieBrokenByMostRecentlyUpdated() {
        AlumniProfile older = profile(null, T1, "fintech");
        AlumniProfile newer = profile(null, T2, "fintech");

        List<AlumniSearchEntry> result = searchService.search(
                List.of(older, newer), List.of("fintech"), null);

        assertThat(result).extracting(AlumniSearchEntry::alumniId)
                .containsExactly(newer.getUserId(), older.getUserId());
    }

    @Test
    void tagMatchIsCaseAndWhitespaceInsensitive() {
        AlumniProfile p = profile(null, T1, "Backend   Engineering");

        List<AlumniSearchEntry> result = searchService.search(
                List.of(p), List.of("  backend engineering "), null);

        assertThat(result.get(0).matchingTags()).isEqualTo(1);
    }

    @Test
    void industryFilterIsCaseInsensitiveExactMatch() {
        AlumniProfile fintech = profile("Fintech", T1, "a");
        AlumniProfile health = profile("Healthcare", T2, "a");

        List<AlumniSearchEntry> result = searchService.search(
                List.of(fintech, health), null, "fintech");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).alumniId()).isEqualTo(fintech.getUserId());
    }

    @Test
    void noFiltersReturnsAllOrderedByUpdatedAtDesc() {
        AlumniProfile older = profile(null, T1, "a");
        AlumniProfile newer = profile(null, T2, "b");

        List<AlumniSearchEntry> result = searchService.search(List.of(older, newer), null, null);

        assertThat(result).extracting(AlumniSearchEntry::alumniId)
                .containsExactly(newer.getUserId(), older.getUserId());
        assertThat(result).allSatisfy(e -> assertThat(e.matchingTags()).isZero());
    }

    @Test
    void emptyResultWhenNothingMatchesIndustry() {
        AlumniProfile p = profile("Fintech", T1, "a");

        assertThat(searchService.search(List.of(p), null, "Aerospace")).isEmpty();
    }

    @Test
    void deterministicAcrossRepeatedCalls() {
        AlumniProfile a = profile("Fintech", T1, "fintech", "cloud");
        AlumniProfile b = profile("Fintech", T2, "fintech");
        List<AlumniProfile> profiles = List.of(a, b);
        List<String> interests = List.of("fintech", "cloud");

        assertThat(searchService.search(profiles, interests, null))
                .isEqualTo(searchService.search(profiles, interests, null));
    }

    @Test
    void normalizeHandlesNullAndWhitespace() {
        assertThat(AlumniSearchService.normalize(null)).isEmpty();
        assertThat(AlumniSearchService.normalize("  Backend   Engineering ")).isEqualTo("backend engineering");
    }
}
