package com.skillbridge.skillgap.repository;

import com.skillbridge.skillgap.entity.SkillGap;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SkillGapRepository extends JpaRepository<SkillGap, UUID> {

    List<SkillGap> findByReportIdOrderByImportanceRankAsc(UUID reportId);
}
