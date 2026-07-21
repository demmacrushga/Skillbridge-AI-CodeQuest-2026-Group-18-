# Data Model: Challenge Service

**Date**: 2026-07-18 | **Schema**: `challenge` (isolated per Constitution I)

## Entities

### `Challenge`
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, generated | — |
| postedBy | UUID | NOT NULL | Recruiter user id — plain UUID, no cross-schema FK |
| title | VARCHAR(255) | NOT NULL, non-blank | — |
| description | TEXT | NOT NULL, non-blank | — |
| submissionFormat | TEXT | NOT NULL, non-blank | instructions for how/where to submit |
| deadline | TIMESTAMPTZ | NOT NULL | must be in the future at post time; expired rows excluded from browse + closed to submissions |
| active | BOOLEAN | NOT NULL, DEFAULT TRUE | deactivate sets false |
| createdAt | TIMESTAMPTZ | NOT NULL, DEFAULT now() | browse order (DESC) |

### `Submission`
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, generated | — |
| challenge | `@ManyToOne(LAZY)` FK → challenges.id | NOT NULL | NOT cascade-deleted (history preserved) |
| studentId | UUID | NOT NULL | plain UUID |
| submissionUrl | VARCHAR(2048) | NOT NULL | valid http/https URL |
| score | NUMERIC(5,2) | NULL | set on recruiter evaluation; 0.00–100.00; upsert |
| submittedAt | TIMESTAMPTZ | NOT NULL, DEFAULT now() | leaderboard tie-break (ASC) |
| — | UNIQUE(challenge_id, student_id) | — | duplicate submission → 409 via check + constraint catch |

**Not created in v1** (research Decision 2): `leaderboard_entries` — leaderboard computed
at request time from scored submissions; table may be added later as a materialization
without contract changes.

## Migrations (Flyway)

| Version | File | Contents |
|---|---|---|
| V1 | `V1__create_schema.sql` | `CREATE SCHEMA IF NOT EXISTS challenge` |
| V2 | `V2__create_challenges.sql` | `challenges` table, indexes on `(active, deadline)` and `posted_by` |
| V3 | `V3__create_submissions.sql` | `submissions` table, unique `(challenge_id, student_id)`, indexes on `challenge_id` (incl. partial `WHERE score IS NOT NULL` for leaderboard) and `student_id` |

## DTOs

### Requests
- **PostChallengeRequest**: `title` @NotBlank @Size(max=255), `description` @NotBlank
  @Size(max=5000), `submissionFormat` @NotBlank @Size(max=2000), `deadline` @NotNull
  @Future (timestamp)
- **SubmitSolutionRequest**: `submissionUrl` @NotBlank @Pattern(http/https)
  @Size(max=2048)
- **ScoreSubmissionRequest**: `score` @NotNull @DecimalMin("0.00") @DecimalMax("100.00")
  @Digits(integer=3, fraction=2) — more than 2 decimal places → 400 (rejected, never
  silently rounded)

### Responses
- **ChallengeResponse**: id, title, description, submissionFormat, deadline, active,
  createdAt, submissionCount (recruiter views only; null for students)
- **ChallengeListEntry**: id, title, description, submissionFormat, deadline, createdAt,
  submitted (boolean — caller already submitted; always false for RECRUITER callers)
- **ChallengeListResponse**: challenges[ChallengeListEntry]
- **SubmissionResponse**: id, challengeId, submissionUrl, score (null on create),
  submittedAt
- **MySubmissionResponse**: id, submissionUrl, score, submittedAt, challenge
  (ChallengeResponse with submissionCount null — includes inactive/expired challenges)
- **SubmissionReviewResponse** (recruiter): id, studentId, submissionUrl, score,
  submittedAt
- **LeaderboardResponse**: challengeId, entries[{rank, studentId, score}] (scored
  submissions only; empty `entries` when none scored)

## Validation Rules (from spec FR-001/FR-004/FR-005/FR-007)

| Rule | Error |
|---|---|
| title/description/submissionFormat blank | 400 |
| deadline missing or not in the future | 400 |
| submissionUrl blank, malformed (non-http/https), or > 2048 chars | 400 |
| score missing, < 0.00, > 100.00, or with > 2 decimal places | 400 |
| scoring on an expired or deactivated own challenge | 200 (allowed — evaluation happens after the window closes) |
| submit to unknown/inactive/expired challenge | 404 |
| duplicate submission (same student, same challenge) | 409 |
| challenge/submission not owned by calling recruiter | 404 |
| submission id not belonging to the challenge in path | 404 |
| non-RECRUITER on recruiter endpoints / non-STUDENT on student endpoints | 403 |

## State Transitions

- **Challenge.active**: `true → false` via deactivate (one-way in v1; no reactivate endpoint).
- **Challenge browse eligibility** (derived, not stored): `active = true AND deadline > now()`.
- **Submission.score**: `NULL → value` on first score; `value → value` on re-score
  (upsert; research Decision 1). Never returns to NULL in v1.
- **Submission**: created on submit; never deleted or edited in v1.
