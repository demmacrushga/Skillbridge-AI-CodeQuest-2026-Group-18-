# Research: Mentorship Service

**Feature**: `specs/011-mentorship-service/spec.md` | **Date**: 2026-07-19

No NEEDS CLARIFICATION markers remained in the Technical Context — the stack is fixed by
the constitution and the scaffolding pattern is proven across matching-service (009) and
challenge-service (010). Research below records the design decisions and their rationale.

---

## Decision 1: Request lifecycle as its own entity (`mentorship_requests` table)

**Decision**: Model the pre-pair lifecycle (PENDING → ACCEPTED | DECLINED) as a dedicated
`MentorshipRequest` entity and `mentorship.mentorship_requests` table. Accepting a request
creates a `MentorshipPair` row and stamps the request `ACCEPTED`/`respondedAt`; declining
stamps `DECLINED` and creates nothing.

**Decision (amended)**: The request state machine has three exits from PENDING:
`ACCEPTED` (alumnus), `DECLINED` (alumnus), and `CANCELLED` (the sending student). Cancel
exists because requests never expire — without it, an unresponsive alumnus plus the
one-pending-per-pair guard would permanently deadlock that student↔alumnus route.

**Rationale**: `docs/architecture.md` names "mentorship request sending and acceptance" as
a core responsibility and lists `mentorship_requests` under data owned, but
`docs/database.md`'s schema sketch omitted the table entirely. Folding request state into
`mentorship_pairs` (e.g. a `REQUESTED` status on the pair) was considered and rejected: a
declined request is not a pair and should never appear in "my pairs"; and FR-007 (student
may re-request after a decline) would force soft-deleting or reusing pair rows. A separate
request entity keeps both state machines trivial (request: PENDING→terminal; pair:
ACTIVE→ENDED).

**Alternatives considered**: status-on-pair (rejected above); no request step at all
(instant pairing — rejected: alumni must consent, per spec US4).

## Decision 2: Duplicate-request guard = application check + DB partial unique index

**Decision**: Reject a new request with 409 when the student already has a PENDING request
or an ACTIVE pair with the same alumnus. Enforce with a service-layer existence check plus
a partial unique index `ON mentorship_requests (student_id, alumni_id) WHERE status =
'PENDING'` as the race backstop (`DataIntegrityViolationException` → same 409). The
ACTIVE-pair half of the guard is a plain service-layer query (no index needed — pair
creation only happens inside the accept path, which is already serialized per request row).

**Rationale**: Identical defense-in-depth shape to matching-service applications and
challenge-service submissions (both use app-check + unique constraint → 409). A partial
index is used instead of a full unique index because a student may accumulate many
DECLINED requests to the same alumnus over time (FR-007) — only one *pending* at a time.

**Alternatives considered**: full unique index + status column trickery (rejected — blocks
legitimate re-requests); app-level check only (rejected — race window).

## Decision 3: Interest search ranking = tag-overlap count, computed at request time

**Decision**: `GET /mentorship/alumni?interest=a&interest=b&industry=x` filters to
`available = true` profiles (industry exact-match case-insensitive when supplied), then
ranks by number of case-insensitively matching interest tags descending, tie-broken by
`updated_at` descending. Computed in memory per request; no persisted match scores. With no
filters, all available profiles are returned in `updated_at` DESC order.

**Rationale**: Mirrors matching-service's deterministic, hand-verifiable scoring philosophy
(SC-007) and challenge-service's compute-at-request-time leaderboard (YAGNI on caches).
Expected volume (≤ 300 profiles, SC-002) makes a full scan + in-memory sort trivially fast.
Tags are free-text; exact case-insensitive string comparison after trim/whitespace-collapse
(same `normalize()` treatment as matching-service skills).

**Alternatives considered**: AI-semantic matching (rejected — Constitution III overhead for
no demo value; consistent with 009/010 no-AI decisions); weighted/fuzzy matching (rejected —
not explainable, not needed at this scale).

## Decision 4: `career_interests` stored as JSONB array, not a child table

