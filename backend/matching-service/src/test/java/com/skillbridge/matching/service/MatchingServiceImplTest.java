package com.skillbridge.matching.service;

import com.skillbridge.matching.dto.request.PostOpportunityRequest;
import com.skillbridge.matching.dto.request.SkillRequirementRequest;
import com.skillbridge.matching.dto.request.UpdateSkillsRequest;
import com.skillbridge.matching.dto.response.ApplicantResponse;
import com.skillbridge.matching.dto.response.ApplicationResponse;
import com.skillbridge.matching.dto.response.ApplicationWithOpportunityResponse;
import com.skillbridge.matching.dto.response.MatchListResponse;
import com.skillbridge.matching.dto.response.OpportunityResponse;
import com.skillbridge.matching.dto.response.SkillsResponse;
import com.skillbridge.matching.entity.Application;
import com.skillbridge.matching.entity.Opportunity;
import com.skillbridge.matching.entity.StudentSkill;
import com.skillbridge.matching.enums.OpportunityType;
import com.skillbridge.matching.exception.DuplicateApplicationException;
import com.skillbridge.matching.exception.OpportunityNotFoundException;
import com.skillbridge.matching.repository.ApplicationRepository;
import com.skillbridge.matching.repository.OpportunityRepository;
import com.skillbridge.matching.repository.StudentSkillRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MatchingServiceImplTest {

    @Mock OpportunityRepository opportunityRepository;
    @Mock ApplicationRepository applicationRepository;
    @Mock StudentSkillRepository studentSkillRepository;
    @Mock MatchScoringService matchScoringService;

    @InjectMocks MatchingServiceImpl matchingService;

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID RECRUITER_ID = UUID.randomUUID();
    private static final UUID OPP_ID = UUID.randomUUID();

    private PostOpportunityRequest validRequest;

    @BeforeEach
    void setUp() {
        validRequest = new PostOpportunityRequest(
                "Software Engineering Intern", "Hubtel", "Backend team",
                "Accra", OpportunityType.INTERNSHIP, LocalDate.now().plusDays(30),
                null,
                List.of(new SkillRequirementRequest("Java", true),
                        new SkillRequirementRequest("PostgreSQL", false)));
    }

    // ── US1: postOpportunity ───────────────────────────────────────────

    @Test
    void postOpportunity_persistsSkillsAndDefaultsActive() {
        when(opportunityRepository.save(any(Opportunity.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        OpportunityResponse response = matchingService.postOpportunity(validRequest, RECRUITER_ID);

        assertThat(response.active()).isTrue();
        assertThat(response.title()).isEqualTo("Software Engineering Intern");
        assertThat(response.requiredSkills()).hasSize(2);
        assertThat(response.applicantCount()).isZero();
        verify(opportunityRepository).save(any(Opportunity.class));
    }

    @Test
    void postOpportunity_persistsExternalUrl() {
        PostOpportunityRequest external = new PostOpportunityRequest(
                "SE Intern", "Hubtel", "Desc", null, OpportunityType.INTERNSHIP, null,
                "https://hubtel.com/careers/x",
                List.of(new SkillRequirementRequest("Java", true)));
        when(opportunityRepository.save(any(Opportunity.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        OpportunityResponse response = matchingService.postOpportunity(external, RECRUITER_ID);

        assertThat(response.externalUrl()).isEqualTo("https://hubtel.com/careers/x");
    }

    // ── US2: getMatches ────────────────────────────────────────────────

    @Test
    void getMatches_scoresRanksAndFlagsApplied() {
        Opportunity older = new Opportunity();
        older.setId(UUID.randomUUID());
        older.setCreatedAt(Instant.parse("2026-07-01T10:00:00Z"));
        Opportunity newer = new Opportunity();
        newer.setId(UUID.randomUUID());
        newer.setCreatedAt(Instant.parse("2026-07-10T10:00:00Z"));

        when(studentSkillRepository.findByStudentId(USER_ID)).thenReturn(List.of());
        when(opportunityRepository.findEligibleForMatching()).thenReturn(List.of(older, newer));
        when(matchScoringService.score(any(), any()))
                .thenAnswer(inv -> inv.getArgument(0) == newer
                        ? new BigDecimal("90.00") : new BigDecimal("50.00"));
        when(applicationRepository.existsByStudentIdAndOpportunityId(USER_ID, older.getId()))
                .thenReturn(true);
        when(applicationRepository.existsByStudentIdAndOpportunityId(USER_ID, newer.getId()))
                .thenReturn(false);

        MatchListResponse result = matchingService.getMatches(USER_ID);

        assertThat(result.matches()).hasSize(2);
        assertThat(result.matches().get(0).matchScore()).isEqualByComparingTo("90.00");
        assertThat(result.matches().get(0).rank()).isEqualTo(1);
        assertThat(result.matches().get(0).applied()).isFalse();
        assertThat(result.matches().get(1).rank()).isEqualTo(2);
        assertThat(result.matches().get(1).applied()).isTrue();
    }

    @Test
    void getMatches_emptyBoard_returnsEmptyList() {
        when(studentSkillRepository.findByStudentId(USER_ID)).thenReturn(List.of());
        when(opportunityRepository.findEligibleForMatching()).thenReturn(List.of());

        assertThat(matchingService.getMatches(USER_ID).matches()).isEmpty();
    }

    // ── US3: apply ─────────────────────────────────────────────────────

    @Test
    void apply_happyPath_returnsExternalUrl() {
        Opportunity o = new Opportunity();
        o.setId(OPP_ID);
        o.setActive(true);
        o.setExternalUrl("https://example.com/job");
        when(opportunityRepository.findById(OPP_ID)).thenReturn(Optional.of(o));
        when(applicationRepository.existsByStudentIdAndOpportunityId(USER_ID, OPP_ID)).thenReturn(false);
        when(applicationRepository.saveAndFlush(any(Application.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        ApplicationResponse response = matchingService.apply(OPP_ID, USER_ID);

        assertThat(response.opportunityId()).isEqualTo(OPP_ID);
        assertThat(response.externalUrl()).isEqualTo("https://example.com/job");
    }

    @Test
    void apply_inactiveOpportunity_throws404() {
        Opportunity o = new Opportunity();
        o.setActive(false);
        when(opportunityRepository.findById(OPP_ID)).thenReturn(Optional.of(o));

        assertThatThrownBy(() -> matchingService.apply(OPP_ID, USER_ID))
                .isInstanceOf(OpportunityNotFoundException.class);
    }

    @Test
    void apply_expiredOpportunity_throws404() {
        Opportunity o = new Opportunity();
        o.setActive(true);
        o.setDeadline(LocalDate.now().minusDays(1));
        when(opportunityRepository.findById(OPP_ID)).thenReturn(Optional.of(o));

        assertThatThrownBy(() -> matchingService.apply(OPP_ID, USER_ID))
                .isInstanceOf(OpportunityNotFoundException.class);
    }

    @Test
    void apply_duplicate_throws409() {
        Opportunity o = new Opportunity();
        o.setActive(true);
        when(opportunityRepository.findById(OPP_ID)).thenReturn(Optional.of(o));
        when(applicationRepository.existsByStudentIdAndOpportunityId(USER_ID, OPP_ID)).thenReturn(true);

        assertThatThrownBy(() -> matchingService.apply(OPP_ID, USER_ID))
                .isInstanceOf(DuplicateApplicationException.class);
    }

    @Test
    void apply_uniqueConstraintRace_throws409() {
        Opportunity o = new Opportunity();
        o.setActive(true);
        when(opportunityRepository.findById(OPP_ID)).thenReturn(Optional.of(o));
        when(applicationRepository.existsByStudentIdAndOpportunityId(USER_ID, OPP_ID)).thenReturn(false);
        when(applicationRepository.saveAndFlush(any(Application.class)))
                .thenThrow(new DataIntegrityViolationException("uq violation"));

        assertThatThrownBy(() -> matchingService.apply(OPP_ID, USER_ID))
                .isInstanceOf(DuplicateApplicationException.class);
    }

    // ── US4: getApplications ───────────────────────────────────────────

    @Test
    void getApplications_returnsNewestFirst() {
        Opportunity o = new Opportunity();
        o.setId(OPP_ID);
        Application a = new Application();
        a.setId(UUID.randomUUID());
        a.setStudentId(USER_ID);
        a.setOpportunity(o);
        when(applicationRepository.findByStudentIdOrderByAppliedAtDesc(USER_ID))
                .thenReturn(List.of(a));

        List<ApplicationWithOpportunityResponse> result = matchingService.getApplications(USER_ID);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).opportunity().id()).isEqualTo(OPP_ID);
    }

    // ── US5: skill profile ─────────────────────────────────────────────

    @Test
    void getSkills_returnsStoredList() {
        when(studentSkillRepository.findByStudentId(USER_ID))
                .thenReturn(List.of(new StudentSkill(USER_ID, "Java")));

        SkillsResponse response = matchingService.getSkills(USER_ID);

        assertThat(response.skills()).containsExactly("Java");
    }

    @Test
    void updateSkills_replacesAndDedupesCaseInsensitively() {
        when(studentSkillRepository.saveAll(anyList()))
                .thenAnswer(inv -> inv.getArgument(0));

        SkillsResponse response = matchingService.updateSkills(
                new UpdateSkillsRequest(List.of("  Java ", "java", "Spring   Boot", "Docker")), USER_ID);

        verify(studentSkillRepository).deleteByStudentId(USER_ID);
        assertThat(response.skills()).containsExactly("Java", "Spring Boot", "Docker");
    }

    @Test
    void updateSkills_emptyListClearsProfile() {
        SkillsResponse response = matchingService.updateSkills(
                new UpdateSkillsRequest(List.of()), USER_ID);

        verify(studentSkillRepository).deleteByStudentId(USER_ID);
        assertThat(response.skills()).isEmpty();
    }

    // ── US6: recruiter management ──────────────────────────────────────

    @Test
    void getMyPostings_includesApplicantCounts() {
        Opportunity o = new Opportunity();
        o.setId(OPP_ID);
        when(opportunityRepository.findByPostedByOrderByCreatedAtDesc(RECRUITER_ID))
                .thenReturn(List.of(o));
        when(applicationRepository.countByOpportunityId(OPP_ID)).thenReturn(3L);

        List<OpportunityResponse> result = matchingService.getMyPostings(RECRUITER_ID);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).applicantCount()).isEqualTo(3L);
    }

    @Test
    void deactivate_marksInactive_andIsIdempotent() {
        Opportunity o = new Opportunity();
        o.setId(OPP_ID);
        o.setPostedBy(RECRUITER_ID);
        o.setActive(true);
        when(opportunityRepository.findById(OPP_ID)).thenReturn(Optional.of(o));
        when(applicationRepository.countByOpportunityId(OPP_ID)).thenReturn(0L);

        OpportunityResponse first = matchingService.deactivate(OPP_ID, RECRUITER_ID);
        assertThat(first.active()).isFalse();
        verify(opportunityRepository).save(o);

        // Second call: already inactive → no additional save, still 200
        OpportunityResponse second = matchingService.deactivate(OPP_ID, RECRUITER_ID);
        assertThat(second.active()).isFalse();
        verify(opportunityRepository, times(1)).save(o);
    }

    @Test
    void deactivate_wrongOwner_throws404() {
        Opportunity o = new Opportunity();
        o.setPostedBy(UUID.randomUUID());
        when(opportunityRepository.findById(OPP_ID)).thenReturn(Optional.of(o));

        assertThatThrownBy(() -> matchingService.deactivate(OPP_ID, RECRUITER_ID))
                .isInstanceOf(OpportunityNotFoundException.class);
    }

    @Test
    void getApplicants_wrongOwner_throws404() {
        Opportunity o = new Opportunity();
        o.setPostedBy(UUID.randomUUID());
        when(opportunityRepository.findById(OPP_ID)).thenReturn(Optional.of(o));

        assertThatThrownBy(() -> matchingService.getApplicants(OPP_ID, RECRUITER_ID))
                .isInstanceOf(OpportunityNotFoundException.class);
    }

    @Test
    void getApplicants_returnsNewestFirst() {
        Opportunity o = new Opportunity();
        o.setId(OPP_ID);
        o.setPostedBy(RECRUITER_ID);
        when(opportunityRepository.findById(OPP_ID)).thenReturn(Optional.of(o));
        Application a = new Application();
        a.setStudentId(USER_ID);
        when(applicationRepository.findByOpportunityIdOrderByAppliedAtDesc(OPP_ID))
                .thenReturn(List.of(a));

        List<ApplicantResponse> result = matchingService.getApplicants(OPP_ID, RECRUITER_ID);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).studentId()).isEqualTo(USER_ID);
    }
}
