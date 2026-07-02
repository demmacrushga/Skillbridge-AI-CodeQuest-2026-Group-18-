CREATE TABLE skill_gap.cv_uploads (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID         NOT NULL,
    file_name      VARCHAR(255) NOT NULL,
    file_type      VARCHAR(50)  NOT NULL,
    storage_path   VARCHAR(500) NOT NULL,
    extracted_text TEXT,
    status         VARCHAR(20)  NOT NULL DEFAULT 'PROCESSING',
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cv_uploads_user_id ON skill_gap.cv_uploads(user_id);
CREATE INDEX idx_cv_uploads_status  ON skill_gap.cv_uploads(status);