**Decision**: Store the tag list in a single `career_interests JSONB NOT NULL` column on
`alumni_profiles` (upgrading docs/database.md's sketched `TEXT` "JSON array of interest
tags" to JSONB), mapped in JPA via a `List<String>` with a JSON converter.

**Rationale**: The docs/database.md sketch already committed to a JSON-array-in-a-column
shape. Tags are only ever read/written as a whole with their profile (upsert semantics,
FR-001) and filtered in memory after fetching available profiles — no SQL-level tag joins
needed at this scale. A child table (like `matching.student_skills`) buys per-tag indexing
we don't need and complicates the profile upsert.

**Alternatives considered**: normalized `alumni_interests` child table (rejected — the
skills table in matching-service exists because skills are matched *in SQL-adjacent volume*
against opportunities; here the whole profile set is small and fetched anyway); TEXT with
manual JSON (rejected — JSONB is validated by Postgres and costs nothing).

## Decision 5: One profile per alumnus, PUT-upsert semantics

**Decision**: `PUT /mentorship/profile` creates-or-replaces the caller's single profile
(keyed by unique `user_id`). No POST/PATCH split, no profile id in the URL.

**Rationale**: Matches the spec (FR-001 upsert) and the platform's "one screen, save once"
mobile UX (same shape as matching-service's `PUT /matching/profile/skills` full-replace).
A unique index on `user_id` enforces one-profile-per-alumnus at the DB level.

**Alternatives considered**: POST-then-PATCH lifecycle (rejected — two verbs for one
"edit my profile" screen).

## Decision 6: Read receipts set server-side on thread fetch

**Decision**: `GET /mentorship/pairs/{pairId}/messages` marks as read (sets `read_at`)
every message in the thread addressed to the caller with `read_at IS NULL`, in the same
transaction as the fetch. No separate "mark read" endpoint.

**Rationale**: FR-014 requires it; a dedicated endpoint would add a client round-trip and
an unread-state race for zero benefit. "Addressed to the caller" = `sender_id != callerId`
(two-participant threads make recipient derivable).

**Alternatives considered**: explicit `POST .../read` endpoint (rejected — extra
round-trip, easy to forget client-side); no read tracking (rejected — `read_at` is in the
sketched schema and gives the unread badge the frontend wants).

## Decision 7: Ownership/participant failures → 404 (platform pattern)

**Decision**: Any attempt to act on a request not addressed to the caller, or a pair the
caller isn't a participant of, returns 404 with the same message as a nonexistent id —
never 403.

**Rationale**: Identical to matching-service (deactivate/applicants) and challenge-service
(review/score/deactivate) — no ownership leakage (FR-008/FR-011 "no ownership leakage",
spec Edge Cases). Repository methods take the caller id as a filter
(`findByIdAndParticipant`-style), so "not yours" and "not found" are indistinguishable by
construction.

**Alternatives considered**: 403 (rejected — confirms resource existence).

## Decision 8: Role guards via `@PreAuthorize` method security; endpoint inventory = 12

**Decision**: Copy challenge-service's `@EnableMethodSecurity` + per-method
`@PreAuthorize("hasRole('ALUMNI')")` / `hasRole('STUDENT')` pattern. Twelve endpoints:

| # | Endpoint | Role |
|---|---|---|
| 1 | `GET /mentorship/health` | public |
| 2 | `GET /mentorship/profile` | ALUMNI |
| 3 | `PUT /mentorship/profile` | ALUMNI |
| 4 | `GET /mentorship/alumni` | STUDENT |
| 5 | `POST /mentorship/requests` | STUDENT |
| 6 | `GET /mentorship/requests/mine` | STUDENT |
| 7 | `POST /mentorship/requests/{id}/cancel` | STUDENT (sender) |
| 8 | `GET /mentorship/requests/incoming` | ALUMNI |
| 9 | `POST /mentorship/requests/{id}/accept` | ALUMNI (addressee) |
| 10 | `POST /mentorship/requests/{id}/decline` | ALUMNI (addressee) |
| 11 | `GET /mentorship/pairs/mine` | any authenticated (participant scope; non-participants get an empty list) |
| 12 | `POST /mentorship/pairs/{id}/end` | participant |
| 13 | `GET /mentorship/pairs/{id}/messages` + `POST .../messages` | participant |

(14 handler methods across 12 unique paths — profile rows 2–3 and messages row 13 each
share one path across two methods.) Endpoints 11–13 scope by participant id rather than
role. Cancel (7) exists so a PENDING
request to an unresponsive alumnus never permanently deadlocks the student↔alumnus route
(the duplicate guard in Decision 2 blocks re-requests only while one is *pending*).

**Rationale**: Established pattern (010 research Decision 4); same testability argument for
`@WebMvcTest` slices. Accept/decline are separate POST endpoints rather than one
`PATCH {status}` — mirrors challenge-service's verb-explicit `deactivate`/`score` style and
keeps client code obvious.

**Alternatives considered**: single `PATCH /requests/{id}` with status body (rejected —
teaches clients an enum-writing pattern the rest of the platform avoids).

## Decision 9: No AI, no notifications, no pagination in v1

**Decision**: Zero Claude calls (Constitution III not engaged). No push/in-app
notifications on requests, responses, or messages (notification-service is unbuilt). All
list endpoints return the full eligible set, bounded by SC-002 (≤ 300 profiles, ≤ 50
messages/thread).

**Rationale**: Consistent with 009/010; spec Assumptions already commit to all three.
Message polling is `useFocusEffect` + pull-to-refresh on the frontend — no WebSockets in
v1 ("in-platform messaging" means persisted threads, not real-time transport).

**Alternatives considered**: WebSocket/SSE for messages (rejected — infra + Expo
complexity far beyond demo need; polling on focus is the platform norm).

## Decision 10: Frontend = two hidden screens + role-routed QuickLink

**Decision**: `app/(app)/mentorship.tsx` (student: search alumni, send request, my
requests, my pairs + thread) and `app/(app)/mentorship-manage.tsx` (alumni: profile
editor, incoming requests accept/decline, my pairs + thread), registered as hidden
`Tabs.Screen` entries (`href: null`), reached via a "Mentorship" QuickLink on the home
screen routing by `user?.role === 'ALUMNI'`.

**Rationale**: Exact pattern of challenges/challenges-manage (010 research Decision 7);
tab bar is already full. The message thread UI is shared between both screens as a
component since both roles use the identical pairs/messages endpoints.

**Alternatives considered**: third screen for the thread via route params (deferred —
inline expandable thread within the pair card is simpler and matches the expandable-card
idiom already used for leaderboards).
