CREATE TABLE portfolio.portfolio_links (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL UNIQUE,
    share_token  VARCHAR(64) NOT NULL UNIQUE,
    active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL
);
