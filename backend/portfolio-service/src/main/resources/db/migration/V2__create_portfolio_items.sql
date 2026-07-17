CREATE TABLE portfolio.portfolio_items (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID        NOT NULL,
    item_type     VARCHAR(20) NOT NULL,
    title         VARCHAR(255) NOT NULL,
    description   TEXT,
    external_url  TEXT,
    verified      BOOLEAN     NOT NULL DEFAULT FALSE,
    display_order INTEGER     NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL
);
