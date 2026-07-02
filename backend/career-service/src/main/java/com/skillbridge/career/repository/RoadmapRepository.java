package com.skillbridge.career.repository;

import com.skillbridge.career.entity.CareerPath;
import com.skillbridge.career.entity.Roadmap;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RoadmapRepository extends JpaRepository<Roadmap, UUID> {
    Optional<Roadmap> findTopByUserIdOrderByCreatedAtDesc(UUID userId);
    Optional<Roadmap> findByUserIdAndCareerPath(UUID userId, CareerPath careerPath);
}
