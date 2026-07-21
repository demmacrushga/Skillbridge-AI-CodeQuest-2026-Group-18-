package com.skillbridge.mentorship.service;

import com.skillbridge.mentorship.dto.request.SendMessageRequest;
import com.skillbridge.mentorship.dto.request.SendRequestRequest;
import com.skillbridge.mentorship.dto.request.UpsertProfileRequest;
import com.skillbridge.mentorship.dto.response.AlumniSearchResponse;
import com.skillbridge.mentorship.dto.response.MessageResponse;
import com.skillbridge.mentorship.dto.response.PairResponse;
import com.skillbridge.mentorship.dto.response.ProfileResponse;
import com.skillbridge.mentorship.dto.response.RequestResponse;
import com.skillbridge.mentorship.dto.response.ThreadResponse;

import java.util.List;
import java.util.UUID;

public interface MentorshipService {

    ProfileResponse getProfile(UUID userId);

    ProfileResponse upsertProfile(UUID userId, UpsertProfileRequest request);

    AlumniSearchResponse searchAlumni(List<String> interests, String industry);

    RequestResponse sendRequest(UUID studentId, SendRequestRequest request);

    RequestResponse cancelRequest(UUID studentId, UUID requestId);

    List<RequestResponse> getMyRequests(UUID studentId);

    List<RequestResponse> getIncomingRequests(UUID alumniId);

    PairResponse acceptRequest(UUID alumniId, UUID requestId);

    RequestResponse declineRequest(UUID alumniId, UUID requestId);

    List<PairResponse> getMyPairs(UUID userId);

    PairResponse endPair(UUID userId, UUID pairId);

    ThreadResponse getThread(UUID userId, UUID pairId);

    MessageResponse sendMessage(UUID userId, UUID pairId, SendMessageRequest request);
}
