CREATE TABLE mentorship.alumni_profiles (
    id               UUID PRIMARY KEY,
    user_id          UUID         NOT NULL,
    -- quoted: CURRENT_ROLE is a reserved keyword in PostgreSQL
    "current_role"   VARCHAR(150),
    company          VARCHAR(150),
    industry         VARCHAR(100),
    career_interests JSONB        NOT NULL,
    bio              TEXT,
    available        BOOLEAN      NOT NULL DEFAULT TRUE,
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_alumni_profiles_user UNIQUE (user_id)
);

CREATE INDEX idx_alumni_profiles_available ON mentorship.alumni_profiles (available);
