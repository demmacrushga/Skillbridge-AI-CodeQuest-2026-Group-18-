# Research: Challenge Service

**Date**: 2026-07-18 | **Feature**: specs/010-challenge-service

Seven design decisions. All NEEDS CLARIFICATION items from Technical Context resolved here.

---

## Decision 1: Manual scoring with upsert semantics — allowed after deadline

**Decision**: The owning recruiter assigns each submission a score in the inclusive range
0.00–100.00 (NUMERIC(5,2)) via `POST /challenge/{id}/submissions/{submissionId}/score`.
Re-posting replaces the previous score (upsert). Scoring is guarded by **ownership only** —
it remains available after the deadline passes and after deactivation, because evaluation
typically happens *after* the submission window closes.

**Rationale**: Spec assumption fixes manual scoring for v1. Upsert (vs score-once) protects
against recruiter mis-taps and lets evaluation be revised while judging is in progress —
cheap to implement (update by PK) and idempotent-friendly. Restricting scoring to the
active window would make the feature unusable in its primary flow (submit by deadline →
judge afterwards).

**Alternatives considered**:
- *AI auto-grading of submission links (Claude)* — rejected: non-deterministic, costs
  money, requires fetching/parsing arbitrary external URLs, and engages Constitution III
  plumbing for zero demo benefit at this scale. Can be added later behind the same
  endpoint contract.
- *Score exactly once (409 on re-score)* — rejected: punishes honest mistakes; revision
  during a judging session is a legitimate need.
- *Score only while challenge active* — rejected: contradicts the real evaluation flow.

---

## Decision 2: Leaderboard computed at request time; deterministic ranking rule

**Decision**: `GET /challenge/{id}/leaderboard` ranks all **scored** submissions
(`score IS NOT NULL`) in memory on every request:

```
ORDER BY score DESC, submitted_at ASC   →   rank = row index (1-based)
```

- Unscored submissions never appear (spec edge case).
- Equal scores → earlier submission ranks higher (spec FR-009 tie-break; rewards early
  finishers and keeps repeated requests stable).
- The `leaderboard_entries` table from `docs/database.md` is NOT created in v1 migrations.
- The leaderboard remains viewable for expired/deactivated challenges (history preserved);
  only unknown ids return 404.

**Rationale**: 1,000 scored submissions (SC-002) = one indexed read
(`WHERE challenge_id = ? AND score IS NOT NULL`) + an in-memory sort — comfortably under
5 seconds. Request-time computation means score revisions (Decision 1) are visible on the
next request with zero recomputation triggers.

**Alternatives considered**:
- *Persist `leaderboard_entries` on score write* — rejected for v1: adds a recomputation
  path (on score, on re-score, on deactivate) for no measurable gain at demo scale. YAGNI.
  The table can be added later as a materialization behind the same contract.
- *Include unscored submissions at the bottom unranked* — rejected: muddles the "entries"
  shape (nullable rank) and the spec says unscored work never ranks.

---

## Decision 3: One submission per student per challenge, no edits

**Decision**: `submissions` has `UNIQUE (challenge_id, student_id)`. Submit first checks
`existsByChallengeIdAndStudentId` (→ 409) and catches the unique-constraint violation as a
race fallback (→ 409), mirroring the matching-service apply flow. v1 offers no edit or
withdraw endpoint.

**Rationale**: A leaderboard with multiple entries per student is meaningless; one row per
student × challenge keeps scoring and ranking trivially correct. Constraint-backed
enforcement is race-safe without transactions beyond the insert.

**Alternatives considered**:
- *Allow re-submission to replace the URL before deadline* — rejected for v1: interacts
  with scoring (a replaced URL invalidates the score), adds states for little demo value.
  Documented spec edge case: wrong link → no correction path in v1.
- *Many submissions, latest counts* — rejected: complicates ranking and scoring ownership
  for no benefit.

---

## Decision 4: Role enforcement via copied `@PreAuthorize` method security

**Decision**: Copy `SecurityConfig` (including `@EnableMethodSecurity`) and the JWT trio
from matching-service — now the established pattern. Guards:

| Endpoint(s) | Guard |
|---|---|
| `POST /challenge`, `GET /challenge/mine`, `GET .../submissions` (owner review), `POST .../score`, `POST .../deactivate` | `@PreAuthorize("hasRole('RECRUITER')")` → 403 otherwise |
| `POST /challenge/{id}/submissions`, `GET /challenge/my-submissions` | `@PreAuthorize("hasRole('STUDENT')")` → 403 otherwise |
| `GET /challenge`, `GET /challenge/{id}/leaderboard` | Any authenticated role |
| `GET /challenge/health` | Public (in `PUBLIC_ENDPOINTS`) |

Ownership (recruiter manages/scores only *own* challenges) is enforced in the service
layer: any non-owned id → `ChallengeNotFoundException` → 404 (no ownership leakage,
spec FR-008).

