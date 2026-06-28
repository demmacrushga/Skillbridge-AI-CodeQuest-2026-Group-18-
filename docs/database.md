# Database Design

SkillBridge AI uses **PostgreSQL 16**. Each microservice owns an isolated schema and manages its own tables through **Flyway** migrations. Services never share tables or query across schema boundaries.

---

## Table of Contents

- [Design Principles](#design-principles)
- [Schema Overview](#schema-overview)
- [auth-service Schema](#auth-service-schema)
- [career-service Schema](#career-service-schema)
- [skill-gap-service Schema](#skill-gap-service-schema)
- [portfolio-service Schema](#portfolio-service-schema)
- [interview-service Schema](#interview-service-schema)
- [matching-service Schema](#matching-service-schema)
- [challenge-service Schema](#challenge-service-schema)
- [mentorship-service Schema](#mentorship-service-schema)
- [notification-service Schema](#notification-service-schema)
- [Migration Conventions](#migration-conventions)

---

## Design Principles

- **Schema isolation**: each service has its own PostgreSQL schema (e.g., `auth`, `career`, `portfolio`). Cross-schema queries are not permitted.
- **UUID primary keys**: all tables use UUID primary keys to avoid sequential ID enumeration and to support distributed generation.
- **Soft deletes**: records are marked `deleted_at` rather than physically deleted, preserving audit trails.
- **Audit columns**: every table includes `created_at` and `updated_at` timestamps managed by the application layer.
- **Flyway migrations**: all schema changes are versioned, sequential, and applied automatically on service startup.

---

## Schema Overview

| Service | Schema Name | Core Tables |
|---|---|---|
| auth-service | `auth` | users, roles, refresh_tokens, oauth_accounts |
| career-service | `career` | career_paths, roadmaps, milestones, milestone_completions |
| skill-gap-service | `skill_gap` | cv_uploads, gap_reports, skill_gaps, resource_recommendations |
| portfolio-service | `portfolio` | portfolio_items, verification_requests, portfolio_links |
| interview-service | `interview` | sessions, questions, answers, feedback_reports |
| matching-service | `matching` | opportunities, opportunity_skills, student_matches, applications |
| challenge-service | `challenge` | challenges, submissions, leaderboard_entries |
| mentorship-service | `mentorship` | alumni_profiles, mentorship_pairs, requests, messages |
| notification-service | `notification` | notifications, push_tokens, preferences |

---

## auth-service Schema

### `auth.users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, NOT NULL | User identifier |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Login email |
| password_hash | VARCHAR(255) | NULLABLE | Null for OAuth-only users |
| first_name | VARCHAR(100) | NOT NULL | — |
| last_name | VARCHAR(100) | NOT NULL | — |
| role | VARCHAR(50) | NOT NULL | STUDENT, ALUMNI, RECRUITER, ADMIN |
| email_verified | BOOLEAN | NOT NULL, DEFAULT FALSE | — |
| active | BOOLEAN | NOT NULL, DEFAULT TRUE | — |
| created_at | TIMESTAMPTZ | NOT NULL | — |
| updated_at | TIMESTAMPTZ | NOT NULL | — |
| deleted_at | TIMESTAMPTZ | NULLABLE | Soft delete |

### `auth.refresh_tokens`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| user_id | UUID | FK → users.id | — |
| token_hash | VARCHAR(255) | UNIQUE, NOT NULL | SHA-256 of the raw token |
| expires_at | TIMESTAMPTZ | NOT NULL | — |
| revoked | BOOLEAN | NOT NULL, DEFAULT FALSE | — |
| created_at | TIMESTAMPTZ | NOT NULL | — |

### `auth.oauth_accounts`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| user_id | UUID | FK → users.id | — |
| provider | VARCHAR(50) | NOT NULL | google |
| provider_user_id | VARCHAR(255) | NOT NULL | — |
| created_at | TIMESTAMPTZ | NOT NULL | — |

---

## career-service Schema

### `career.career_paths`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| name | VARCHAR(100) | UNIQUE, NOT NULL | e.g. Software Engineer |
| description | TEXT | NULLABLE | — |
| created_at | TIMESTAMPTZ | NOT NULL | — |

### `career.roadmaps`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| user_id | UUID | NOT NULL | Reference to auth.users (cross-service by value) |
| career_path_id | UUID | FK → career_paths.id | — |
| academic_level | VARCHAR(20) | NOT NULL | Level 100–400 |
| current_skills | TEXT | NULLABLE | Snapshot at roadmap generation |
| progress_percent | INTEGER | NOT NULL, DEFAULT 0 | 0–100 |
| created_at | TIMESTAMPTZ | NOT NULL | — |
| updated_at | TIMESTAMPTZ | NOT NULL | — |

### `career.milestones`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| roadmap_id | UUID | FK → roadmaps.id | — |
| semester | INTEGER | NOT NULL | 1–8 |
| title | VARCHAR(255) | NOT NULL | — |
| description | TEXT | NULLABLE | — |
| milestone_type | VARCHAR(50) | NOT NULL | SKILL, PROJECT, CERT, EXPERIENCE |
| display_order | INTEGER | NOT NULL | — |

### `career.milestone_completions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| milestone_id | UUID | FK → milestones.id | — |
| user_id | UUID | NOT NULL | — |
| completed_at | TIMESTAMPTZ | NOT NULL | — |
| evidence_note | TEXT | NULLABLE | Student's note on how they completed it |

---

## skill-gap-service Schema

### `skill_gap.cv_uploads`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| user_id | UUID | NOT NULL | — |
| file_name | VARCHAR(255) | NOT NULL | Original filename |
| file_type | VARCHAR(10) | NOT NULL | pdf, docx |
| storage_path | TEXT | NOT NULL | Internal file path |
| extracted_text | TEXT | NULLABLE | Parsed plain text |
| status | VARCHAR(20) | NOT NULL | PENDING, PROCESSING, COMPLETE, FAILED |
| created_at | TIMESTAMPTZ | NOT NULL | — |

### `skill_gap.gap_reports`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| cv_upload_id | UUID | FK → cv_uploads.id | — |
| user_id | UUID | NOT NULL | — |
| target_role | VARCHAR(100) | NOT NULL | — |
| created_at | TIMESTAMPTZ | NOT NULL | — |

### `skill_gap.skill_gaps`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| report_id | UUID | FK → gap_reports.id | — |
| skill_name | VARCHAR(150) | NOT NULL | — |
| importance_rank | INTEGER | NOT NULL | 1 = most important |
| gap_description | TEXT | NOT NULL | — |

### `skill_gap.resource_recommendations`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| skill_gap_id | UUID | FK → skill_gaps.id | — |
| resource_type | VARCHAR(20) | NOT NULL | COURSE, PROJECT, CERTIFICATION |
| title | VARCHAR(255) | NOT NULL | — |
| url | TEXT | NULLABLE | — |

---

## portfolio-service Schema

### `portfolio.portfolio_items`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| user_id | UUID | NOT NULL | — |
| item_type | VARCHAR(20) | NOT NULL | PROJECT, CERTIFICATE, ACHIEVEMENT |
| title | VARCHAR(255) | NOT NULL | — |
| description | TEXT | NULLABLE | — |
| external_url | TEXT | NULLABLE | GitHub link, certificate URL, etc. |
| verified | BOOLEAN | NOT NULL, DEFAULT FALSE | — |
| display_order | INTEGER | NOT NULL, DEFAULT 0 | — |
| created_at | TIMESTAMPTZ | NOT NULL | — |
| updated_at | TIMESTAMPTZ | NOT NULL | — |

### `portfolio.verification_requests`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| portfolio_item_id | UUID | FK → portfolio_items.id | — |
| requested_by | UUID | NOT NULL | Student user_id |
| reviewed_by | UUID | NULLABLE | Admin user_id |
| status | VARCHAR(20) | NOT NULL | PENDING, APPROVED, REJECTED |
| reviewer_note | TEXT | NULLABLE | — |
| requested_at | TIMESTAMPTZ | NOT NULL | — |
| reviewed_at | TIMESTAMPTZ | NULLABLE | — |

### `portfolio.portfolio_links`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| user_id | UUID | NOT NULL | — |
| share_token | VARCHAR(64) | UNIQUE, NOT NULL | URL-safe random token |
| active | BOOLEAN | NOT NULL, DEFAULT TRUE | — |
| created_at | TIMESTAMPTZ | NOT NULL | — |

---

## interview-service Schema

### `interview.sessions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| user_id | UUID | NOT NULL | — |
| career_path | VARCHAR(100) | NOT NULL | — |
| experience_level | VARCHAR(20) | NOT NULL | ENTRY, MID, SENIOR |
| status | VARCHAR(20) | NOT NULL | IN_PROGRESS, COMPLETED |
| started_at | TIMESTAMPTZ | NOT NULL | — |
| completed_at | TIMESTAMPTZ | NULLABLE | — |

### `interview.questions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| session_id | UUID | FK → sessions.id | — |
| question_text | TEXT | NOT NULL | — |
| display_order | INTEGER | NOT NULL | — |

### `interview.answers`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| question_id | UUID | FK → questions.id | — |
| answer_text | TEXT | NOT NULL | Transcribed if voice input |
| input_type | VARCHAR(10) | NOT NULL | TEXT, VOICE |
| submitted_at | TIMESTAMPTZ | NOT NULL | — |

### `interview.feedback_reports`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| answer_id | UUID | FK → answers.id | — |
| content_score | INTEGER | NOT NULL | 0–100 |
| structure_score | INTEGER | NOT NULL | 0–100 |
| feedback_text | TEXT | NOT NULL | AI-generated feedback |
| improvement_points | TEXT | NOT NULL | JSON array of improvement suggestions |
| created_at | TIMESTAMPTZ | NOT NULL | — |

---

## matching-service Schema

### `matching.opportunities`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| posted_by | UUID | NOT NULL | Recruiter user_id |
| title | VARCHAR(255) | NOT NULL | — |
| company_name | VARCHAR(255) | NOT NULL | — |
| description | TEXT | NOT NULL | — |
| location | VARCHAR(255) | NULLABLE | — |
| opportunity_type | VARCHAR(20) | NOT NULL | INTERNSHIP, ENTRY_LEVEL |
| deadline | DATE | NULLABLE | — |
| active | BOOLEAN | NOT NULL, DEFAULT TRUE | — |
| created_at | TIMESTAMPTZ | NOT NULL | — |

### `matching.opportunity_skills`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| opportunity_id | UUID | FK → opportunities.id | — |
| skill_name | VARCHAR(150) | NOT NULL | — |
| required | BOOLEAN | NOT NULL, DEFAULT TRUE | — |

### `matching.student_matches`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| student_id | UUID | NOT NULL | — |
| opportunity_id | UUID | FK → opportunities.id | — |
| match_score | NUMERIC(5,2) | NOT NULL | 0.00–100.00 |
| generated_at | TIMESTAMPTZ | NOT NULL | — |

### `matching.applications`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| student_id | UUID | NOT NULL | — |
| opportunity_id | UUID | FK → opportunities.id | — |
| applied_at | TIMESTAMPTZ | NOT NULL | — |

---

## challenge-service Schema

### `challenge.challenges`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| posted_by | UUID | NOT NULL | Company/recruiter user_id |
| title | VARCHAR(255) | NOT NULL | — |
| description | TEXT | NOT NULL | — |
| submission_format | TEXT | NOT NULL | Instructions for how to submit |
| deadline | TIMESTAMPTZ | NOT NULL | — |
| active | BOOLEAN | NOT NULL, DEFAULT TRUE | — |
| created_at | TIMESTAMPTZ | NOT NULL | — |

### `challenge.submissions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| challenge_id | UUID | FK → challenges.id | — |
| student_id | UUID | NOT NULL | — |
| submission_url | TEXT | NOT NULL | Link to submitted work |
| score | NUMERIC(5,2) | NULLABLE | Assigned after evaluation |
| submitted_at | TIMESTAMPTZ | NOT NULL | — |

### `challenge.leaderboard_entries`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| challenge_id | UUID | FK → challenges.id | — |
| submission_id | UUID | FK → submissions.id | — |
| student_id | UUID | NOT NULL | — |
| rank | INTEGER | NOT NULL | — |
| updated_at | TIMESTAMPTZ | NOT NULL | — |

---

## mentorship-service Schema

### `mentorship.alumni_profiles`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| user_id | UUID | NOT NULL | Reference to auth.users |
| current_role | VARCHAR(150) | NULLABLE | — |
| company | VARCHAR(150) | NULLABLE | — |
| industry | VARCHAR(100) | NULLABLE | — |
| career_interests | TEXT | NULLABLE | JSON array of interest tags |
| bio | TEXT | NULLABLE | — |
| available | BOOLEAN | NOT NULL, DEFAULT TRUE | — |
| updated_at | TIMESTAMPTZ | NOT NULL | — |

### `mentorship.mentorship_pairs`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| student_id | UUID | NOT NULL | — |
| alumni_id | UUID | NOT NULL | — |
| status | VARCHAR(20) | NOT NULL | ACTIVE, ENDED |
| started_at | TIMESTAMPTZ | NOT NULL | — |
| ended_at | TIMESTAMPTZ | NULLABLE | — |

### `mentorship.messages`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| pair_id | UUID | FK → mentorship_pairs.id | — |
| sender_id | UUID | NOT NULL | — |
| body | TEXT | NOT NULL | — |
| sent_at | TIMESTAMPTZ | NOT NULL | — |
| read_at | TIMESTAMPTZ | NULLABLE | — |

---

## notification-service Schema

### `notification.notifications`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| user_id | UUID | NOT NULL | — |
| type | VARCHAR(50) | NOT NULL | ROADMAP_MILESTONE, MATCH_FOUND, etc. |
| title | VARCHAR(255) | NOT NULL | — |
| body | TEXT | NOT NULL | — |
| read | BOOLEAN | NOT NULL, DEFAULT FALSE | — |
| created_at | TIMESTAMPTZ | NOT NULL | — |

### `notification.push_tokens`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK | — |
| user_id | UUID | NOT NULL | — |
| expo_push_token | VARCHAR(255) | NOT NULL | — |
| active | BOOLEAN | NOT NULL, DEFAULT TRUE | — |
| registered_at | TIMESTAMPTZ | NOT NULL | — |

---

## Migration Conventions

All migrations live in each service at:
```
src/main/resources/db/migration/
```

### File naming

```
V{version}__{description}.sql
```

Examples:
```
V1__create_users_table.sql
V2__add_oauth_accounts.sql
V3__add_email_verified_column.sql
```

### Rules

- **Never edit an existing migration file** — if you need to change something, write a new migration.
- **Run migrations locally** before pushing. Flyway runs automatically on service startup, but a broken migration will crash the service.
- **Test rollback mentally** — while Flyway doesn't auto-rollback, consider how you would undo each migration in a hotfix if needed.
- **One concern per migration** — don't create five tables in one file. Separate migrations are easier to debug and revert.
