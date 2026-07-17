package com.skillbridge.mockinterview.repository;

import com.skillbridge.mockinterview.entity.InterviewSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InterviewSessionRepository extends JpaRepository<InterviewSession, UUID> {

    Optional<InterviewSession> findByIdAndUserId(UUID id, UUID userId);

    List<InterviewSession> findByUserIdOrderByCreatedAtDesc(UUID userId);
}
