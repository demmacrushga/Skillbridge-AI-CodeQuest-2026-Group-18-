# Feature Specification: Challenge Service

**Feature Branch**: `feat/challenge-service`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "Challenge service — company-posted industry challenges with student submissions. Recruiter posts a challenge with submission instructions and a deadline; students browse active challenges and submit solution links; the posting recruiter scores submissions; a per-challenge leaderboard ranks scored submissions. Port 8007, schema `challenge`, per docs/architecture.md, docs/api.md, docs/database.md."

## User Scenarios & Testing

### User Story 1 - Post a Challenge (Priority: P1)

A recruiter creates an industry challenge with a title, description, submission instructions
(what to build and how to submit, e.g. "GitHub repository link with a README"), and a
deadline. The challenge becomes visible to students immediately.

**Why this priority**: No other story is testable without challenges in the system. This is
the data-ingestion path everything else depends on.

**Independent Test**: POST `/challenge` with a RECRUITER-role JWT and a valid payload →
receive 201 with the created challenge including its `id`, `active: true`, and
`submissionCount: 0`.

**Acceptance Scenarios**:

1. **Given** an authenticated recruiter, **When** they POST to `/challenge` with a valid
   payload, **Then** the system returns 201 with the created challenge, `active: true`, and
   all submitted fields persisted.

2. **Given** an authenticated STUDENT-role user, **When** they POST to `/challenge`,
   **Then** the system returns 403.

3. **Given** an authenticated recruiter, **When** they POST with a blank title, a blank
   description, blank submission instructions, a missing deadline, or a deadline in the
   past, **Then** the system returns 400.

4. **Given** an unauthenticated request, **When** POSTing to `/challenge`, **Then** the
   system returns 401.

---

### User Story 2 - Browse Active Challenges (Priority: P1)

A student opens the challenges screen and sees all active, non-expired challenges, newest
first. Each entry shows the title, description, submission instructions, deadline, and the
posting company/recruiter identifier.

**Why this priority**: The student-facing discovery moment — the reason the service exists.
P1 alongside US1; not testable until US1 exists.

**Independent Test**: With at least one active challenge posted, GET `/challenge` with any
authenticated JWT → receive 200 with an array of challenges ordered by `createdAt`
descending.

**Acceptance Scenarios**:

1. **Given** several active challenges, **When** a user GETs `/challenge`, **Then** the
   system returns 200 with challenges ordered newest-first.

2. **Given** a challenge whose deadline has passed or that has been deactivated, **When** a
   user GETs `/challenge`, **Then** that challenge does not appear in the list.

3. **Given** no active challenges, **When** a user GETs `/challenge`, **Then** the system
   returns 200 with an empty array.

4. **Given** a student who has already submitted to a challenge, **When** they GET
   `/challenge`, **Then** that challenge's entry carries `submitted: true` (entries are
   always `submitted: false` for RECRUITER callers, who cannot submit).

5. **Given** an unauthenticated request, **When** GETting `/challenge`, **Then** the system
   returns 401.

---

### User Story 3 - Submit a Solution (Priority: P1)

A student taps "Submit" on a challenge and provides a link to their work (e.g. a GitHub
repository URL). The system records the submission and confirms. Submitting again to the
same challenge is rejected.

**Why this priority**: Completes the student loop — browse → view → submit — which forms
the MVP together with US1 and US2.

**Independent Test**: POST `/challenge/{challengeId}/submissions` with a STUDENT JWT and a
valid URL → receive 201; repeating the same call → 409.

**Acceptance Scenarios**:

1. **Given** an active, non-expired challenge, **When** a student POSTs a submission with a
   valid http/https URL, **Then** the system returns 201 and the submission is recorded
   with a `submittedAt` timestamp and a null `score`.

2. **Given** a challenge the student has already submitted to, **When** they POST a
   submission again, **Then** the system returns 409.

3. **Given** a challengeId that does not exist, is inactive, or whose deadline has passed,
   **When** a student POSTs a submission, **Then** the system returns 404.

4. **Given** a malformed or non-http/https submission URL, **When** a student POSTs a
   submission, **Then** the system returns 400.

5. **Given** a RECRUITER-role user, **When** they POST a submission, **Then** the system
   returns 403.

---

### User Story 4 - View My Submissions (Priority: P2)

