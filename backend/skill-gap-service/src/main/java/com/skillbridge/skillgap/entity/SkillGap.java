package com.skillbridge.skillgap.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "skill_gaps", schema = "skill_gap")
@Getter
@Setter
@NoArgsConstructor
public class SkillGap {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "report_id", nullable = false)
    private GapReport report;

    @Column(nullable = false)
    private String skillName;

    @Column(nullable = false)
    private int importanceRank;

    @Column(columnDefinition = "TEXT")
    private String gapDescription;

    @OneToMany(mappedBy = "skillGap", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<ResourceRecommendation> recommendations = new HashSet<>();
}
