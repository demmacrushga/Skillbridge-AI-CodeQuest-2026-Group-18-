package com.skillbridge.mentorship.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "messages", schema = "mentorship")
@Getter
@Setter
@NoArgsConstructor
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pair_id", nullable = false)
    private MentorshipPair pair;

    @Column(nullable = false)
    private UUID senderId;

    @Column(nullable = false, length = 4000)
    private String body;

    @Column(nullable = false, updatable = false)
    private Instant sentAt = Instant.now();

    private Instant readAt;
}
