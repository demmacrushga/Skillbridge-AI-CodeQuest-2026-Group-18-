package com.skillbridge.matching.service;

import com.skillbridge.matching.entity.Opportunity;
import com.skillbridge.matching.entity.OpportunitySkill;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;
import java.util.Set;

/**
 * Deterministic match score formula (research Decision 1):
 * must-have skill weight = 2.0, nice-to-have weight = 1.0.
 * score = 100 * sum(weights of matched skills) / sum(weights of all skills), rounded to 2dp.
 * Comparison is case-insensitive on trimmed skill names.
 */
@Service
public class MatchScoringService {

    private static final double REQUIRED_WEIGHT = 2.0;
    private static final double OPTIONAL_WEIGHT = 1.0;

    public BigDecimal score(Opportunity opportunity, Set<String> studentSkills) {
        double totalWeight = 0.0;
        double matchedWeight = 0.0;

        for (OpportunitySkill skill : opportunity.getSkills()) {
            double weight = skill.isRequired() ? REQUIRED_WEIGHT : OPTIONAL_WEIGHT;
            totalWeight += weight;
            if (studentSkills.contains(normalize(skill.getSkillName()))) {
                matchedWeight += weight;
            }
        }

        if (totalWeight == 0.0 || matchedWeight == 0.0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }

        return BigDecimal.valueOf(100.0 * matchedWeight / totalWeight)
                .setScale(2, RoundingMode.HALF_UP);
    }

    public static String normalize(String skillName) {
        return skillName == null
                ? ""
                : skillName.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }
}
