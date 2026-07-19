package com.skillbridge.matching.repository;

import com.skillbridge.matching.entity.Opportunity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OpportunityRepository extends JpaRepository<Opportunity, UUID> {

    @Query("SELECT o FROM Opportunity o LEFT JOIN FETCH o.skills " +
            "WHERE o.active = true AND (o.deadline IS NULL OR o.deadline >= CURRENT_DATE)")
    List<Opportunity> findEligibleForMatching();

    @Query("SELECT o FROM Opportunity o LEFT JOIN FETCH o.skills WHERE o.id = :id")
    Optional<Opportunity> findByIdWithSkills(UUID id);

    List<Opportunity> findByPostedByOrderByCreatedAtDesc(UUID postedBy);
}