A student views the list of their own submissions across all challenges — challenge
summary, submission link, date, and score (when the recruiter has assigned one) — most
recent first.

**Why this priority**: Depends on US3 producing data. Lets the student track their entries
and see results when scores land.

**Independent Test**: GET `/challenge/my-submissions` with a STUDENT JWT → 200 array
(possibly empty) ordered by `submittedAt` descending.

**Acceptance Scenarios**:

1. **Given** a student with prior submissions, **When** they GET `/challenge/my-submissions`,
   **Then** the system returns 200 with entries ordered newest-first, each containing the
   challenge summary, `submissionUrl`, `submittedAt`, and `score` (null when unscored).

2. **Given** a student with no submissions, **When** they GET `/challenge/my-submissions`,
   **Then** the system returns 200 with an empty array.

3. **Given** a submission to a since-deactivated challenge, **When** the student GETs
   `/challenge/my-submissions`, **Then** the entry is still returned (history preserved).

---

### User Story 5 - Score Submissions (Priority: P2)

The recruiter who posted a challenge reviews its submissions and assigns each a score
between 0.00 and 100.00. Scores can be revised until the recruiter considers evaluation
final. Scoring remains available after the deadline passes and after deactivation —
evaluation happens after the submission window closes. The leaderboard reflects scores
immediately.

**Why this priority**: Evaluation is what turns submissions into a competition, but it
requires US3 data and an owning recruiter (US1). The student loop delivers value without it.

**Independent Test**: GET `/challenge/{id}/submissions` with the owning RECRUITER JWT →
200 array of submissions; POST `/challenge/{id}/submissions/{submissionId}/score` with
`{ "score": 85.50 }` → 200 with the updated submission.

**Acceptance Scenarios**:

1. **Given** a challenge with submissions, **When** the owning recruiter GETs its
   submissions, **Then** the system returns 200 with one entry per submission (student id,
   `submissionUrl`, `submittedAt`, `score`) ordered newest-first.

2. **Given** an unscored submission on an own challenge, **When** the recruiter POSTs a
   score within 0.00–100.00, **Then** the system returns 200 with the score persisted.

3. **Given** an already-scored submission, **When** the recruiter POSTs a new score,
   **Then** the score is updated (upsert semantics) and subsequent leaderboard requests
   reflect the change.

4. **Given** a challenge whose deadline has passed or that has been deactivated, **When**
   the owning recruiter POSTs a score for one of its submissions, **Then** the system
   returns 200 — scoring stays open after the submission window closes.

5. **Given** a score below 0, above 100, missing, or with more than 2 decimal places,
   **When** the recruiter POSTs it, **Then** the system returns 400.

6. **Given** a challengeId owned by a different recruiter (or an unknown
   challenge/submission id), **When** a recruiter tries to list submissions or score,
   **Then** the system returns 404 (no ownership leakage).

7. **Given** a STUDENT-role user, **When** they call any scoring endpoint, **Then** the
   system returns 403.

5. **Given** a challengeId owned by a different recruiter (or an unknown
   challenge/submission id), **When** a recruiter tries to list submissions or score,
   **Then** the system returns 404 (no ownership leakage).

6. **Given** a STUDENT-role user, **When** they call any scoring endpoint, **Then** the
   system returns 403.

---

### User Story 6 - View Leaderboard (Priority: P2)

Any authenticated user opens a challenge's leaderboard and sees scored submissions ranked
highest-score-first with a 1-based rank. Unscored submissions do not appear.

**Why this priority**: The competitive payoff, but it only has content once US5 has run.

**Independent Test**: With at least two scored submissions on a challenge, GET
`/challenge/{id}/leaderboard` → 200 with `entries` ordered by score descending, ranks
starting at 1.

**Acceptance Scenarios**:

1. **Given** scored submissions on a challenge, **When** a user GETs its leaderboard,
   **Then** entries are ordered by score descending with 1-based `rank`.

2. **Given** two submissions with equal scores, **When** the leaderboard is computed,
   **Then** the earlier submission ranks higher (deterministic tie-break).

3. **Given** a challenge with submissions but none scored yet, **When** a user GETs its
   leaderboard, **Then** the system returns 200 with an empty `entries` array.

4. **Given** a challengeId that does not exist, **When** GETting the leaderboard, **Then**
   the system returns 404.

---

### User Story 7 - Manage Own Challenges (Priority: P2)

