CREATE TABLE mock_interview.interview_sessions (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID         NOT NULL,
    target_role      VARCHAR(200) NOT NULL,
    difficulty       VARCHAR(20)  NOT NULL,
    status           VARCHAR(20)  NOT NULL DEFAULT 'IN_PROGRESS',
    overall_score    INTEGER,
    overall_feedback TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMPTZ
);

CREATE INDEX idx_interview_sessions_user_id
    ON mock_interview.interview_sessions(user_id);
