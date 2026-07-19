CREATE TABLE challenge.submissions (
    id             UUID PRIMARY KEY,
    challenge_id   UUID          NOT NULL REFERENCES challenge.challenges (id),
    student_id     UUID          NOT NULL,
    submission_url VARCHAR(2048) NOT NULL,
    score          NUMERIC(5, 2),
    submitted_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_submission_challenge_student UNIQUE (challenge_id, student_id)
);

CREATE INDEX idx_submissions_challenge_id ON challenge.submissions (challenge_id);
CREATE INDEX idx_submissions_student_id ON challenge.submissions (student_id);
-- Leaderboard reads: scored submissions per challenge
CREATE INDEX idx_submissions_scored ON challenge.submissions (challenge_id) WHERE score IS NOT NULL;
