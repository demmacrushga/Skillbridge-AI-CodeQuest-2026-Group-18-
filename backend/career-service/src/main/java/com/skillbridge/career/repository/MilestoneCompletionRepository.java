package com.skillbridge.career.repository;

import com.skillbridge.career.entity.MilestoneCompletion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Set;
import java.util.UUID;

public interface MilestoneCompletionRepository extends JpaRepository<MilestoneCompletion, UUID> {
    List<MilestoneCompletion> findByUserIdAndMilestoneIdIn(UUID userId, List<UUID> milestoneIds);
    long countByUserIdAndMilestoneIdIn(UUID userId, List<UUID> milestoneIds);
}
