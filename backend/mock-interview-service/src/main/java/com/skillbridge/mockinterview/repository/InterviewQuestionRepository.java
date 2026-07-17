package com.skillbridge.mockinterview.repository;

import com.skillbridge.mockinterview.entity.InterviewQuestion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface InterviewQuestionRepository extends JpaRepository<InterviewQuestion, UUID> {

    boolean existsBySessionIdAndUserAnswerIsNull(UUID sessionId);
}
