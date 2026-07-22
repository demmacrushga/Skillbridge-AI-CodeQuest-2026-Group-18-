package com.skillbridge.career.service;

import com.skillbridge.career.client.NotificationClient;
import com.skillbridge.career.dto.request.CompleteMilestoneRequest;
import com.skillbridge.career.dto.request.GenerateRoadmapRequest;
import com.skillbridge.career.dto.response.CompletionResponse;
import com.skillbridge.career.dto.response.RoadmapResponse;
import com.skillbridge.career.entity.CareerPath;
import com.skillbridge.career.entity.Milestone;
import com.skillbridge.career.entity.MilestoneCompletion;
import com.skillbridge.career.entity.Roadmap;
import com.skillbridge.career.enums.MilestoneType;
import com.skillbridge.career.exception.AiServiceException;
import com.skillbridge.career.exception.CareerPathNotFoundException;
import com.skillbridge.career.exception.MilestoneNotFoundException;
import com.skillbridge.career.repository.*;
import com.skillbridge.career.service.dto.MilestoneTemplate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CareerServiceTest {

    @Mock CareerPathRepository careerPathRepository;
    @Mock RoadmapRepository roadmapRepository;
    @Mock MilestoneRepository milestoneRepository;
    @Mock MilestoneCompletionRepository completionRepository;
    @Mock ClaudeService claudeService;
    @Mock NotificationClient notificationClient;

    @InjectMocks CareerServiceImpl careerService;

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID OTHER_USER_ID = UUID.randomUUID();

    private CareerPath careerPath;
    private Roadmap roadmap;
    private Milestone milestone;

    @BeforeEach
    void setUp() {
        careerPath = new CareerPath();
        careerPath.setName("Software Engineer");
        careerPath.setDescription("Build software");

        roadmap = new Roadmap();
        roadmap.setUserId(USER_ID);
        roadmap.setCareerPath(careerPath);
        roadmap.setAcademicLevel("Level 200");

        milestone = new Milestone();
        milestone.setRoadmap(roadmap);
        milestone.setSemester(1);
        milestone.setTitle("Learn Java");
        milestone.setDescription("Core Java");
        milestone.setMilestoneType(MilestoneType.SKILL);
        milestone.setDisplayOrder(1);
    }

    // --- generateRoadmap ---

    @Test
    void generateRoadmap_success_persistsMilestonesAndReturns() {
        when(careerPathRepository.findByName("Software Engineer")).thenReturn(Optional.of(careerPath));
        when(roadmapRepository.findByUserIdAndCareerPath(USER_ID, careerPath)).thenReturn(Optional.empty());
        when(claudeService.generateRoadmap(any(), any(), any(), any())).thenReturn(List.of(
                new MilestoneTemplate(1, "Learn Java", "Core Java", MilestoneType.SKILL, 1)));
        when(roadmapRepository.save(any())).thenReturn(roadmap);
        when(milestoneRepository.saveAll(any())).thenReturn(List.of(milestone));

        GenerateRoadmapRequest req = new GenerateRoadmapRequest("Software Engineer", "Level 200", List.of("Python"), "STUDENT");
        RoadmapResponse response = careerService.generateRoadmap(req, USER_ID);

        assertThat(response.careerPath()).isEqualTo("Software Engineer");
        assertThat(response.progressPercent()).isZero();
        assertThat(response.milestones()).hasSize(1);
        verify(roadmapRepository).save(any());
        verify(milestoneRepository).saveAll(any());
    }

    @Test
    void generateRoadmap_alumni_success_persistsRoleAndMilestones() {
        when(careerPathRepository.findByName("Software Engineer")).thenReturn(Optional.of(careerPath));
        when(roadmapRepository.findByUserIdAndCareerPath(USER_ID, careerPath)).thenReturn(Optional.empty());
        when(claudeService.generateRoadmap(any(), any(), any(), eq("ALUMNI"))).thenReturn(List.of(
                new MilestoneTemplate(1, "Build a portfolio project", "Showcase on GitHub", MilestoneType.PROJECT, 1)));
        when(roadmapRepository.save(any())).thenReturn(roadmap);
        when(milestoneRepository.saveAll(any())).thenReturn(List.of(milestone));

        GenerateRoadmapRequest req = new GenerateRoadmapRequest(
                "Software Engineer", "Early Career", List.of("Python"), "ALUMNI");
        RoadmapResponse response = careerService.generateRoadmap(req, USER_ID);

        assertThat(response.careerPath()).isEqualTo("Software Engineer");
        verify(roadmapRepository).save(argThat(r -> "ALUMNI".equals(r.getRole()) && "Early Career".equals(r.getAcademicLevel())));
        verify(milestoneRepository).saveAll(any());
    }

    @Test
    void generateRoadmap_replacesExistingRoadmap() {
        when(careerPathRepository.findByName("Software Engineer")).thenReturn(Optional.of(careerPath));
        when(roadmapRepository.findByUserIdAndCareerPath(USER_ID, careerPath)).thenReturn(Optional.of(roadmap));
        when(claudeService.generateRoadmap(any(), any(), any(), any())).thenReturn(List.of(
                new MilestoneTemplate(1, "Learn Java", "Core Java", MilestoneType.SKILL, 1)));
        when(roadmapRepository.save(any())).thenReturn(roadmap);
        when(milestoneRepository.saveAll(any())).thenReturn(List.of(milestone));

        careerService.generateRoadmap(
                new GenerateRoadmapRequest("Software Engineer", "Level 200", List.of(), "STUDENT"), USER_ID);

        verify(roadmapRepository).delete(roadmap);
    }

    @Test
    void generateRoadmap_unknownPath_throwsNotFoundException() {
        when(careerPathRepository.findByName("Unknown")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> careerService.generateRoadmap(
                new GenerateRoadmapRequest("Unknown", "Level 100", List.of(), "STUDENT"), USER_ID))
                .isInstanceOf(CareerPathNotFoundException.class);
    }

    @Test
    void generateRoadmap_claudeFails_throwsAiServiceException() {
        when(careerPathRepository.findByName("Software Engineer")).thenReturn(Optional.of(careerPath));
        when(roadmapRepository.findByUserIdAndCareerPath(any(), any())).thenReturn(Optional.empty());
        when(claudeService.generateRoadmap(any(), any(), any(), any()))
                .thenThrow(new AiServiceException("AI service unavailable"));

        assertThatThrownBy(() -> careerService.generateRoadmap(
                new GenerateRoadmapRequest("Software Engineer", "Level 100", List.of(), "STUDENT"), USER_ID))
                .isInstanceOf(AiServiceException.class);
    }

    // --- getRoadmap ---

    @Test
    void getRoadmap_calculatesProgress() {
        when(roadmapRepository.findTopByUserIdOrderByCreatedAtDesc(USER_ID)).thenReturn(Optional.of(roadmap));
        when(milestoneRepository.findByRoadmapId(any())).thenReturn(List.of(milestone));

        MilestoneCompletion completion = new MilestoneCompletion();
        completion.setMilestone(milestone);
        completion.setUserId(USER_ID);
        when(completionRepository.findByUserIdAndMilestoneIdIn(eq(USER_ID), any()))
                .thenReturn(List.of(completion));

        RoadmapResponse response = careerService.getRoadmap(USER_ID, USER_ID);

        assertThat(response.progressPercent()).isEqualTo(100);
        assertThat(response.milestones()).hasSize(1);
        assertThat(response.milestones().get(0).completed()).isTrue();
    }

    @Test
    void getRoadmap_wrongUser_throwsAccessDeniedException() {
        assertThatThrownBy(() -> careerService.getRoadmap(USER_ID, OTHER_USER_ID))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void getRoadmap_noRoadmap_throwsRoadmapNotFoundException() {
        when(roadmapRepository.findTopByUserIdOrderByCreatedAtDesc(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> careerService.getRoadmap(USER_ID, USER_ID))
                .isInstanceOf(com.skillbridge.career.exception.RoadmapNotFoundException.class);
    }

    // --- completeMilestone ---

    @Test
    void completeMilestone_updatesProgress() {
        when(milestoneRepository.findById(any())).thenReturn(Optional.of(milestone));
        when(completionRepository.save(any())).thenReturn(new MilestoneCompletion());
        when(milestoneRepository.findByRoadmapId(any())).thenReturn(List.of(milestone));
        when(completionRepository.countByUserIdAndMilestoneIdIn(eq(USER_ID), any())).thenReturn(1L);
        when(roadmapRepository.save(any())).thenReturn(roadmap);

        CompletionResponse response = careerService.completeMilestone(
                milestone.getId(), USER_ID, new CompleteMilestoneRequest("Done"));

        assertThat(response.progressPercent()).isEqualTo(100);
        assertThat(response.milestone().completed()).isTrue();
    }

    @Test
    void completeMilestone_notFound_throwsMilestoneNotFoundException() {
        when(milestoneRepository.findById(any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> careerService.completeMilestone(UUID.randomUUID(), USER_ID, null))
                .isInstanceOf(MilestoneNotFoundException.class);
    }

    @Test
    void completeMilestone_wrongUser_throwsAccessDeniedException() {
        when(milestoneRepository.findById(any())).thenReturn(Optional.of(milestone));

        assertThatThrownBy(() -> careerService.completeMilestone(
                milestone.getId(), OTHER_USER_ID, null))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void completeMilestone_notifiesStudent() {
        when(milestoneRepository.findById(any())).thenReturn(Optional.of(milestone));
        when(completionRepository.save(any())).thenReturn(new MilestoneCompletion());
        when(milestoneRepository.findByRoadmapId(any())).thenReturn(List.of(milestone));
        when(completionRepository.countByUserIdAndMilestoneIdIn(eq(USER_ID), any())).thenReturn(1L);
        when(roadmapRepository.save(any())).thenReturn(roadmap);

        careerService.completeMilestone(milestone.getId(), USER_ID, new CompleteMilestoneRequest("Done"));

        verify(notificationClient).notify(
                eq(USER_ID),
                eq("ROADMAP_MILESTONE"),
                eq("Milestone complete 🎉"),
                contains("Learn Java"));
    }

    @Test
    void completeMilestone_notificationFailureStillSucceeds() {
        when(milestoneRepository.findById(any())).thenReturn(Optional.of(milestone));
        when(completionRepository.save(any())).thenReturn(new MilestoneCompletion());
        when(milestoneRepository.findByRoadmapId(any())).thenReturn(List.of(milestone));
        when(completionRepository.countByUserIdAndMilestoneIdIn(eq(USER_ID), any())).thenReturn(1L);
        when(roadmapRepository.save(any())).thenReturn(roadmap);
        doThrow(new RuntimeException("down")).when(notificationClient).notify(any(), any(), any(), any());

        CompletionResponse response = careerService.completeMilestone(
                milestone.getId(), USER_ID, new CompleteMilestoneRequest("Done"));

        assertThat(response.progressPercent()).isEqualTo(100);
    }

    // --- getCareerPaths ---

    @Test
    void getCareerPaths_returnsSortedList() {
        when(careerPathRepository.findAllByOrderByNameAsc()).thenReturn(List.of(careerPath));

        var paths = careerService.getCareerPaths();

        assertThat(paths).hasSize(1);
        assertThat(paths.get(0).name()).isEqualTo("Software Engineer");
    }
}
