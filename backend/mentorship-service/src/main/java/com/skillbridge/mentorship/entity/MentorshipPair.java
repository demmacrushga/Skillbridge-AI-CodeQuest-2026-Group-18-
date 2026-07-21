package com.skillbridge.mentorship.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "mentorship_pairs", schema = "mentorship")
@Getter
@Setter
@NoArgsConstructor
public class MentorshipPair {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID studentId;

    @Column(nullable = false)
    private UUID alumniId;

    @Column(nullable = false)
    private UUID requestId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PairStatus status = PairStatus.ACTIVE;

    @Column(nullable = false, updatable = false)
    private Instant startedAt = Instant.now();

    private Instant endedAt;
}
