package com.skillbridge.career.repository;

import com.skillbridge.career.entity.CareerPath;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CareerPathRepository extends JpaRepository<CareerPath, UUID> {
    Optional<CareerPath> findByName(String name);
    List<CareerPath> findAllByOrderByNameAsc();
}
