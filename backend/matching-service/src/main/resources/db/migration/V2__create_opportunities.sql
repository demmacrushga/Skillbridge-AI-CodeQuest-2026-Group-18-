CREATE TABLE matching.opportunities (
    id               UUID PRIMARY KEY,
    posted_by        UUID         NOT NULL,
    title            VARCHAR(255) NOT NULL,
    company_name     VARCHAR(255) NOT NULL,
    description      TEXT         NOT NULL,
    location         VARCHAR(255),
    opportunity_type VARCHAR(20)  NOT NULL,
    deadline         DATE,
    external_url     VARCHAR(2048),
    active           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_opportunities_active_deadline ON matching.opportunities (active, deadline);

CREATE TABLE matching.opportunity_skills (
    id             UUID PRIMARY KEY,
    opportunity_id UUID         NOT NULL REFERENCES matching.opportunities (id) ON DELETE CASCADE,
    skill_name     VARCHAR(150) NOT NULL,
    required       BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_opportunity_skills_opportunity_id ON matching.opportunity_skills (opportunity_id);
