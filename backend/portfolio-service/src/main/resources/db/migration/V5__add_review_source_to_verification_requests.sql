ALTER TABLE portfolio.verification_requests
    ADD COLUMN IF NOT EXISTS review_source VARCHAR(20) NOT NULL DEFAULT 'AI';