A recruiter views the challenges they have posted (with submission counts), newest first,
and can deactivate one so it no longer appears in the browse list and no longer accepts
submissions.

**Why this priority**: Recruiter-side lifecycle management; the student loop (US1–US3)
delivers core value without it.

**Independent Test**: GET `/challenge/mine` with a RECRUITER JWT → 200 array of own
challenges with `submissionCount`; POST `/challenge/{id}/deactivate` → the challenge
disappears from the browse list and submissions to it are rejected.

**Acceptance Scenarios**:

1. **Given** a recruiter with posted challenges, **When** they GET `/challenge/mine`,
   **Then** the system returns 200 with only that recruiter's challenges (including
   inactive ones), ordered newest-first, each with a live `submissionCount`.

2. **Given** an own active challenge, **When** the recruiter POSTs deactivate, **Then**
   the system returns 200 with `active: false`; the challenge no longer appears in
   `GET /challenge` and new submissions to it return 404.

3. **Given** an already-inactive challenge, **When** the recruiter POSTs deactivate again,
   **Then** the system returns 200 (idempotent).

4. **Given** a challengeId owned by a different recruiter, **When** a recruiter tries to
   view or deactivate it, **Then** the system returns 404.

5. **Given** a STUDENT-role user, **When** they call any recruiter management endpoint,
   **Then** the system returns 403.

---

### Edge Cases

- **Challenge with a past deadline**: rejected at creation with 400 (FR-001); a deadline
  that passes after posting automatically excludes the challenge from the browse list and
  closes submissions (FR-003, FR-004).
- **Duplicate submission**: rejected with 409 (FR-005); submissions are idempotent per
  student × challenge.
- **Submitting to an expired or inactive challenge**: 404 — expired/inactive challenges are
  treated as unavailable.
- **Scoring a submission on someone else's challenge**: 404 (FR-008) — ownership is never
  revealed through error differentiation.
- **Score exactly at the boundaries**: 0.00 and 100.00 are both valid scores.
- **Leaderboard with all submissions unscored**: returns 200 with an empty `entries` array —
  unscored work never ranks.
- **Identical scores**: tie-broken by earlier `submittedAt` first, so repeated requests
  return a stable order (FR-009).
- **Recruiter deactivates a challenge that has submissions**: submissions and scores remain
  stored; students keep them in their history (FR-010); the leaderboard remains viewable by
  id for authenticated users.
- **Recruiter edits needed after posting**: v1 has no edit endpoint — the correction path
  is deactivate + repost (documented assumption). Submissions stay attached to the
  deactivated challenge.
- **Recruiter browses the challenge list**: `GET /challenge` accepts any authenticated role;
  recruiters see the same active board students see (deliberate, documented behavior).
- **Student replaces a submission after submitting the wrong link**: not supported in v1 —
  one submission per student per challenge, no edits (409 on retry).

## Requirements

### Functional Requirements

- **FR-001**: System MUST accept challenge postings with `title` (non-blank, max 255),
  `description` (non-blank), `submissionFormat` (non-blank instructions for how to submit),
  and `deadline` (required timestamp in the future).
- **FR-002**: System MUST restrict challenge creation, management, and scoring endpoints to
  authenticated users with the RECRUITER role; all other roles receive 403.
- **FR-003**: System MUST return the active challenge list — excluding inactive challenges
  and challenges whose deadline has passed — ordered by `createdAt` descending, to any
  authenticated user. Each entry MUST indicate whether the caller has already submitted to
  that challenge (`submitted` flag; always false for RECRUITER callers).
- **FR-004**: System MUST accept a submission (`POST /challenge/{id}/submissions`) only
  from STUDENT-role users, only for active, non-expired challenges, and only with a valid
  http/https `submissionUrl` (max 2048 chars); violations return 403, 404, and 400
  respectively.
- **FR-005**: System MUST enforce one submission per student per challenge; a second
  submission attempt returns 409.
- **FR-006**: System MUST return a student's own submissions ordered by `submittedAt`
  descending, each including the challenge summary, `submissionUrl`, and current `score`
  (null when unscored); submissions to deactivated challenges remain included.
- **FR-007**: System MUST allow the owning recruiter to view a challenge's submissions
  (student id, `submissionUrl`, `submittedAt`, `score`; newest-first) and to assign or
  revise a score in the inclusive range 0.00–100.00 with at most 2 decimal places (upsert
  semantics; out-of-range or over-precision → 400). Scoring MUST remain available after the
  challenge's deadline passes and after deactivation — evaluation happens after the
  submission window closes.
