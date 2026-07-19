CREATE TABLE challenge.challenges (
    id                UUID PRIMARY KEY,
    posted_by         UUID         NOT NULL,
    title             VARCHAR(255) NOT NULL,
    description       TEXT         NOT NULL,
    submission_format TEXT         NOT NULL,
    deadline          TIMESTAMPTZ  NOT NULL,
    active            BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_challenges_active_deadline ON challenge.challenges (active, deadline);
CREATE INDEX idx_challenges_posted_by ON challenge.challenges (posted_by);
