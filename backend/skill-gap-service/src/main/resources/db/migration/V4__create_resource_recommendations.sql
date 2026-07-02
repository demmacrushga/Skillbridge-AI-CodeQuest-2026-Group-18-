CREATE TABLE skill_gap.resource_recommendations (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_gap_id  UUID         NOT NULL REFERENCES skill_gap.skill_gaps(id) ON DELETE CASCADE,
    resource_type VARCHAR(100) NOT NULL,
    title         VARCHAR(500) NOT NULL,
    url           VARCHAR(1000)
);
