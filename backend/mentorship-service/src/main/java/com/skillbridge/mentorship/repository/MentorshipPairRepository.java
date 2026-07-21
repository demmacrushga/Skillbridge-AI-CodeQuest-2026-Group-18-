package com.skillbridge.mentorship.repository;

import com.skillbridge.mentorship.entity.MentorshipPair;
import com.skillbridge.mentorship.entity.PairStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MentorshipPairRepository extends JpaRepository<MentorshipPair, UUID> {

    @Query("SELECT p FROM MentorshipPair p WHERE p.studentId = :userId OR p.alumniId = :userId ORDER BY p.startedAt DESC")
    List<MentorshipPair> findAllByParticipant(@Param("userId") UUID userId);

    @Query("SELECT p FROM MentorshipPair p WHERE p.id = :id AND (p.studentId = :userId OR p.alumniId = :userId)")
    Optional<MentorshipPair> findByIdAndParticipant(@Param("id") UUID id, @Param("userId") UUID userId);

    boolean existsByStudentIdAndAlumniIdAndStatus(UUID studentId, UUID alumniId, PairStatus status);
}
