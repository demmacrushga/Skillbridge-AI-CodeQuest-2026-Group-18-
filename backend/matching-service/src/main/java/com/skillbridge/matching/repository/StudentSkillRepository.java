package com.skillbridge.matching.repository;

import com.skillbridge.matching.entity.StudentSkill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface StudentSkillRepository extends JpaRepository<StudentSkill, UUID> {

    List<StudentSkill> findByStudentId(UUID studentId);

    void deleteByStudentId(UUID studentId);

    @Query("SELECT DISTINCT s.studentId FROM StudentSkill s")
    List<UUID> findDistinctStudentIds();
}
