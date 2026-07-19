package com.skillbridge.matching.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "student_skills", schema = "matching")
@Getter
@Setter
@NoArgsConstructor
public class StudentSkill {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID studentId;

    @Column(nullable = false, length = 150)
    private String skillName;

    public StudentSkill(UUID studentId, String skillName) {
        this.studentId = studentId;
        this.skillName = skillName;
    }
}
