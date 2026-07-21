package com.skillbridge.mentorship.service;

import com.skillbridge.mentorship.dto.response.AlumniSearchEntry;
import com.skillbridge.mentorship.entity.AlumniProfile;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Deterministic alumni discovery ranking (research Decision 3):
 * available profiles only, optional case-insensitive industry filter,
 * ordered by matching-tag count DESC, then updatedAt DESC.
 */
@Service
public class AlumniSearchService {

    public static String normalize(String s) {
        if (s == null) {
            return "";
        }
        return s.trim().replaceAll("\\s+", " ").toLowerCase(java.util.Locale.ROOT);
    }

    public List<AlumniSearchEntry> search(List<AlumniProfile> availableProfiles,
                                          List<String> interests,
                                          String industry) {
        Set<String> wanted = interests == null ? Set.of()
                : interests.stream()
                        .map(AlumniSearchService::normalize)
                        .filter(s -> !s.isEmpty())
                        .collect(Collectors.toSet());

        String wantedIndustry = normalize(industry);

        return availableProfiles.stream()
                .filter(p -> wantedIndustry.isEmpty() || wantedIndustry.equals(normalize(p.getIndustry())))
                .map(p -> toEntry(p, matchingTags(p, wanted)))
                .sorted(Comparator.comparingInt(AlumniSearchEntry::matchingTags).reversed()
                        .thenComparing(AlumniSearchEntry::updatedAt, Comparator.reverseOrder()))
                .toList();
    }

    private int matchingTags(AlumniProfile profile, Set<String> wanted) {
        if (wanted.isEmpty()) {
            return 0;
        }
        return (int) profile.getCareerInterests().stream()
                .map(AlumniSearchService::normalize)
                .filter(wanted::contains)
                .count();
    }

    private AlumniSearchEntry toEntry(AlumniProfile p, int matchingTags) {
        return new AlumniSearchEntry(
                p.getUserId(), p.getCurrentRole(), p.getCompany(), p.getIndustry(),
                p.getCareerInterests(), p.getBio(), matchingTags, p.getUpdatedAt());
    }
}