- **FR-008**: System MUST return 404 for any resource not owned by the requesting user
  (recruiter challenges, submissions to score) — no ownership leakage.
- **FR-009**: System MUST return a per-challenge leaderboard containing only scored
  submissions, ordered by score descending, tie-broken by `submittedAt` ascending, with a
  1-based `rank`; leaderboard entries carry `studentId` (no display names — see
  Assumptions).
- **FR-010**: System MUST provide recruiter management endpoints: list own challenges
  (newest-first, including inactive, with live `submissionCount`) and deactivate an own
  challenge (idempotent 200). Deactivation makes the challenge ineligible per FR-003 and
  closes submissions while preserving all existing submissions and scores.
- **FR-011**: System MUST expose `GET /challenge/health` as a public endpoint.
- **FR-012**: All error responses MUST use the uniform shape `{ "error": string, "status": number }`.
- **FR-013**: All endpoints except `/challenge/health` MUST require a valid JWT Bearer token.

### Key Entities

- **Challenge**: id (UUID), postedBy (recruiter user id), title, description,
  submissionFormat (submission instructions), deadline, active, createdAt.
- **Submission**: id (UUID), challengeId (FK), studentId, submissionUrl, score (nullable,
  assigned on evaluation), submittedAt.
- **LeaderboardEntry** (derived, not persisted in v1): challengeId, submissionId,
  studentId, score, rank — computed at request time from scored submissions per FR-009.

## Success Criteria

- **SC-001**: A posted challenge appears in the browse list immediately (on the next list
  request, no manual re-indexing step).
- **SC-002**: Browse, submission, and leaderboard requests return within 5 seconds for up
  to 500 active challenges and up to 1,000 submissions per challenge.
- **SC-003**: All endpoints are covered by controller-slice and service unit tests.
- **SC-004**: JaCoCo line coverage ≥ 70%.
- **SC-005**: Service starts cleanly via `docker-compose up challenge-service` with no
  migration errors.
- **SC-006**: Mobile app can complete the student loop end-to-end: browse challenges →
  open a challenge → submit a link → see it in "My Submissions" → see the score once the
  recruiter evaluates.
- **SC-007**: Leaderboard order is explainable: given a set of scored submissions, the
  ranking can be reproduced by hand from the documented rule (score DESC, `submittedAt`
  ASC tie-break).

## Assumptions

- JWT secret is shared across all services; challenge-service validates tokens locally and
  reads the `role` claim for RECRUITER/STUDENT enforcement.
- Scoring is performed manually by the posting recruiter through the API. Automated/AI
  grading of submission links is out of scope for v1 and can be added later without
  changing endpoint contracts.
- The leaderboard is computed at request time from scored submissions. The
  `leaderboard_entries` table sketched in docs/database.md is an optional future cache and
  is not created in v1.
- The docs/api.md sketch shows `studentName` on the leaderboard. v1 returns `studentId`
  only: Constitution I forbids reading auth-service's user table, and the JWT carries no
  name claim. Clients render an anonymized label (e.g. "Student a1b2…").
- The docs/api.md sketch marks `GET /challenge` as unauthenticated. Per Constitution II
  (JWT on all non-public endpoints) and the mobile app always being authenticated, v1
  requires a valid token of any role; only `/challenge/health` is public.
- "Real-time leaderboard updates" (docs/architecture.md) means the leaderboard reflects new
  scores on the next request; no push/WebSocket updates in v1.
- Submissions are URLs only — no file upload or in-platform code storage in v1 (the
  `submissionFormat` text tells students where to host their work).
- v1 has no edit endpoint for challenges or submissions — correction paths are
  deactivate + repost (challenges) and none (submissions; duplicate → 409).
- List endpoints return the full eligible set (no pagination in v1); volume is bounded by
  SC-002. Pagination can be added as a MINOR version bump if volume grows.
- No notifications on new challenges, submissions, or scores in v1 (notification-service
  is unbuilt).
- Port 8007 is used (8001–8006 taken); nginx prefix `/challenge/` per existing gateway
  conventions; PostgreSQL schema `challenge` per docs/database.md.
- Tests use `@WebMvcTest` with mocked services; no running PostgreSQL required.
