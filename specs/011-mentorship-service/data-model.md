# Data Model: Mentorship Service

**Feature**: `specs/011-mentorship-service/spec.md` | **Plan**: `plan.md` | **Date**: 2026-07-19

PostgreSQL 16, isolated schema `mentorship`, Flyway migrations in
`backend/mentorship-service/src/main/resources/db/migration/`.

## Migrations

```text
V1__create_schema.sql            -- CREATE SCHEMA IF NOT EXISTS mentorship;
V2__create_alumni_profiles.sql
V3__create_mentorship_requests.sql
V4__create_mentorship_pairs.sql
V5__create_messages.sql
```

## Entities

### AlumniProfile — `mentorship.alumni_profiles`

One row per alumnus (PUT-upsert keyed on `user_id`, research Decision 5).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | app-generated |
| user_id | UUID | NOT NULL, UNIQUE | the alumnus (JWT `sub`); plain UUID, no cross-schema FK |
| current_role | VARCHAR(150) | NULLABLE | |
| company | VARCHAR(150) | NULLABLE | |
| industry | VARCHAR(100) | NULLABLE | filter matches case-insensitively |
| career_interests | JSONB | NOT NULL | array of 1–20 free-text tags, each ≤ 50 chars; stored trimmed/whitespace-collapsed, original casing preserved (research Decision 4) |
| bio | TEXT | NULLABLE | ≤ 2,000 chars (DTO-enforced) |
| available | BOOLEAN | NOT NULL DEFAULT TRUE | search returns only `available = true` |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | refreshed on every upsert; search tie-break DESC |

Indexes: `UNIQUE (user_id)`; `idx_alumni_profiles_available ON (available)`.

JPA: `List<String> careerInterests` via a JSONB attribute converter.

### MentorshipRequest — `mentorship.mentorship_requests`

The pre-pair lifecycle (research Decision 1).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| student_id | UUID | NOT NULL | sender (JWT `sub`) |
| alumni_id | UUID | NOT NULL | the target alumnus's `user_id` (not the profile id) |
| message | VARCHAR(1000) | NULLABLE | optional intro note |
| status | VARCHAR(20) | NOT NULL | `PENDING`, `ACCEPTED`, `DECLINED`, `CANCELLED` |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | list order DESC |
| responded_at | TIMESTAMPTZ | NULLABLE | set on accept/decline/cancel |

Indexes:
- `uq_request_pending UNIQUE (student_id, alumni_id) WHERE status = 'PENDING'` — partial
  unique index; at most one pending request per student × alumnus, re-requests after
  decline or cancel allowed (research Decision 2; a cancelled/declined row leaves the
  partial index automatically)
- `idx_requests_alumni ON (alumni_id, status)` — incoming-requests query
- `idx_requests_student ON (student_id)` — my-requests query

**State machine**: `PENDING → ACCEPTED` (alumnus; creates pair) | `PENDING → DECLINED`
(alumnus) | `PENDING → CANCELLED` (the sending student — the only student-side exit; no
automatic expiry). Terminal states are immutable — accept/decline/cancel on a resolved
request → 409.

Enum `RequestStatus { PENDING, ACCEPTED, DECLINED, CANCELLED }`.

### MentorshipPair — `mentorship.mentorship_pairs`

Created only by accepting a request.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| student_id | UUID | NOT NULL | |
| alumni_id | UUID | NOT NULL | |
| request_id | UUID | NOT NULL, FK → mentorship_requests.id | the accepted request (provenance) |
| status | VARCHAR(20) | NOT NULL | `ACTIVE`, `ENDED` |
| started_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | list order DESC |
| ended_at | TIMESTAMPTZ | NULLABLE | set on end; end is idempotent |

Indexes: `idx_pairs_student ON (student_id)`; `idx_pairs_alumni ON (alumni_id)`.

**State machine**: `ACTIVE → ENDED` (either participant; idempotent). Ending never touches
messages. New messages on an ENDED pair → 409.

Enum `PairStatus { ACTIVE, ENDED }`.

### Message — `mentorship.messages`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| pair_id | UUID | NOT NULL, FK → mentorship_pairs.id | never cascade-deleted; history survives END |
| sender_id | UUID | NOT NULL | one of the pair's two participants |
| body | VARCHAR(4000) | NOT NULL | non-blank (DTO-enforced) |
| sent_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | thread order ASC |
| read_at | TIMESTAMPTZ | NULLABLE | set server-side when the recipient fetches the thread (research Decision 6) |

Indexes: `idx_messages_pair ON (pair_id, sent_at)`.

## Relationships

```text
AlumniProfile (1 per alumnus user_id)
      ▲ referenced by alumni_id (plain UUID → user_id)
MentorshipRequest (PENDING → ACCEPTED/DECLINED)
      │ accept creates
      ▼
MentorshipPair (ACTIVE → ENDED)  ──< Message (thread, oldest-first)
```

`student_id` / `alumni_id` / `user_id` / `sender_id` are plain UUIDs from the JWT `sub`
claim — no cross-schema FKs (Constitution I).

## DTOs

### Requests

| DTO | Fields / validation |
|---|---|
| `UpsertProfileRequest` | `currentRole` (opt, ≤150), `company` (opt, ≤150), `industry` (opt, ≤100), `careerInterests` (`@NotEmpty @Size(max=20)`, each `@NotBlank @Size(max=50)`), `bio` (opt, ≤2000), `available` (`@NotNull` Boolean) |
| `SendRequestRequest` | `alumniId` (`@NotNull` UUID), `message` (opt, `@Size(max=1000)`) |
| `SendMessageRequest` | `body` (`@NotBlank @Size(max=4000)`) |

### Responses

| DTO | Shape |
|---|---|
| `ProfileResponse` | id, userId, currentRole, company, industry, careerInterests[], bio, available, updatedAt |
| `AlumniSearchEntry` | alumniId (= user_id), currentRole, company, industry, careerInterests[], bio, matchingTags (int), updatedAt |
| `AlumniSearchResponse` | `{ "alumni": [AlumniSearchEntry] }` |
| `RequestResponse` | id, studentId, alumniId, message, status, createdAt, respondedAt |
| `PairResponse` | id, studentId, alumniId, status, startedAt, endedAt |
| `MessageResponse` | id, pairId, senderId, body, sentAt, readAt |
| `ThreadResponse` | `{ "pairId": uuid, "status": "ACTIVE", "messages": [MessageResponse] }` |

## docs/database.md reconciliation (done as part of this feature)

- Add the missing `mentorship.mentorship_requests` section (table above).
- Change `career_interests` from `TEXT` to `JSONB` in the `alumni_profiles` sketch.
- Schema Overview row already says "requests" informally — align wording to
  `mentorship_requests` (matches docs/architecture.md's "Data owned" list).
