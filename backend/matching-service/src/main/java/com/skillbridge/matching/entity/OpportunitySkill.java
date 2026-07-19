package com.skillbridge.matching.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "opportunity_skills", schema = "matching")
@Getter
@Setter
@NoArgsConstructor
public class OpportunitySkill {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "opportunity_id", nullable = false)
    private Opportunity opportunity;

    @Column(nullable = false, length = 150)
    private String skillName;

    @Column(nullable = false)
    private boolean required = true;
}
