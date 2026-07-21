package com.skillbridge.career.service;

import com.skillbridge.career.dto.request.CompleteMilestoneRequest;
import com.skillbridge.career.dto.request.GenerateRoadmapRequest;
import com.skillbridge.career.dto.response.CareerPathResponse;
import com.skillbridge.career.dto.response.CompletionResponse;
import com.skillbridge.career.dto.response.RoadmapResponse;

import java.util.List;
import java.util.UUID;

public interface CareerService {
    RoadmapResponse generateRoadmap(GenerateRoadmapRequest request, UUID userId);
    RoadmapResponse getRoadmap(UUID userId, UUID requestingUserId);
    CompletionResponse completeMilestone(UUID milestoneId, UUID requestingUserId, CompleteMilestoneRequest request);
    List<CareerPathResponse> getCareerPaths();
}

//also a simple change