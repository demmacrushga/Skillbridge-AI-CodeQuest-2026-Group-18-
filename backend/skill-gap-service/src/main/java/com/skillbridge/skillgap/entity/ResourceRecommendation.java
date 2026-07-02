package com.skillbridge.skillgap.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "resource_recommendations", schema = "skill_gap")
@Getter
@Setter
@NoArgsConstructor
public class ResourceRecommendation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "skill_gap_id", nullable = false)
    private SkillGap skillGap;

    @Column(nullable = false)
    private String resourceType;

    @Column(nullable = false)
    private String title;

    private String url;
}
