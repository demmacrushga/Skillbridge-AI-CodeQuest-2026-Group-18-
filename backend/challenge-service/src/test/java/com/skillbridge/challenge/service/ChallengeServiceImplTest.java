package com.skillbridge.challenge.service;

import com.skillbridge.challenge.dto.request.PostChallengeRequest;
import com.skillbridge.challenge.dto.request.ScoreSubmissionRequest;
import com.skillbridge.challenge.dto.request.SubmitSolutionRequest;
import com.skillbridge.challenge.dto.response.ChallengeListResponse;
import com.skillbridge.challenge.dto.response.ChallengeResponse;
import com.skillbridge.challenge.dto.response.LeaderboardResponse;
import com.skillbridge.challenge.dto.response.MySubmissionResponse;
import com.skillbridge.challenge.dto.response.SubmissionResponse;
import com.skillbridge.challenge.dto.response.SubmissionReviewResponse;
import com.skillbridge.challenge.entity.Challenge;
import com.skillbridge.challenge.entity.Submission;
import com.skillbridge.challenge.exception.ChallengeNotFoundException;
import com.skillbridge.challenge.exception.DuplicateSubmissionException;
import com.skillbridge.challenge.repository.ChallengeRepository;
import com.skillbridge.challenge.repository.SubmissionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChallengeServiceImplTest {

    @Mock ChallengeRepository challengeRepository;
    @Mock SubmissionRepository submissionRepository;
    @Mock LeaderboardService leaderboardService;

    @InjectMocks ChallengeServiceImpl challengeService;

    private static final UUID STUDENT_ID = UUID.randomUUID();
    private static final UUID RECRUITER_ID = UUID.randomUUID();
    private static final UUID CHALLENGE_ID = UUID.randomUUID();
    private static final UUID SUBMISSION_ID = UUID.randomUUID();

    private PostChallengeRequest validRequest;

    @BeforeEach
    void setUp() {
        validRequest = new PostChallengeRequest(
                "Build a Fraud Detection API",
                "Design and implement an API that flags fraudulent transactions",
                "GitHub repository link with a README explaining your approach",
                Instant.now().plusSeconds(30 * 24 * 3600));
    }

    private Challenge activeChallenge() {
        Challenge c = new Challenge();
        c.setId(CHALLENGE_ID);
        c.setPostedBy(RECRUITER_ID);
        c.setTitle("Build a Fraud Detection API");
        c.setActive(true);
        c.setDeadline(Instant.now().plusSeconds(30 * 24 * 3600));
        c.setCreatedAt(Instant.now());
        return c;
    }

    // ── US1: postChallenge ─────────────────────────────────────────────

    @Test
    void postChallenge_persistsAndDefaultsActive() {
        when(challengeRepository.save(any(Challenge.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        ChallengeResponse response = challengeService.postChallenge(validRequest, RECRUITER_ID);

        assertThat(response.active()).isTrue();
        assertThat(response.title()).isEqualTo("Build a Fraud Detection API");
        assertThat(response.submissionFormat()).contains("GitHub");
        assertThat(response.submissionCount()).isZero();
        verify(challengeRepository).save(any(Challenge.class));
    }

    // ── US2: getActiveChallenges ───────────────────────────────────────

    @Test
    void getActiveChallenges_flagsSubmittedForCaller() {
        Challenge c = activeChallenge();
        when(challengeRepository.findActiveChallenges()).thenReturn(List.of(c));

        Submission s = new Submission();
        s.setChallenge(c);
        s.setStudentId(STUDENT_ID);
        when(submissionRepository.findByStudentIdOrderBySubmittedAtDesc(STUDENT_ID))
                .thenReturn(List.of(s));

        ChallengeListResponse result = challengeService.getActiveChallenges(STUDENT_ID);

        assertThat(result.challenges()).hasSize(1);
        assertThat(result.challenges().get(0).submitted()).isTrue();
    }

    @Test
    void getActiveChallenges_recruiterCaller_allSubmittedFalse() {
        Challenge c = activeChallenge();
        when(challengeRepository.findActiveChallenges()).thenReturn(List.of(c));
        when(submissionRepository.findByStudentIdOrderBySubmittedAtDesc(RECRUITER_ID))
                .thenReturn(List.of());

        ChallengeListResponse result = challengeService.getActiveChallenges(RECRUITER_ID);

        assertThat(result.challenges().get(0).submitted()).isFalse();
    }

    @Test
    void getActiveChallenges_emptyBoard_returnsEmptyList() {
        when(challengeRepository.findActiveChallenges()).thenReturn(List.of());
        when(submissionRepository.findByStudentIdOrderBySubmittedAtDesc(STUDENT_ID))
                .thenReturn(List.of());

        assertThat(challengeService.getActiveChallenges(STUDENT_ID).challenges()).isEmpty();
    }

    // ── US3: submit ────────────────────────────────────────────────────

    @Test
    void submit_happyPath_scoreNull() {
        Challenge c = activeChallenge();
        when(challengeRepository.findById(CHALLENGE_ID)).thenReturn(Optional.of(c));
        when(submissionRepository.existsByChallengeIdAndStudentId(CHALLENGE_ID, STUDENT_ID))
                .thenReturn(false);
        when(submissionRepository.saveAndFlush(any(Submission.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        SubmissionResponse response = challengeService.submit(
                CHALLENGE_ID, new SubmitSolutionRequest("https://github.com/student/fraud-api"),
                STUDENT_ID);

        assertThat(response.challengeId()).isEqualTo(CHALLENGE_ID);
        assertThat(response.submissionUrl()).isEqualTo("https://github.com/student/fraud-api");
        assertThat(response.score()).isNull();
    }

    @Test
    void submit_unknownChallenge_throws404() {
        when(challengeRepository.findById(CHALLENGE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> challengeService.submit(
                CHALLENGE_ID, new SubmitSolutionRequest("https://github.com/x/y"), STUDENT_ID))
                .isInstanceOf(ChallengeNotFoundException.class);
    }

    @Test
    void submit_inactiveChallenge_throws404() {
        Challenge c = activeChallenge();
        c.setActive(false);
        when(challengeRepository.findById(CHALLENGE_ID)).thenReturn(Optional.of(c));

        assertThatThrownBy(() -> challengeService.submit(
                CHALLENGE_ID, new SubmitSolutionRequest("https://github.com/x/y"), STUDENT_ID))
                .isInstanceOf(ChallengeNotFoundException.class);
    }

    @Test
    void submit_expiredChallenge_throws404() {
        Challenge c = activeChallenge();
        c.setDeadline(Instant.now().minusSeconds(3600));
        when(challengeRepository.findById(CHALLENGE_ID)).thenReturn(Optional.of(c));

        assertThatThrownBy(() -> challengeService.submit(
                CHALLENGE_ID, new SubmitSolutionRequest("https://github.com/x/y"), STUDENT_ID))
                .isInstanceOf(ChallengeNotFoundException.class);
    }

    @Test
    void submit_duplicate_throws409() {
        Challenge c = activeChallenge();
        when(challengeRepository.findById(CHALLENGE_ID)).thenReturn(Optional.of(c));
        when(submissionRepository.existsByChallengeIdAndStudentId(CHALLENGE_ID, STUDENT_ID))
                .thenReturn(true);

        assertThatThrownBy(() -> challengeService.submit(
                CHALLENGE_ID, new SubmitSolutionRequest("https://github.com/x/y"), STUDENT_ID))
                .isInstanceOf(DuplicateSubmissionException.class);
    }

    @Test
    void submit_uniqueConstraintRace_throws409() {
        Challenge c = activeChallenge();
        when(challengeRepository.findById(CHALLENGE_ID)).thenReturn(Optional.of(c));
        when(submissionRepository.existsByChallengeIdAndStudentId(CHALLENGE_ID, STUDENT_ID))
                .thenReturn(false);
        when(submissionRepository.saveAndFlush(any(Submission.class)))
                .thenThrow(new DataIntegrityViolationException("uq violation"));

        assertThatThrownBy(() -> challengeService.submit(
                CHALLENGE_ID, new SubmitSolutionRequest("https://github.com/x/y"), STUDENT_ID))
                .isInstanceOf(DuplicateSubmissionException.class);
    }

    // ── US4: getMySubmissions ──────────────────────────────────────────

    @Test
    void getMySubmissions_returnsNewestFirstWithChallenge() {
        Challenge c = activeChallenge();
        Submission s = new Submission();
        s.setId(SUBMISSION_ID);
        s.setChallenge(c);
        s.setStudentId(STUDENT_ID);
        s.setSubmissionUrl("https://github.com/student/fraud-api");
        when(submissionRepository.findByStudentIdOrderBySubmittedAtDesc(STUDENT_ID))
                .thenReturn(List.of(s));

        List<MySubmissionResponse> result = challengeService.getMySubmissions(STUDENT_ID);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).challenge().id()).isEqualTo(CHALLENGE_ID);
        assertThat(result.get(0).challenge().submissionCount()).isNull();
        assertThat(result.get(0).score()).isNull();
    }

    // ── US5: scoring ───────────────────────────────────────────────────

    @Test
    void getSubmissionsForReview_wrongOwner_throws404() {
        Challenge c = activeChallenge();
        c.setPostedBy(UUID.randomUUID());
        when(challengeRepository.findById(CHALLENGE_ID)).thenReturn(Optional.of(c));

        assertThatThrownBy(() -> challengeService.getSubmissionsForReview(CHALLENGE_ID, RECRUITER_ID))
                .isInstanceOf(ChallengeNotFoundException.class);
    }

    @Test
    void getSubmissionsForReview_returnsNewestFirst() {
        Challenge c = activeChallenge();
        when(challengeRepository.findById(CHALLENGE_ID)).thenReturn(Optional.of(c));
        Submission s = new Submission();
        s.setId(SUBMISSION_ID);
        s.setStudentId(STUDENT_ID);
        when(submissionRepository.findByChallengeIdOrderBySubmittedAtDesc(CHALLENGE_ID))
                .thenReturn(List.of(s));

        List<SubmissionReviewResponse> result =
                challengeService.getSubmissionsForReview(CHALLENGE_ID, RECRUITER_ID);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).studentId()).isEqualTo(STUDENT_ID);
    }

    @Test
    void scoreSubmission_happyPath_persistsScore() {
        Challenge c = activeChallenge();
        when(challengeRepository.findById(CHALLENGE_ID)).thenReturn(Optional.of(c));
        Submission s = new Submission();
        s.setId(SUBMISSION_ID);
        s.setChallenge(c);
        when(submissionRepository.findById(SUBMISSION_ID)).thenReturn(Optional.of(s));
        when(submissionRepository.save(any(Submission.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        SubmissionReviewResponse response = challengeService.scoreSubmission(
                CHALLENGE_ID, SUBMISSION_ID,
                new ScoreSubmissionRequest(new BigDecimal("85.50")), RECRUITER_ID);

        assertThat(response.score()).isEqualByComparingTo("85.50");
        verify(submissionRepository).save(s);
    }

    @Test
    void scoreSubmission_rescore_replacesScore() {
        Challenge c = activeChallenge();
        when(challengeRepository.findById(CHALLENGE_ID)).thenReturn(Optional.of(c));
        Submission s = new Submission();
        s.setId(SUBMISSION_ID);
        s.setChallenge(c);
        s.setScore(new BigDecimal("50.00"));
        when(submissionRepository.findById(SUBMISSION_ID)).thenReturn(Optional.of(s));
        when(submissionRepository.save(any(Submission.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        SubmissionReviewResponse response = challengeService.scoreSubmission(
                CHALLENGE_ID, SUBMISSION_ID,
                new ScoreSubmissionRequest(new BigDecimal("95.00")), RECRUITER_ID);

        assertThat(response.score()).isEqualByComparingTo("95.00");
    }

    @Test
    void scoreSubmission_expiredChallenge_stillScores() {
        Challenge c = activeChallenge();
        c.setDeadline(Instant.now().minusSeconds(3600)); // window closed — evaluation happens now
        when(challengeRepository.findById(CHALLENGE_ID)).thenReturn(Optional.of(c));
        Submission s = new Submission();
        s.setId(SUBMISSION_ID);
        s.setChallenge(c);
        when(submissionRepository.findById(SUBMISSION_ID)).thenReturn(Optional.of(s));
        when(submissionRepository.save(any(Submission.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        SubmissionReviewResponse response = challengeService.scoreSubmission(
                CHALLENGE_ID, SUBMISSION_ID,
                new ScoreSubmissionRequest(new BigDecimal("70.00")), RECRUITER_ID);

        assertThat(response.score()).isEqualByComparingTo("70.00");
    }

    @Test
    void scoreSubmission_deactivatedChallenge_stillScores() {
        Challenge c = activeChallenge();
        c.setActive(false);
        when(challengeRepository.findById(CHALLENGE_ID)).thenReturn(Optional.of(c));
        Submission s = new Submission();
        s.setId(SUBMISSION_ID);
        s.setChallenge(c);
        when(submissionRepository.findById(SUBMISSION_ID)).thenReturn(Optional.of(s));
        when(submissionRepository.save(any(Submission.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        SubmissionReviewResponse response = challengeService.scoreSubmission(
                CHALLENGE_ID, SUBMISSION_ID,
                new ScoreSubmissionRequest(new BigDecimal("70.00")), RECRUITER_ID);

        assertThat(response.score()).isEqualByComparingTo("70.00");
    }

    @Test
    void scoreSubmission_submissionNotInChallenge_throws404() {
        Challenge c = activeChallenge();
        when(challengeRepository.findById(CHALLENGE_ID)).thenReturn(Optional.of(c));
        Challenge other = new Challenge();
        other.setId(UUID.randomUUID());
        Submission s = new Submission();
        s.setId(SUBMISSION_ID);
        s.setChallenge(other);
        when(submissionRepository.findById(SUBMISSION_ID)).thenReturn(Optional.of(s));

        assertThatThrownBy(() -> challengeService.scoreSubmission(
                CHALLENGE_ID, SUBMISSION_ID,
                new ScoreSubmissionRequest(new BigDecimal("70.00")), RECRUITER_ID))
                .isInstanceOf(ChallengeNotFoundException.class);
    }

    @Test
    void scoreSubmission_wrongOwner_throws404() {
        Challenge c = activeChallenge();
        c.setPostedBy(UUID.randomUUID());
        when(challengeRepository.findById(CHALLENGE_ID)).thenReturn(Optional.of(c));

        assertThatThrownBy(() -> challengeService.scoreSubmission(
                CHALLENGE_ID, SUBMISSION_ID,
                new ScoreSubmissionRequest(new BigDecimal("70.00")), RECRUITER_ID))
                .isInstanceOf(ChallengeNotFoundException.class);
    }

    // ── US6: leaderboard ───────────────────────────────────────────────

    @Test
    void getLeaderboard_unknownChallenge_throws404() {
        when(challengeRepository.existsById(CHALLENGE_ID)).thenReturn(false);

        assertThatThrownBy(() -> challengeService.getLeaderboard(CHALLENGE_ID))
                .isInstanceOf(ChallengeNotFoundException.class);
    }

    @Test
    void getLeaderboard_delegatesToLeaderboardService() {
        when(challengeRepository.existsById(CHALLENGE_ID)).thenReturn(true);
        Submission s = new Submission();
        s.setScore(new BigDecimal("90.00"));
        when(submissionRepository.findByChallengeIdAndScoreIsNotNull(CHALLENGE_ID))
                .thenReturn(List.of(s));
        LeaderboardResponse expected = new LeaderboardResponse(CHALLENGE_ID,
                List.of(new LeaderboardResponse.Entry(1, STUDENT_ID, new BigDecimal("90.00"))));
        when(leaderboardService.rank(eq(CHALLENGE_ID), anyList())).thenReturn(expected);

        LeaderboardResponse result = challengeService.getLeaderboard(CHALLENGE_ID);

        assertThat(result.entries()).hasSize(1);
        assertThat(result.entries().get(0).rank()).isEqualTo(1);
        verify(leaderboardService).rank(eq(CHALLENGE_ID), anyList());
    }

    // ── US7: recruiter management ──────────────────────────────────────

    @Test
    void getMyChallenges_includesSubmissionCounts() {
        Challenge c = activeChallenge();
        when(challengeRepository.findByPostedByOrderByCreatedAtDesc(RECRUITER_ID))
                .thenReturn(List.of(c));
        when(submissionRepository.countByChallengeId(CHALLENGE_ID)).thenReturn(2L);

        List<ChallengeResponse> result = challengeService.getMyChallenges(RECRUITER_ID);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).submissionCount()).isEqualTo(2L);
    }

    @Test
    void deactivate_marksInactive_andIsIdempotent() {
        Challenge c = activeChallenge();
        when(challengeRepository.findById(CHALLENGE_ID)).thenReturn(Optional.of(c));
        when(submissionRepository.countByChallengeId(CHALLENGE_ID)).thenReturn(0L);

        ChallengeResponse first = challengeService.deactivate(CHALLENGE_ID, RECRUITER_ID);
        assertThat(first.active()).isFalse();
        verify(challengeRepository).save(c);

        // Second call: already inactive → no additional save, still 200
        ChallengeResponse second = challengeService.deactivate(CHALLENGE_ID, RECRUITER_ID);
        assertThat(second.active()).isFalse();
        verify(challengeRepository, times(1)).save(c);
    }

    @Test
    void deactivate_wrongOwner_throws404() {
        Challenge c = activeChallenge();
        c.setPostedBy(UUID.randomUUID());
        when(challengeRepository.findById(CHALLENGE_ID)).thenReturn(Optional.of(c));

        assertThatThrownBy(() -> challengeService.deactivate(CHALLENGE_ID, RECRUITER_ID))
                .isInstanceOf(ChallengeNotFoundException.class);
    }
}
