package com.skillbridge.skillgap.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "gap_reports", schema = "skill_gap")
@Getter
@Setter
@NoArgsConstructor
public class GapReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cv_upload_id", nullable = false)
    private CvUpload cvUpload;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String targetRole;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "report", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("importanceRank ASC")
    private Set<SkillGap> skillGaps = new HashSet<>();
}
