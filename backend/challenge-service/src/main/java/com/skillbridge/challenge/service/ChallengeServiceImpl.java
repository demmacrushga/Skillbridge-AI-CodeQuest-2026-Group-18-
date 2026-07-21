package com.skillbridge.challenge.service;

import com.skillbridge.challenge.dto.request.PostChallengeRequest;
import com.skillbridge.challenge.dto.request.ScoreSubmissionRequest;
import com.skillbridge.challenge.dto.request.SubmitSolutionRequest;
import com.skillbridge.challenge.dto.response.ChallengeListEntry;
import com.skillbridge.challenge.dto.response.ChallengeListResponse;
import com.skillbridge.challenge.dto.response.ChallengeResponse;
import com.skillbridge.challenge.dto.response.LeaderboardResponse;
import com.skillbridge.challenge.dto.response.MySubmissionResponse;
import com.skillbridge.challenge.dto.response.SubmissionResponse;
import com.skillbridge.challenge.dto.response.SubmissionReviewResponse;
import com.skillbridge.challenge.entity.Challenge;
import com.skillbridge.challenge.entity.Submission;
import com.skillbridge.challenge.client.NotificationClient;
import com.skillbridge.challenge.exception.ChallengeNotFoundException;
import com.skillbridge.challenge.exception.DuplicateSubmissionException;
import com.skillbridge.challenge.repository.ChallengeRepository;
import com.skillbridge.challenge.repository.SubmissionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChallengeServiceImpl implements ChallengeService {

    private final ChallengeRepository challengeRepository;
    private final SubmissionRepository submissionRepository;
    private final LeaderboardService leaderboardService;
    private final NotificationClient notificationClient;

    // ── US1: Post a challenge (RECRUITER) ──────────────────────────────
    @Override
    @Transactional
    public ChallengeResponse postChallenge(PostChallengeRequest request, UUID userId) {
        Challenge challenge = new Challenge();
        challenge.setPostedBy(userId);
        challenge.setTitle(request.title().trim());
        challenge.setDescription(request.description().trim());
        challenge.setSubmissionFormat(request.submissionFormat().trim());
        challenge.setDeadline(request.deadline());
        challenge.setActive(true);

        Challenge saved = challengeRepository.save(challenge);
        log.info("Challenge posted id={} deadline={}", saved.getId(), saved.getDeadline());
        return toChallengeResponse(saved, 0L);
    }

    // ── US2: Browse active challenges (any authenticated) ──────────────
    @Override
    @Transactional(readOnly = true)
    public ChallengeListResponse getActiveChallenges(UUID userId) {
        List<Challenge> active = challengeRepository.findActiveChallenges();

        // One query for the caller's submissions; recruiters simply have none → all false.
        Set<UUID> submittedChallengeIds = submissionRepository
                .findByStudentIdOrderBySubmittedAtDesc(userId).stream()
                .map(s -> s.getChallenge().getId())
                .collect(Collectors.toSet());

        List<ChallengeListEntry> entries = active.stream()
                .map(c -> new ChallengeListEntry(
                        c.getId(), c.getTitle(), c.getDescription(), c.getSubmissionFormat(),
                        c.getDeadline(), c.getCreatedAt(),
                        submittedChallengeIds.contains(c.getId())))
                .toList();

        return new ChallengeListResponse(entries);
    }

    // ── US3: Submit a solution (STUDENT) ───────────────────────────────
    @Override
    @Transactional
    public SubmissionResponse submit(UUID challengeId, SubmitSolutionRequest request, UUID userId) {
        Challenge challenge = challengeRepository.findById(challengeId)
                .filter(c -> c.isActive() && c.getDeadline().isAfter(Instant.now()))
                .orElseThrow(() -> new ChallengeNotFoundException("Challenge not found"));

        if (submissionRepository.existsByChallengeIdAndStudentId(challengeId, userId)) {
            throw new DuplicateSubmissionException("Already submitted to this challenge");
        }

        Submission submission = new Submission();
        submission.setChallenge(challenge);
        submission.setStudentId(userId);
        submission.setSubmissionUrl(request.submissionUrl().trim());
        try {
            Submission saved = submissionRepository.saveAndFlush(submission);
            log.info("Submission recorded student={} challenge={}", userId, challengeId);
            return new SubmissionResponse(saved.getId(), challengeId,
                    saved.getSubmissionUrl(), saved.getScore(), saved.getSubmittedAt());
        } catch (DataIntegrityViolationException e) {
            // Unique-constraint race fallback (FR-005)
            throw new DuplicateSubmissionException("Already submitted to this challenge");
        }
    }

    // ── US4: My submissions (STUDENT) ──────────────────────────────────
    @Override
    @Transactional(readOnly = true)
    public List<MySubmissionResponse> getMySubmissions(UUID userId) {
        return submissionRepository.findByStudentIdOrderBySubmittedAtDesc(userId).stream()
                .map(s -> new MySubmissionResponse(
                        s.getId(), s.getSubmissionUrl(), s.getScore(), s.getSubmittedAt(),
                        toChallengeResponse(s.getChallenge(), null)))
                .toList();
    }

    // ── US7: Manage own challenges (RECRUITER) ─────────────────────────
    @Override
    @Transactional(readOnly = true)
    public List<ChallengeResponse> getMyChallenges(UUID userId) {
        return challengeRepository.findByPostedByOrderByCreatedAtDesc(userId).stream()
                .map(c -> toChallengeResponse(c, submissionRepository.countByChallengeId(c.getId())))
                .toList();
    }

    @Override
    @Transactional
    public ChallengeResponse deactivate(UUID challengeId, UUID userId) {
        Challenge challenge = findOwnedChallenge(challengeId, userId);

        if (challenge.isActive()) {
            challenge.setActive(false);
            challengeRepository.save(challenge);
            log.info("Challenge deactivated id={}", challengeId);
        }
        return toChallengeResponse(challenge, submissionRepository.countByChallengeId(challengeId));
    }

    // ── US5: Score submissions (RECRUITER, owner) ──────────────────────
    @Override
    @Transactional(readOnly = true)
    public List<SubmissionReviewResponse> getSubmissionsForReview(UUID challengeId, UUID userId) {
        findOwnedChallenge(challengeId, userId);
        return submissionRepository.findByChallengeIdOrderBySubmittedAtDesc(challengeId).stream()
                .map(this::toReviewResponse)
                .toList();
    }

    @Override
    @Transactional
    public SubmissionReviewResponse scoreSubmission(UUID challengeId, UUID submissionId,
                                                    ScoreSubmissionRequest request, UUID userId) {
        Challenge challenge = findOwnedChallenge(challengeId, userId);

        // Ownership is the only guard — scoring stays open after deadline/deactivation
        // (research Decision 1, spec FR-007).
        Submission submission = submissionRepository.findById(submissionId)
                .filter(s -> s.getChallenge().getId().equals(challengeId))
                .orElseThrow(() -> new ChallengeNotFoundException("Submission not found"));

        submission.setScore(request.score());
        Submission saved = submissionRepository.save(submission);
        log.info("Submission scored id={} challenge={} score={}", submissionId, challengeId, request.score());

        notifyChallengeScored(challenge, saved);

        return toReviewResponse(saved);
    }

    private void notifyChallengeScored(Challenge challenge, Submission submission) {
        try {
            notificationClient.notify(
                    submission.getStudentId(),
                    "CHALLENGE_SCORED",
                    "Your submission was scored",
                    String.format("%s — you scored %s. Check the leaderboard to see your rank.",
                            challenge.getTitle(), submission.getScore()));
        } catch (Exception e) {
            log.warn("Failed to send challenge scored notification: {}", e.getMessage());
        }
    }

    // ── US6: Leaderboard (any authenticated) ───────────────────────────
    @Override
    @Transactional(readOnly = true)
    public LeaderboardResponse getLeaderboard(UUID challengeId) {
        if (!challengeRepository.existsById(challengeId)) {
            throw new ChallengeNotFoundException("Challenge not found");
        }
        // Works for expired/deactivated challenges — history preserved (research Decision 2).
        return leaderboardService.rank(challengeId,
                submissionRepository.findByChallengeIdAndScoreIsNotNull(challengeId));
    }

    // ── helpers ────────────────────────────────────────────────────────
    private Challenge findOwnedChallenge(UUID challengeId, UUID userId) {
        return challengeRepository.findById(challengeId)
                .filter(c -> c.getPostedBy().equals(userId))
                .orElseThrow(() -> new ChallengeNotFoundException("Challenge not found"));
    }

    private ChallengeResponse toChallengeResponse(Challenge c, Long submissionCount) {
        return new ChallengeResponse(
                c.getId(), c.getTitle(), c.getDescription(), c.getSubmissionFormat(),
                c.getDeadline(), c.isActive(), c.getCreatedAt(), submissionCount);
    }

    private SubmissionReviewResponse toReviewResponse(Submission s) {
        return new SubmissionReviewResponse(
                s.getId(), s.getStudentId(), s.getSubmissionUrl(), s.getScore(), s.getSubmittedAt());
    }
}