**Rationale**: Identical to matching-service research Decision 4 — method-level guards sit
next to the handler and are exercised directly in `@WebMvcTest` slices.

**Alternatives considered**:
- *URL-based matchers* — rejected (same rationale as matching: splits `/challenge/{id}/...`
  across roles by method).
- *403 for non-owned recruiter resources* — rejected: reveals existence; 404 uniform with
  matching precedent.

---

## Decision 5: Endpoint inventory and response shapes

**Decision**: 10 endpoints (9 protected + 1 public), full contract in
`contracts/challenge-api.md`:

| # | Method & Path | Role | Returns |
|---|---|---|---|
| 1 | `POST /challenge` | RECRUITER | 201 `ChallengeResponse` |
| 2 | `GET /challenge` | authenticated | 200 `ChallengeListResponse` (active only, `submitted` flag) |
| 3 | `POST /challenge/{id}/submissions` | STUDENT | 201 `SubmissionResponse` |
| 4 | `GET /challenge/my-submissions` | STUDENT | 200 `[MySubmissionResponse]` |
| 5 | `GET /challenge/{id}/leaderboard` | authenticated | 200 `LeaderboardResponse` |
| 6 | `GET /challenge/mine` | RECRUITER | 200 `[ChallengeResponse]` + submission counts |
| 7 | `GET /challenge/{id}/submissions` | RECRUITER (owner) | 200 `[SubmissionReviewResponse]` |
| 8 | `POST /challenge/{id}/submissions/{submissionId}/score` | RECRUITER (owner) | 200 `SubmissionReviewResponse` |
| 9 | `POST /challenge/{id}/deactivate` | RECRUITER (owner) | 200 `ChallengeResponse` (`active: false`) |
| 10 | `GET /challenge/health` | public | 200 `{ "status": "UP" }` |

`GET /challenge/{id}` (single challenge detail) is deliberately omitted: the browse-list
entry carries everything the detail/submit view needs (title, description,
submissionFormat, deadline); students navigate from the list. Recruiters get full detail
from `/mine`.

The browse list (endpoint 2) includes a per-entry `submitted` boolean for STUDENT callers
(always `false` for recruiters, who cannot submit) — mirrors matching's `applied` flag and
drives the Submit button state without a second fetch.

Deactivate returns the updated entity (200) rather than 204 so the frontend can re-render
from the response. Scoring returns the full updated submission review DTO.

**Rationale**: Matches spec US1–US7 exactly; nothing more.

**Alternatives considered**:
- *Detail endpoint* — rejected: YAGNI; list payload already carries detail fields.
- *DELETE for challenges* — rejected: deactivate preserves submission/score history
  integrity (spec edge case).
- *PATCH for score* — rejected: POST with upsert semantics is one handler, idempotent per
  payload, and avoids teaching the client two verbs for "set score".

---

## Decision 6: Leaderboard identity — studentId only, anonymized client labels

**Decision**: Leaderboard entries and recruiter submission reviews carry `studentId`
(UUID) only. No names, no emails. The frontend renders an anonymized label derived from
the id (e.g. "Student a1b2…").

**Rationale**: Constitution I forbids reading auth-service's user table, the JWT carries
no name claim (sub/email/role only), and embedding email would leak PII into a broadly
visible board (Constitution V). This is a documented, deliberate departure from the
`docs/api.md` sketch (`studentName`) — the sketch predates the autonomy rule.

**Alternatives considered**:
- *Snapshot a display name into the submission row at submit time* — rejected: the JWT has
  no name to snapshot; adding one to auth tokens is a cross-service contract change for
  cosmetic gain.
- *Call auth-service per leaderboard entry* — rejected: cross-service runtime dependency,
  N+1 calls, violates the spirit of Constitution I.

---

## Decision 7: Frontend screen model — hidden screens, role-routed QuickLink

**Decision**: Two new hidden screens registered in `app/(app)/_layout.tsx` with
`href: null`:
- `challenges.tsx` (student): active challenge list → expand card for detail +
  submissionFormat → Submit (URL input, optimistic `submitted` state) → "My Submissions"
  section showing score when assigned.
- `challenges-manage.tsx` (recruiter): post form (title, description, submissionFormat,
  deadline), my challenges list with submission counts, per-challenge submissions review
  with score input, deactivate with confirm.

Home screen gains a "Challenges" QuickLink (`trophy-outline`) routing by role
(`user.role === 'RECRUITER'` → manage screen, else student screen) — the same pattern as
the "Opportunities" QuickLink. No Coming Soon card exists to remove (the section was
dropped in 009).

**Rationale**: The tab bar already shows 6 tabs; hidden screens + QuickLink is the
established pattern for `gap-report`, `portfolio-review`, `mock-interview-session`,
`opportunities(-manage)`.

**Alternatives considered**:
- *Visible tab* — rejected: tab overflow on small screens.
- *Single screen with in-screen role switch* — rejected: diverges from the opportunities
  precedent; doubles screen complexity.
