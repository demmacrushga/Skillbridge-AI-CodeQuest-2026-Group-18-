CREATE TABLE mentorship.mentorship_pairs (
    id         UUID PRIMARY KEY,
    student_id UUID        NOT NULL,
    alumni_id  UUID        NOT NULL,
    request_id UUID        NOT NULL REFERENCES mentorship.mentorship_requests (id),
    status     VARCHAR(20) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at   TIMESTAMPTZ
);

CREATE INDEX idx_pairs_student ON mentorship.mentorship_pairs (student_id);
CREATE INDEX idx_pairs_alumni ON mentorship.mentorship_pairs (alumni_id);
