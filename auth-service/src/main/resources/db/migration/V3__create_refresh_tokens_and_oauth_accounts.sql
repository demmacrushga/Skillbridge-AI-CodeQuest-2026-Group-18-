CREATE TABLE auth.refresh_tokens (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ  NOT NULL,
    revoked     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_token_hash ON auth.refresh_tokens (token_hash);
CREATE INDEX idx_refresh_tokens_user_id    ON auth.refresh_tokens (user_id);

CREATE TABLE auth.oauth_accounts (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID         NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    provider         VARCHAR(50)  NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_user_id)
);
