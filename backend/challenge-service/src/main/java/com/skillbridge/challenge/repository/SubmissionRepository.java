package com.skillbridge.challenge.repository;

import com.skillbridge.challenge.entity.Submission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SubmissionRepository extends JpaRepository<Submission, UUID> {

    boolean existsByChallengeIdAndStudentId(UUID challengeId, UUID studentId);

    List<Submission> findByChallengeIdOrderBySubmittedAtDesc(UUID challengeId);

    List<Submission> findByStudentIdOrderBySubmittedAtDesc(UUID studentId);

    List<Submission> findByChallengeIdAndScoreIsNotNull(UUID challengeId);

    long countByChallengeId(UUID challengeId);
}
