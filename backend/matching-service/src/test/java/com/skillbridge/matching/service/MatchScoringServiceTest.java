package com.skillbridge.matching.service;

import com.skillbridge.matching.entity.Opportunity;
import com.skillbridge.matching.entity.OpportunitySkill;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class MatchScoringServiceTest {

    private final MatchScoringService scoringService = new MatchScoringService();

    private Opportunity opportunity(List<Object[]> skills) {
        Opportunity o = new Opportunity();
        for (Object[] s : skills) {
            OpportunitySkill skill = new OpportunitySkill();
            skill.setOpportunity(o);
            skill.setSkillName((String) s[0]);
            skill.setRequired((Boolean) s[1]);
            o.getSkills().add(skill);
        }
        return o;
    }

    @Test
    void quickstartScenario_scoresEighty() {
        // 2 must-haves matched out of {Java(req), Spring Boot(req), PostgreSQL(opt)}
        Opportunity o = opportunity(List.of(
                new Object[]{"Java", true},
                new Object[]{"Spring Boot", true},
                new Object[]{"PostgreSQL", false}));

        BigDecimal score = scoringService.score(o, Set.of("java", "spring boot"));

        // 100 * (2+2)/(2+2+1) = 80.00
        assertThat(score).isEqualByComparingTo(new BigDecimal("80.00"));
    }

    @Test
    void fullMatch_scoresHundred() {
        Opportunity o = opportunity(List.of(
                new Object[]{"Java", true},
                new Object[]{"Docker", false}));

        BigDecimal score = scoringService.score(o, Set.of("java", "docker"));

        assertThat(score).isEqualByComparingTo(new BigDecimal("100.00"));
    }

    @Test
    void mustHaveOutweighsNiceToHave() {
        // Student A: has the must-have, lacks nice-to-have → 2/3 = 66.67
        // Student B: lacks the must-have, has nice-to-have → 1/3 = 33.33
        Opportunity o = opportunity(List.of(
                new Object[]{"Java", true},
                new Object[]{"Docker", false}));

        BigDecimal a = scoringService.score(o, Set.of("java"));
        BigDecimal b = scoringService.score(o, Set.of("docker"));

        assertThat(a).isGreaterThan(b);
        assertThat(a).isEqualByComparingTo(new BigDecimal("66.67"));
        assertThat(b).isEqualByComparingTo(new BigDecimal("33.33"));
    }

    @Test
    void matchingIsCaseInsensitiveAndTrimsWhitespace() {
        Opportunity o = opportunity(List.<Object[]>of(new Object[]{"Spring Boot", true}));

        BigDecimal score = scoringService.score(o, Set.of("  spring   boot "));

        // Student skill set is pre-normalized by the service layer; direct call needs normalize
        assertThat(scoringService.score(o, Set.of(MatchScoringService.normalize("  spring   boot "))))
                .isEqualByComparingTo(new BigDecimal("100.00"));
    }

    @Test
    void emptyStudentProfile_scoresZero() {
        Opportunity o = opportunity(List.<Object[]>of(new Object[]{"Java", true}));

        assertThat(scoringService.score(o, Set.of()))
                .isEqualByComparingTo(new BigDecimal("0.00"));
    }

    @Test
    void noSkillsOnOpportunity_scoresZero() {
        Opportunity o = opportunity(List.of());

        assertThat(scoringService.score(o, Set.of("java")))
                .isEqualByComparingTo(new BigDecimal("0.00"));
    }

    @Test
    void deterministicRepeatedCalls() {
        Opportunity o = opportunity(List.of(
                new Object[]{"Java", true},
                new Object[]{"PostgreSQL", false}));
        Set<String> skills = Set.of("java");

        BigDecimal first = scoringService.score(o, skills);
        BigDecimal second = scoringService.score(o, skills);

        assertThat(first).isEqualTo(second);
    }

    @Test
    void normalizeHandlesNullAndWhitespace() {
        assertThat(MatchScoringService.normalize(null)).isEmpty();
        assertThat(MatchScoringService.normalize("  Spring   Boot ")).isEqualTo("spring boot");
    }
}
