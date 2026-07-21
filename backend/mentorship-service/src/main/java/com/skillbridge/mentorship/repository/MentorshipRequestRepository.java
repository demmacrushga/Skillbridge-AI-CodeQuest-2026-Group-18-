package com.skillbridge.mentorship.repository;

import com.skillbridge.mentorship.entity.MentorshipRequest;
import com.skillbridge.mentorship.entity.RequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MentorshipRequestRepository extends JpaRepository<MentorshipRequest, UUID> {

    List<MentorshipRequest> findByAlumniIdAndStatusOrderByCreatedAtDesc(UUID alumniId, RequestStatus status);

    List<MentorshipRequest> findByStudentIdOrderByCreatedAtDesc(UUID studentId);

    boolean existsByStudentIdAndAlumniIdAndStatus(UUID studentId, UUID alumniId, RequestStatus status);

    Optional<MentorshipRequest> findByIdAndAlumniId(UUID id, UUID alumniId);

    Optional<MentorshipRequest> findByIdAndStudentId(UUID id, UUID studentId);
}
