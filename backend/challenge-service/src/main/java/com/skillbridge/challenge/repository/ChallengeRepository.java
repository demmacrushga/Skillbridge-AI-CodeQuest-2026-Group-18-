package com.skillbridge.challenge.repository;

import com.skillbridge.challenge.entity.Challenge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ChallengeRepository extends JpaRepository<Challenge, UUID> {

    @Query("SELECT c FROM Challenge c WHERE c.active = true AND c.deadline > CURRENT_TIMESTAMP ORDER BY c.createdAt DESC")
    List<Challenge> findActiveChallenges();

    List<Challenge> findByPostedByOrderByCreatedAtDesc(UUID postedBy);
}
