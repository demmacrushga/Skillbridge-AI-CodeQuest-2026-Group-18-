package com.skillbridge.challenge.service;

import com.skillbridge.challenge.dto.response.LeaderboardResponse;
import com.skillbridge.challenge.entity.Submission;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class LeaderboardServiceTest {

    private final LeaderboardService leaderboardService = new LeaderboardService();

    private static final UUID CHALLENGE_ID = UUID.randomUUID();

    private Submission submission(UUID studentId, String score, String submittedAt) {
        Submission s = new Submission();
        s.setId(UUID.randomUUID());
        s.setStudentId(studentId);
        s.setScore(new BigDecimal(score));
        s.setSubmittedAt(Instant.parse(submittedAt));
        return s;
    }

    @Test
    void rank_ordersByScoreDescending() {
        UUID high = UUID.randomUUID();
        UUID low = UUID.randomUUID();

        LeaderboardResponse result = leaderboardService.rank(CHALLENGE_ID, List.of(
                submission(low, "70.00", "2026-07-10T10:00:00Z"),
                submission(high, "94.50", "2026-07-09T10:00:00Z")));

        assertThat(result.challengeId()).isEqualTo(CHALLENGE_ID);
        assertThat(result.entries()).hasSize(2);
        assertThat(result.entries().get(0).studentId()).isEqualTo(high);
        assertThat(result.entries().get(0).rank()).isEqualTo(1);
        assertThat(result.entries().get(0).score()).isEqualByComparingTo("94.50");
        assertThat(result.entries().get(1).studentId()).isEqualTo(low);
        assertThat(result.entries().get(1).rank()).isEqualTo(2);
    }

    @Test
    void rank_equalScores_earlierSubmissionWins() {
        // quickstart §7 hand-check (SC-007): both 85.50 → first submitter ranks 1
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();

        LeaderboardResponse result = leaderboardService.rank(CHALLENGE_ID, List.of(
                submission(second, "85.50", "2026-07-10T12:00:00Z"),
                submission(first, "85.50", "2026-07-10T10:00:00Z")));

        assertThat(result.entries().get(0).studentId()).isEqualTo(first);
        assertThat(result.entries().get(0).rank()).isEqualTo(1);
        assertThat(result.entries().get(1).studentId()).isEqualTo(second);
        assertThat(result.entries().get(1).rank()).isEqualTo(2);
    }

    @Test
    void rank_emptyInput_emptyEntries() {
        LeaderboardResponse result = leaderboardService.rank(CHALLENGE_ID, List.of());

        assertThat(result.entries()).isEmpty();
    }

    @Test
    void rank_deterministicOnRepeat() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        List<Submission> input = List.of(
                submission(a, "88.00", "2026-07-10T10:00:00Z"),
                submission(b, "88.00", "2026-07-10T09:00:00Z"));

        LeaderboardResponse first = leaderboardService.rank(CHALLENGE_ID, input);
        LeaderboardResponse second = leaderboardService.rank(CHALLENGE_ID, input);

        assertThat(first.entries().stream().map(LeaderboardResponse.Entry::studentId).toList())
                .isEqualTo(second.entries().stream().map(LeaderboardResponse.Entry::studentId).toList());
        assertThat(first.entries().get(0).studentId()).isEqualTo(b); // earlier submittedAt wins
    }

    @Test
    void rank_boundaryScores_zeroAndHundred() {
        UUID zero = UUID.randomUUID();
        UUID hundred = UUID.randomUUID();

        LeaderboardResponse result = leaderboardService.rank(CHALLENGE_ID, List.of(
                submission(zero, "0.00", "2026-07-10T10:00:00Z"),
                submission(hundred, "100.00", "2026-07-10T11:00:00Z")));

        assertThat(result.entries().get(0).score()).isEqualByComparingTo("100.00");
        assertThat(result.entries().get(1).score()).isEqualByComparingTo("0.00");
    }
}
