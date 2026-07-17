package com.skillbridge.portfolio.repository;

import com.skillbridge.portfolio.entity.VerificationRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface VerificationRequestRepository extends JpaRepository<VerificationRequest, UUID> {

    boolean existsByPortfolioItemIdAndStatus(UUID portfolioItemId, String status);

    Optional<VerificationRequest> findByIdAndStatus(UUID id, String status);
}
