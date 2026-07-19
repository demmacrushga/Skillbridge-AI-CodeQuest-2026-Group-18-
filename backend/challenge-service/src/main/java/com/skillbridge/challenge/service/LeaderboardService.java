package com.skillbridge.challenge.service;

import com.skillbridge.challenge.dto.response.LeaderboardResponse;
import com.skillbridge.challenge.entity.Submission;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;

/**
 * Deterministic leaderboard ranking (research Decision 2, spec FR-009):
 * scored submissions only, score DESC, tie-break submittedAt ASC, 1-based rank.
 */
@Service
public class LeaderboardService {

    public LeaderboardResponse rank(UUID challengeId, List<Submission> scoredSubmissions) {
        List<Submission> sorted = scoredSubmissions.stream()
                .sorted(Comparator.comparing(Submission::getScore).reversed()
                        .thenComparing(Submission::getSubmittedAt))
                .toList();

        List<LeaderboardResponse.Entry> entries = IntStream.range(0, sorted.size())
                .mapToObj(i -> new LeaderboardResponse.Entry(
                        i + 1, sorted.get(i).getStudentId(), sorted.get(i).getScore()))
                .toList();

        return new LeaderboardResponse(challengeId, entries);
    }
}
