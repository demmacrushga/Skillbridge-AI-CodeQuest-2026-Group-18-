package com.skillbridge.career.service;

import com.skillbridge.career.dto.request.CompleteMilestoneRequest;
import com.skillbridge.career.dto.request.GenerateRoadmapRequest;
import com.skillbridge.career.dto.response.CareerPathResponse;
import com.skillbridge.career.dto.response.CompletionResponse;
import com.skillbridge.career.dto.response.MilestoneResponse;
import com.skillbridge.career.dto.response.RoadmapResponse;
import com.skillbridge.career.entity.CareerPath;
import com.skillbridge.career.entity.Milestone;
import com.skillbridge.career.entity.MilestoneCompletion;
import com.skillbridge.career.entity.Roadmap;
import com.skillbridge.career.exception.CareerPathNotFoundException;
import com.skillbridge.career.exception.MilestoneNotFoundException;
import com.skillbridge.career.exception.RoadmapNotFoundException;
import com.skillbridge.career.repository.*;
import com.skillbridge.career.service.dto.MilestoneTemplate;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CareerServiceImpl implements CareerService {

    private final CareerPathRepository careerPathRepository;
    private final RoadmapRepository roadmapRepository;
    private final MilestoneRepository milestoneRepository;
    private final MilestoneCompletionRepository completionRepository;
    private final ClaudeService claudeService;

    @Override
    @Transactional
    public RoadmapResponse generateRoadmap(GenerateRoadmapRequest request, UUID userId) {
        CareerPath careerPath = careerPathRepository.findByName(request.careerPath())
                .orElseThrow(() -> new CareerPathNotFoundException(request.careerPath()));

        // Replace existing roadmap for this user + career path (one active roadmap per combination)
        roadmapRepository.findByUserIdAndCareerPath(userId, careerPath)
                .ifPresent(roadmapRepository::delete);

        List<MilestoneTemplate> templates = claudeService.generateRoadmap(
                request.careerPath(), request.academicLevel(), request.currentSkills());

        Roadmap roadmap = new Roadmap();
        roadmap.setUserId(userId);
        roadmap.setCareerPath(careerPath);
        roadmap.setAcademicLevel(request.academicLevel());
        roadmap.setCurrentSkills(String.join(", ", request.currentSkills()));
        roadmap.setProgressPercent(0);
        roadmapRepository.save(roadmap);

        List<Milestone> milestones = templates.stream().map(t -> {
            Milestone m = new Milestone();
            m.setRoadmap(roadmap);
            m.setSemester(t.semester());
            m.setTitle(t.title());
            m.setDescription(t.description());
            m.setMilestoneType(t.milestoneType());
            m.setDisplayOrder(t.displayOrder());
            return m;
        }).collect(Collectors.toList());

        milestoneRepository.saveAll(milestones);

        List<MilestoneResponse> milestoneResponses = milestones.stream()
                .map(m -> toMilestoneResponse(m, false))
                .toList();

        return new RoadmapResponse(roadmap.getId(), careerPath.getName(), 0, milestoneResponses);
    }

    @Override
    @Transactional(readOnly = true)
    public RoadmapResponse getRoadmap(UUID userId, UUID requestingUserId) {
        if (!userId.equals(requestingUserId)) {
            throw new AccessDeniedException("You can only view your own roadmap");
        }

        Roadmap roadmap = roadmapRepository.findTopByUserIdOrderByCreatedAtDesc(userId)
                .orElseThrow(() -> new RoadmapNotFoundException("No roadmap found for user " + userId));

        List<Milestone> milestones = milestoneRepository.findByRoadmapId(roadmap.getId());
        List<UUID> milestoneIds = milestones.stream().map(Milestone::getId).toList();

        Set<UUID> completedIds = completionRepository
                .findByUserIdAndMilestoneIdIn(userId, milestoneIds)
                .stream()
                .map(c -> c.getMilestone().getId())
                .collect(Collectors.toSet());

        int progressPercent = milestones.isEmpty() ? 0
                : (int) ((completedIds.size() * 100L) / milestones.size());

        List<MilestoneResponse> milestoneResponses = milestones.stream()
                .map(m -> toMilestoneResponse(m, completedIds.contains(m.getId())))
                .toList();

        return new RoadmapResponse(roadmap.getId(), roadmap.getCareerPath().getName(),
                progressPercent, milestoneResponses);
    }

    @Override
    @Transactional
    public CompletionResponse completeMilestone(UUID milestoneId, UUID requestingUserId,
                                                CompleteMilestoneRequest request) {
        Milestone milestone = milestoneRepository.findById(milestoneId)
                .orElseThrow(() -> new MilestoneNotFoundException("Milestone not found: " + milestoneId));

        Roadmap roadmap = milestone.getRoadmap();
        if (!roadmap.getUserId().equals(requestingUserId)) {
            throw new AccessDeniedException("You can only complete milestones in your own roadmap");
        }

        MilestoneCompletion completion = new MilestoneCompletion();
        completion.setMilestone(milestone);
        completion.setUserId(requestingUserId);
        completion.setEvidenceNote(request != null ? request.evidenceNote() : null);
        completionRepository.save(completion);

        List<UUID> milestoneIds = milestoneRepository.findByRoadmapId(roadmap.getId())
                .stream().map(Milestone::getId).toList();
        long totalCount = milestoneIds.size();
        long completedCount = completionRepository.countByUserIdAndMilestoneIdIn(requestingUserId, milestoneIds);

        int progressPercent = totalCount == 0 ? 0 : (int) ((completedCount * 100L) / totalCount);
        roadmap.setProgressPercent(progressPercent);
        roadmapRepository.save(roadmap);

        return new CompletionResponse(toMilestoneResponse(milestone, true), progressPercent);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CareerPathResponse> getCareerPaths() {
        return careerPathRepository.findAllByOrderByNameAsc().stream()
                .map(cp -> new CareerPathResponse(cp.getId(), cp.getName(), cp.getDescription()))
                .toList();
    }

    private MilestoneResponse toMilestoneResponse(Milestone m, boolean completed) {
        return new MilestoneResponse(
                m.getId(), m.getSemester(), m.getTitle(), m.getDescription(),
                m.getMilestoneType().name(), m.getDisplayOrder(), completed);
    }
}
