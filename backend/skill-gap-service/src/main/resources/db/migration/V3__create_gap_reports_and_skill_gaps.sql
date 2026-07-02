CREATE TABLE skill_gap.gap_reports (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    cv_upload_id   UUID         NOT NULL REFERENCES skill_gap.cv_uploads(id) ON DELETE CASCADE,
    user_id        UUID         NOT NULL,
    target_role    VARCHAR(255) NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gap_reports_user_id ON skill_gap.gap_reports(user_id);

CREATE TABLE skill_gap.skill_gaps (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id        UUID         NOT NULL REFERENCES skill_gap.gap_reports(id) ON DELETE CASCADE,
    skill_name       VARCHAR(255) NOT NULL,
    importance_rank  INTEGER      NOT NULL,
    gap_description  TEXT
);

CREATE INDEX idx_skill_gaps_report_id ON skill_gap.skill_gaps(report_id);
