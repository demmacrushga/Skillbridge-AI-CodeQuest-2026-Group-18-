CREATE TABLE matching.student_skills (
    id         UUID PRIMARY KEY,
    student_id UUID         NOT NULL,
    skill_name VARCHAR(150) NOT NULL
);

CREATE UNIQUE INDEX uq_student_skills_student_lower_name
    ON matching.student_skills (student_id, lower(skill_name));

CREATE INDEX idx_student_skills_student_id ON matching.student_skills (student_id);
