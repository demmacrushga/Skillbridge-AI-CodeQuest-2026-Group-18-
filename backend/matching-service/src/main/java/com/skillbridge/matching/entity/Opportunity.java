package com.skillbridge.matching.entity;

import com.skillbridge.matching.enums.OpportunityType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "opportunities", schema = "matching")
@Getter
@Setter
@NoArgsConstructor
public class Opportunity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID postedBy;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable = false, length = 255)
    private String companyName;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(length = 255)
    private String location;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OpportunityType opportunityType;

    @Column
    private LocalDate deadline;

    @Column(length = 2048)
    private String externalUrl;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "opportunity", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<OpportunitySkill> skills = new ArrayList<>();
}
