package com.skillbridge.portfolio.repository;

import com.skillbridge.portfolio.entity.PortfolioItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PortfolioItemRepository extends JpaRepository<PortfolioItem, UUID> {

    @Query("SELECT pi FROM PortfolioItem pi LEFT JOIN FETCH pi.verificationRequests WHERE pi.userId = :userId ORDER BY pi.displayOrder ASC, pi.createdAt DESC")
    List<PortfolioItem> findByUserIdWithVerificationRequests(@Param("userId") UUID userId);

    Optional<PortfolioItem> findByIdAndUserId(UUID id, UUID userId);

    List<PortfolioItem> findByUserIdAndVerifiedTrue(UUID userId);
}
