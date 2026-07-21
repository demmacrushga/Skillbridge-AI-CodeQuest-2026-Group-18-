CREATE TABLE mentorship.mentorship_requests (
    id           UUID PRIMARY KEY,
    student_id   UUID          NOT NULL,
    alumni_id    UUID          NOT NULL,
    message      VARCHAR(1000),
    status       VARCHAR(20)   NOT NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    responded_at TIMESTAMPTZ
);

-- At most one PENDING request per student x alumnus; resolved rows leave the
-- index automatically, so re-requests after DECLINED/CANCELLED are allowed.
CREATE UNIQUE INDEX uq_request_pending
    ON mentorship.mentorship_requests (student_id, alumni_id)
    WHERE status = 'PENDING';

CREATE INDEX idx_requests_alumni ON mentorship.mentorship_requests (alumni_id, status);
CREATE INDEX idx_requests_student ON mentorship.mentorship_requests (student_id);
