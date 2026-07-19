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

import java.util.List;
import java.util.UUID;

public interface ChallengeService {

    ChallengeResponse postChallenge(PostChallengeRequest request, UUID userId);

    ChallengeListResponse getActiveChallenges(UUID userId);

    SubmissionResponse submit(UUID challengeId, SubmitSolutionRequest request, UUID userId);

    List<MySubmissionResponse> getMySubmissions(UUID userId);

    List<ChallengeResponse> getMyChallenges(UUID userId);

    ChallengeResponse deactivate(UUID challengeId, UUID userId);

    List<SubmissionReviewResponse> getSubmissionsForReview(UUID challengeId, UUID userId);

    SubmissionReviewResponse scoreSubmission(UUID challengeId, UUID submissionId,
                                             ScoreSubmissionRequest request, UUID userId);

    LeaderboardResponse getLeaderboard(UUID challengeId);
}
