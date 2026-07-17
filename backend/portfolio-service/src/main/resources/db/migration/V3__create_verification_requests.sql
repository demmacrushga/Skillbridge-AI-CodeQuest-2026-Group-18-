CREATE TABLE portfolio.verification_requests (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_item_id UUID        NOT NULL REFERENCES portfolio.portfolio_items(id),
    requested_by      UUID        NOT NULL,
    reviewed_by       UUID,
    status            VARCHAR(20) NOT NULL,
    reviewer_note     TEXT,
    requested_at      TIMESTAMPTZ NOT NULL,
    reviewed_at       TIMESTAMPTZ
);
