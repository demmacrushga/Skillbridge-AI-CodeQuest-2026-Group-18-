CREATE TABLE matching.applications (
    id             UUID PRIMARY KEY,
    student_id     UUID        NOT NULL,
    opportunity_id UUID        NOT NULL REFERENCES matching.opportunities (id),
    applied_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_application_student_opportunity UNIQUE (student_id, opportunity_id)
);

CREATE INDEX idx_applications_student_id ON matching.applications (student_id);
CREATE INDEX idx_applications_opportunity_id ON matching.applications (opportunity_id);
