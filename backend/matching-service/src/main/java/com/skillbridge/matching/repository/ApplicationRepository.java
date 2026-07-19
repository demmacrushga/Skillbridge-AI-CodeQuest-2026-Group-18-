package com.skillbridge.matching.repository;

import com.skillbridge.matching.entity.Application;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ApplicationRepository extends JpaRepository<Application, UUID> {

    boolean existsByStudentIdAndOpportunityId(UUID studentId, UUID opportunityId);

    List<Application> findByStudentIdOrderByAppliedAtDesc(UUID studentId);

    List<Application> findByOpportunityIdOrderByAppliedAtDesc(UUID opportunityId);

    long countByOpportunityId(UUID opportunityId);
}
