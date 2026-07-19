package com.skillbridge.matching.service;

import com.skillbridge.matching.dto.request.PostOpportunityRequest;
import com.skillbridge.matching.dto.request.UpdateSkillsRequest;
import com.skillbridge.matching.dto.response.ApplicantResponse;
import com.skillbridge.matching.dto.response.ApplicationResponse;
import com.skillbridge.matching.dto.response.ApplicationWithOpportunityResponse;
import com.skillbridge.matching.dto.response.MatchListResponse;
import com.skillbridge.matching.dto.response.OpportunityResponse;
import com.skillbridge.matching.dto.response.SkillsResponse;

import java.util.List;
import java.util.UUID;

public interface MatchingService {

    OpportunityResponse postOpportunity(PostOpportunityRequest request, UUID userId);

    MatchListResponse getMatches(UUID userId);

    ApplicationResponse apply(UUID opportunityId, UUID userId);

    List<ApplicationWithOpportunityResponse> getApplications(UUID userId);

    SkillsResponse getSkills(UUID userId);

    SkillsResponse updateSkills(UpdateSkillsRequest request, UUID userId);

    List<OpportunityResponse> getMyPostings(UUID userId);

    OpportunityResponse deactivate(UUID opportunityId, UUID userId);

    List<ApplicantResponse> getApplicants(UUID opportunityId, UUID userId);
}
