package com.skillbridge.skillgap.repository;

import com.skillbridge.skillgap.entity.GapReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GapReportRepository extends JpaRepository<GapReport, UUID> {

    Optional<GapReport> findByIdAndUserId(UUID id, UUID userId);

    @Query("SELECT DISTINCT r FROM GapReport r " +
           "LEFT JOIN FETCH r.skillGaps sg " +
           "LEFT JOIN FETCH sg.recommendations " +
           "WHERE r.userId = :userId " +
           "ORDER BY r.createdAt DESC")
    List<GapReport> findByUserIdWithGaps(@Param("userId") UUID userId);
}
