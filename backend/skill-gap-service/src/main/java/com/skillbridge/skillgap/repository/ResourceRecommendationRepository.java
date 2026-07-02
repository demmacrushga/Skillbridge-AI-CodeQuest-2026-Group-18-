package com.skillbridge.skillgap.repository;

import com.skillbridge.skillgap.entity.ResourceRecommendation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ResourceRecommendationRepository extends JpaRepository<ResourceRecommendation, UUID> {
}
