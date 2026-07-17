package com.skillbridge.portfolio.repository;

import com.skillbridge.portfolio.entity.PortfolioLink;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PortfolioLinkRepository extends JpaRepository<PortfolioLink, UUID> {

    Optional<PortfolioLink> findByUserId(UUID userId);

    Optional<PortfolioLink> findByShareTokenAndActiveTrue(String shareToken);
}
