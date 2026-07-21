package com.skillbridge.matching.service;

import com.skillbridge.matching.dto.request.PostOpportunityRequest;
import com.skillbridge.matching.dto.request.SkillRequirementRequest;
import com.skillbridge.matching.dto.request.UpdateSkillsRequest;
import com.skillbridge.matching.dto.response.ApplicantResponse;
import com.skillbridge.matching.dto.response.ApplicationResponse;
import com.skillbridge.matching.dto.response.ApplicationWithOpportunityResponse;
import com.skillbridge.matching.dto.response.MatchListResponse;
import com.skillbridge.matching.dto.response.MatchResponse;
import com.skillbridge.matching.dto.response.OpportunityResponse;
import com.skillbridge.matching.dto.response.SkillsResponse;
import com.skillbridge.matching.entity.Application;
import com.skillbridge.matching.entity.Opportunity;
import com.skillbridge.matching.entity.OpportunitySkill;
import com.skillbridge.matching.entity.StudentSkill;
import com.skillbridge.matching.exception.DuplicateApplicationException;
import com.skillbridge.matching.exception.OpportunityNotFoundException;
import com.skillbridge.matching.client.NotificationClient;
import com.skillbridge.matching.repository.ApplicationRepository;
import com.skillbridge.matching.repository.OpportunityRepository;
import com.skillbridge.matching.repository.StudentSkillRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class MatchingServiceImpl implements MatchingService {

    private static final BigDecimal MATCH_NOTIFY_THRESHOLD = new BigDecimal("50.00");
    private static final int MATCH_NOTIFY_CAP = 100;

    private final OpportunityRepository opportunityRepository;
    private final ApplicationRepository applicationRepository;
    private final StudentSkillRepository studentSkillRepository;
    private final MatchScoringService matchScoringService;
    private final NotificationClient notificationClient;

    @Override
    @Transactional
    public OpportunityResponse postOpportunity(PostOpportunityRequest request, UUID userId) {
        Opportunity opportunity = new Opportunity();
        opportunity.setPostedBy(userId);
        opportunity.setTitle(request.title().trim());
        opportunity.setCompanyName(request.companyName().trim());
        opportunity.setDescription(request.description().trim());
        opportunity.setLocation(request.location());
        opportunity.setOpportunityType(request.opportunityType());
        opportunity.setDeadline(request.deadline());
        opportunity.setExternalUrl(request.externalUrl());
        opportunity.setActive(true);

        for (SkillRequirementRequest skillReq : request.requiredSkills()) {
            OpportunitySkill skill = new OpportunitySkill();
            skill.setOpportunity(opportunity);
            skill.setSkillName(skillReq.skillName().trim().replaceAll("\\s+", " "));
            skill.setRequired(skillReq.required());
            opportunity.getSkills().add(skill);
        }

        Opportunity saved = opportunityRepository.save(opportunity);
        log.info("Opportunity posted id={} type={} external={}", saved.getId(),
                saved.getOpportunityType(), saved.getExternalUrl() != null);

        notifyMatchingStudents(saved);

        return toOpportunityResponse(saved, 0L);
    }

    private void notifyMatchingStudents(Opportunity opportunity) {
        try {
            List<UUID> distinctStudentIds = studentSkillRepository.findDistinctStudentIds();
            if (distinctStudentIds.isEmpty()) {
                return;
            }

            record ScoredStudent(UUID studentId, BigDecimal score) {
            }

            List<ScoredStudent> qualifying = distinctStudentIds.stream()
                    .map(studentId -> {
                        Set<String> skills = studentSkillRepository.findByStudentId(studentId).stream()
                                .map(s -> MatchScoringService.normalize(s.getSkillName()))
                                .collect(Collectors.toSet());
                        return new ScoredStudent(studentId, matchScoringService.score(opportunity, skills));
                    })
                    .filter(ss -> ss.score().compareTo(MATCH_NOTIFY_THRESHOLD) >= 0)
                    .sorted(Comparator.comparing(ScoredStudent::score).reversed())
                    .limit(MATCH_NOTIFY_CAP)
                    .toList();

            int skipped = distinctStudentIds.size() - qualifying.size();
            if (skipped > 0) {
                log.info("Opportunity match notification skipped {} students below threshold or over cap", skipped);
            }

            for (ScoredStudent ss : qualifying) {
                notificationClient.notify(
                        ss.studentId(),
                        "OPPORTUNITY_MATCH",
                        "New opportunity matches your skills",
                        String.format("%s at %s — %s%% match.",
                                opportunity.getTitle(), opportunity.getCompanyName(), ss.score()));
            }
        } catch (Exception e) {
            log.warn("Failed to send opportunity match notifications: {}", e.getMessage());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public MatchListResponse getMatches(UUID userId) {
        Set<String> studentSkills = studentSkillRepository.findByStudentId(userId).stream()
                .map(s -> MatchScoringService.normalize(s.getSkillName()))
                .collect(Collectors.toSet());

        List<Opportunity> eligible = opportunityRepository.findEligibleForMatching();

        record ScoredMatch(Opportunity opportunity, java.math.BigDecimal score) {}

        List<ScoredMatch> scored = eligible.stream()
                .map(o -> new ScoredMatch(o, matchScoringService.score(o, studentSkills)))
                .sorted(Comparator.comparing(ScoredMatch::score).reversed()
                        .thenComparing((ScoredMatch sm) -> sm.opportunity().getCreatedAt(),
                                Comparator.reverseOrder()))
                .toList();

        List<MatchResponse> matches = new ArrayList<>();
        int rank = 1;
        for (ScoredMatch sm : scored) {
            boolean applied = applicationRepository.existsByStudentIdAndOpportunityId(
                    userId, sm.opportunity().getId());
            matches.add(new MatchResponse(
                    toOpportunityResponse(sm.opportunity(), null), sm.score(), rank++, applied));
        }

        return new MatchListResponse(matches);
    }

    @Override
    @Transactional
    public ApplicationResponse apply(UUID opportunityId, UUID userId) {
        Opportunity opportunity = opportunityRepository.findById(opportunityId)
                .filter(o -> o.isActive()
                        && (o.getDeadline() == null || !o.getDeadline().isBefore(LocalDate.now())))
                .orElseThrow(() -> new OpportunityNotFoundException("Opportunity not found"));

        if (applicationRepository.existsByStudentIdAndOpportunityId(userId, opportunityId)) {
            throw new DuplicateApplicationException("Already applied to this opportunity");
        }

        Application application = new Application();
        application.setStudentId(userId);
        application.setOpportunity(opportunity);
        try {
            Application saved = applicationRepository.saveAndFlush(application);
            log.info("Application recorded student={} opportunity={}", userId, opportunityId);
            return new ApplicationResponse(saved.getId(), opportunityId,
                    saved.getAppliedAt(), opportunity.getExternalUrl());
        } catch (DataIntegrityViolationException e) {
            // Unique-constraint race fallback (FR-006)
            throw new DuplicateApplicationException("Already applied to this opportunity");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<ApplicationWithOpportunityResponse> getApplications(UUID userId) {
        return applicationRepository.findByStudentIdOrderByAppliedAtDesc(userId).stream()
                .map(a -> new ApplicationWithOpportunityResponse(
                        a.getId(), a.getAppliedAt(),
                        toOpportunityResponse(a.getOpportunity(), null)))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public SkillsResponse getSkills(UUID userId) {
        List<String> skills = studentSkillRepository.findByStudentId(userId).stream()
                .map(StudentSkill::getSkillName)
                .toList();
        return new SkillsResponse(skills);
    }

    @Override
    @Transactional
    public SkillsResponse updateSkills(UpdateSkillsRequest request, UUID userId) {
        // Normalize: trim, collapse whitespace; dedupe case-insensitively keeping first occurrence
        Map<String, String> deduped = new LinkedHashMap<>();
        for (String raw : request.skills()) {
            String normalized = raw.trim().replaceAll("\\s+", " ");
            deduped.putIfAbsent(MatchScoringService.normalize(normalized), normalized);
        }

        studentSkillRepository.deleteByStudentId(userId);
        studentSkillRepository.flush();
        List<StudentSkill> toSave = deduped.values().stream()
                .map(name -> new StudentSkill(userId, name))
                .toList();
        studentSkillRepository.saveAll(toSave);
        log.info("Skill profile updated student={} count={}", userId, toSave.size());
        return new SkillsResponse(toSave.stream().map(StudentSkill::getSkillName).toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<OpportunityResponse> getMyPostings(UUID userId) {
        return opportunityRepository.findByPostedByOrderByCreatedAtDesc(userId).stream()
                .map(o -> toOpportunityResponse(o, applicationRepository.countByOpportunityId(o.getId())))
                .toList();
    }

    @Override
    @Transactional
    public OpportunityResponse deactivate(UUID opportunityId, UUID userId) {
        Opportunity opportunity = opportunityRepository.findById(opportunityId)
                .filter(o -> o.getPostedBy().equals(userId))
                .orElseThrow(() -> new OpportunityNotFoundException("Opportunity not found"));

        if (opportunity.isActive()) {
            opportunity.setActive(false);
            opportunityRepository.save(opportunity);
            log.info("Opportunity deactivated id={}", opportunityId);
        }
        return toOpportunityResponse(opportunity,
                applicationRepository.countByOpportunityId(opportunityId));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ApplicantResponse> getApplicants(UUID opportunityId, UUID userId) {
        opportunityRepository.findById(opportunityId)
                .filter(o -> o.getPostedBy().equals(userId))
                .orElseThrow(() -> new OpportunityNotFoundException("Opportunity not found"));

        return applicationRepository.findByOpportunityIdOrderByAppliedAtDesc(opportunityId).stream()
                .map(a -> new ApplicantResponse(a.getStudentId(), a.getAppliedAt()))
                .toList();
    }

    private OpportunityResponse toOpportunityResponse(Opportunity o, Long applicantCount) {
        List<OpportunityResponse.SkillRequirementDto> skills = o.getSkills().stream()
                .map(s -> new OpportunityResponse.SkillRequirementDto(s.getSkillName(), s.isRequired()))
                .toList();
        return new OpportunityResponse(
                o.getId(), o.getTitle(), o.getCompanyName(), o.getDescription(),
                o.getLocation(), o.getOpportunityType(), o.getDeadline(), o.getExternalUrl(),
                o.isActive(), o.getCreatedAt(), skills, applicantCount);
    }
}
