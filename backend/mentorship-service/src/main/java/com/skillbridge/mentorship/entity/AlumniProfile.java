package com.skillbridge.mentorship.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "alumni_profiles", schema = "mentorship")
@Getter
@Setter
@NoArgsConstructor
public class AlumniProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private UUID userId;

    // quoted: CURRENT_ROLE is a reserved keyword in PostgreSQL
    @Column(name = "\"current_role\"", length = 150)
    private String currentRole;

    @Column(length = 150)
    private String company;

    @Column(length = 100)
    private String industry;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<String> careerInterests = new ArrayList<>();

    @Column(columnDefinition = "TEXT")
    private String bio;

    @Column(nullable = false)
    private boolean available = true;

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();
}
