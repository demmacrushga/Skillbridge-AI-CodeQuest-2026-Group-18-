package com.skillbridge.skillgap.repository;

import com.skillbridge.skillgap.entity.CvUpload;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CvUploadRepository extends JpaRepository<CvUpload, UUID> {

    List<CvUpload> findByUserIdOrderByCreatedAtDesc(UUID userId);
}
