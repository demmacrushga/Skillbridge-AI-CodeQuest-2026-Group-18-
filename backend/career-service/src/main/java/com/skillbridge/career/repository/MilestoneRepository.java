package com.skillbridge.career.repository;

import com.skillbridge.career.entity.Milestone;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MilestoneRepository extends JpaRepository<Milestone, UUID> {
    List<Milestone> findByRoadmapId(UUID roadmapId);
    long countByRoadmapId(UUID roadmapId);
}
