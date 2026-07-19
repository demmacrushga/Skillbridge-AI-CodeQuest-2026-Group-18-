package com.skillbridge.challenge.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "submissions", schema = "challenge",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_submission_challenge_student",
                columnNames = {"challenge_id", "student_id"}))
@Getter
@Setter
@NoArgsConstructor
public class Submission {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "challenge_id", nullable = false)
    private Challenge challenge;

    @Column(nullable = false)
    private UUID studentId;

    @Column(nullable = false, length = 2048)
    private String submissionUrl;

    @Column(precision = 5, scale = 2)
    private BigDecimal score;

    @Column(nullable = false, updatable = false)
    private Instant submittedAt = Instant.now();
}
