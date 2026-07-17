CREATE TABLE mock_interview.interview_questions (
    id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    UUID    NOT NULL
                      REFERENCES mock_interview.interview_sessions(id) ON DELETE CASCADE,
    question_text TEXT    NOT NULL,
    category      VARCHAR(30) NOT NULL,
    order_index   INTEGER NOT NULL,
    user_answer   TEXT,
    score         INTEGER,
    feedback      TEXT,
    answered_at   TIMESTAMPTZ
);

CREATE INDEX idx_interview_questions_session_id
    ON mock_interview.interview_questions(session_id);
