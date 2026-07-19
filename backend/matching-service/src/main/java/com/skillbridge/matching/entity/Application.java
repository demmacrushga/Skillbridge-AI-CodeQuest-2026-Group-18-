package com.skillbridge.matching.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "applications", schema = "matching",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_application_student_opportunity",
                columnNames = {"student_id", "opportunity_id"}))
@Getter
@Setter
@NoArgsConstructor
public class Application {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID studentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "opportunity_id", nullable = false)
    private Opportunity opportunity;

    @Column(nullable = false, updatable = false)
    private Instant appliedAt = Instant.now();
}
