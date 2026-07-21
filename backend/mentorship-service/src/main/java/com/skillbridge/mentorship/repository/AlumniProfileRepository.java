package com.skillbridge.mentorship.repository;

import com.skillbridge.mentorship.entity.AlumniProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AlumniProfileRepository extends JpaRepository<AlumniProfile, UUID> {

    Optional<AlumniProfile> findByUserId(UUID userId);

    List<AlumniProfile> findByAvailableTrue();
}
