CREATE TABLE career.roadmaps (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL,
  career_path_id   UUID        NOT NULL REFERENCES career.career_paths(id),
  academic_level   VARCHAR(20) NOT NULL,
  current_skills   TEXT,
  progress_percent INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_roadmaps_user_id ON career.roadmaps(user_id);

CREATE TABLE career.milestones (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id     UUID         NOT NULL REFERENCES career.roadmaps(id) ON DELETE CASCADE,
  semester       INTEGER      NOT NULL,
  title          VARCHAR(255) NOT NULL,
  description    TEXT,
  milestone_type VARCHAR(50)  NOT NULL,
  display_order  INTEGER      NOT NULL
);

CREATE TABLE career.milestone_completions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id  UUID        NOT NULL REFERENCES career.milestones(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evidence_note TEXT,
  UNIQUE (milestone_id, user_id)
);
