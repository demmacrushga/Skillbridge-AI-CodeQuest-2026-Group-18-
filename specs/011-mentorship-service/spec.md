# Feature Specification: Mentorship Service

**Feature Branch**: `feat/mentorship-service`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "for the mentorship service — alumni-student matching and in-platform communication. Alumni maintain a mentor profile with career interests; students search for alumni by interest/sector and send a mentorship request; the alumni accepts or declines; an accepted request becomes an active mentorship pair; paired student and alumni exchange in-platform messages; either side can end the mentorship. Port 8008, schema `mentorship`, per docs/architecture.md, docs/api.md, docs/database.md."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Maintain a Mentor Profile (Priority: P1)

An alumnus/alumna sets up their mentor profile: current role, company, industry, a handful of career-interest tags (e.g. "backend engineering", "fintech", "product management"), a short bio, and whether they're currently available to take on new mentees.

**Why this priority**: Nothing else in the service is testable without at least one mentor profile to discover and request. This is the data-ingestion path everything else depends on.

**Independent Test**: `PUT /mentorship/profile` with an ALUMNI-role JWT and a valid payload → 200 with the stored profile; `GET /mentorship/profile` returns the same data back.

**Acceptance Scenarios**:

1. **Given** an authenticated alumnus with no profile yet, **When** they PUT a valid profile, **Then** the system creates it and returns 200 with all fields persisted, `available: true` by default.
2. **Given** an authenticated alumnus with an existing profile, **When** they PUT an updated profile, **Then** the system replaces the stored profile (upsert) and returns 200 with the new values.
3. **Given** an authenticated STUDENT-role user, **When** they PUT to `/mentorship/profile`, **Then** the system returns 403.
4. **Given** an alumnus, **When** they PUT a profile with a blank bio field omitted, blank `currentRole`/`company`/`industry` fields omitted, or no career-interest tags, **Then** the system accepts it (only `careerInterests` non-empty is required — see Requirements) or returns 400 for the specific violated field.
5. **Given** an unauthenticated request, **When** calling either profile endpoint, **Then** the system returns 401.

---

### User Story 2 - Discover Alumni (Priority: P1)

A student opens the mentorship screen and searches for alumni who match their career interests and, optionally, a specific industry. Results show only alumni currently marked available, ranked so the best-matching profiles surface first.

**Why this priority**: The student-facing discovery moment — the reason the service exists. P1 alongside US1; not testable until at least one profile exists.

**Independent Test**: With at least one available alumni profile posted, `GET /mentorship/alumni?interest=fintech` with a STUDENT JWT → 200 with an array of matching profiles, best match first.

**Acceptance Scenarios**:

1. **Given** several available alumni profiles with overlapping and non-overlapping interest tags, **When** a student searches by one or more interest tags, **Then** the system returns available profiles ordered by number of matching tags (descending), most-recently-updated first as the tie-break.
2. **Given** no interest or sector filter is supplied, **When** a student browses, **Then** the system returns every available alumni profile ordered by most-recently-updated first.
3. **Given** an alumnus who has set `available: false`, **When** a student searches, **Then** that alumnus never appears in results, regardless of tag overlap.
4. **Given** no alumni match the given filters, **When** a student searches, **Then** the system returns 200 with an empty array.
5. **Given** a RECRUITER- or ADMIN-role user, **When** they call the search endpoint, **Then** the system returns 403 — discovery is a student-only capability.
6. **Given** an unauthenticated request, **When** searching, **Then** the system returns 401.

---

### User Story 3 - Send a Mentorship Request (Priority: P1)

A student finds an alumnus they'd like guidance from and sends a mentorship request, with an optional short introductory note. The alumnus can later accept or decline it.

**Why this priority**: Completes the student-side MVP loop — discover → request — alongside US1 and US2.

**Independent Test**: `POST /mentorship/requests` with a STUDENT JWT and a valid `alumniId` → 201 with the request in `PENDING` status; repeating the same call while it's still pending → 409.

**Acceptance Scenarios**:

1. **Given** an available alumnus with no existing pending request or active pair with this student, **When** the student POSTs a request, **Then** the system returns 201 with the request `PENDING`, `createdAt` set.
2. **Given** a student who already has a `PENDING` request or an `ACTIVE` pair with the same alumnus, **When** they POST another request to that alumnus, **Then** the system returns 409.
3. **Given** an `alumniId` that doesn't exist or belongs to an unavailable (or non-alumni) profile, **When** a student POSTs a request, **Then** the system returns 404.
4. **Given** a request body with an introductory note over the allowed length, **When** a student POSTs it, **Then** the system returns 400.
5. **Given** an ALUMNI- or RECRUITER-role user, **When** they POST to `/mentorship/requests`, **Then** the system returns 403.

6. **Given** a student's own request still `PENDING`, **When** the student cancels it, **Then** the system marks it `CANCELLED` and returns 200; the student may immediately send a new request to the same alumnus.

7. **Given** a request that has already been accepted, declined, or cancelled, **When** the student tries to cancel it, **Then** the system returns 409; **Given** a request sent by a different student (or an unknown id), **Then** the system returns 404.

---

### User Story 4 - Respond to a Request (Priority: P2)

An alumnus reviews the mentorship requests they've received and accepts or declines each one. Accepting turns the request into an active mentorship pair; declining closes it without creating a pair. The student can send a new request to the same alumnus later if declined.

**Why this priority**: Depends on US3 producing requests. This is what turns interest into an actual mentorship relationship.

**Independent Test**: `GET /mentorship/requests/incoming` with the target ALUMNI JWT → 200 array of pending requests; `POST /mentorship/requests/{requestId}/accept` → 200, and a corresponding active pair now shows up in `GET /mentorship/pairs/mine` for both participants.

**Acceptance Scenarios**:

1. **Given** an alumnus with pending incoming requests, **When** they GET `/mentorship/requests/incoming`, **Then** the system returns 200 with only requests addressed to them, newest-first.
2. **Given** a pending request addressed to the alumnus, **When** they POST accept, **Then** the system marks the request `ACCEPTED`, creates a new `ACTIVE` mentorship pair between the two, and returns 200 with the pair.
3. **Given** a pending request addressed to the alumnus, **When** they POST decline, **Then** the system marks the request `DECLINED`, creates no pair, and returns 200; the same student may send a new request to the same alumnus afterward.
4. **Given** a request that has already been accepted or declined, **When** the alumnus tries to accept or decline it again, **Then** the system returns 409.
5. **Given** a request addressed to a different alumnus (or an unknown request id), **When** an alumnus tries to accept or decline it, **Then** the system returns 404 (no ownership leakage).
6. **Given** a STUDENT-role user, **When** they call either response endpoint, **Then** the system returns 403.

---

### User Story 5 - Message a Mentor/Mentee (Priority: P2)

Once paired, a student and their mentor exchange messages inside the app — no external email or phone number needed.

**Why this priority**: The actual value delivered once a mentorship starts, but it only has content once US4 produces an active pair.

**Independent Test**: With an active pair, `POST /mentorship/pairs/{pairId}/messages` from either participant with a non-blank body → 201; `GET /mentorship/pairs/{pairId}/messages` from either participant → 200 with the full thread, oldest first.

**Acceptance Scenarios**:

1. **Given** an active pair, **When** either participant POSTs a message with a non-blank body, **Then** the system returns 201 with the message recorded, `sentAt` set, `readAt` null.
2. **Given** an active pair with existing messages, **When** a participant GETs the thread, **Then** the system returns 200 with all messages ordered oldest-first, and marks as read every message in that thread that was sent *to* the caller and not yet read.
3. **Given** a pair that has been ended, **When** either former participant tries to POST a new message, **Then** the system returns 409; the existing thread remains fully readable via GET.
4. **Given** a user who is not a participant in the pair, **When** they try to GET or POST to its message thread, **Then** the system returns 404 (no ownership leakage).
5. **Given** a message body that is blank or exceeds the maximum length, **When** a participant POSTs it, **Then** the system returns 400.

---

### User Story 6 - Manage My Mentorships (Priority: P2)

Both students and alumni can see an overview of their own mentorship relationships — active and previously ended — and either side can end an active mentorship when it's run its course.

**Why this priority**: Lifecycle management around the core loop (US1–US5); useful but the messaging value already lands without it.

**Independent Test**: `GET /mentorship/pairs/mine` with either participant's JWT → 200 array of that user's pairs; `POST /mentorship/pairs/{pairId}/end` → 200 with `status: ENDED`.

**Acceptance Scenarios**:

1. **Given** a user with prior and current mentorships, **When** they GET `/mentorship/pairs/mine`, **Then** the system returns 200 with all their pairs (active and ended), newest-first.
2. **Given** an active pair, **When** either participant POSTs end, **Then** the system returns 200 with `status: ENDED` and `endedAt` set; the pair's message history remains intact and viewable.
3. **Given** an already-ended pair, **When** a participant POSTs end again, **Then** the system returns 200 unchanged (idempotent).
4. **Given** a user who is not a participant in the pair, **When** they try to end it, **Then** the system returns 404.
5. **Given** a student, **When** they GET `/mentorship/requests/mine`, **Then** the system returns 200 with every request they've sent, newest-first, each showing its current status (`PENDING`, `ACCEPTED`, `DECLINED`, or `CANCELLED`).

---

### Edge Cases

- **Alumnus turns off availability while mentoring someone**: existing active pairs and their message threads are completely unaffected; the alumnus simply stops appearing in new student searches and stops accepting new requests (FR-003, FR-006).
- **Duplicate request while one is already pending or paired**: rejected with 409 — a student cannot stack multiple simultaneous requests/pairs with the same alumnus (FR-005).
- **Requesting an unavailable or nonexistent alumnus**: 404 in both cases — a caller cannot distinguish "doesn't exist" from "not currently available" (FR-006).
- **Responding to a request that isn't yours, or that's already resolved**: 404 for wrong ownership, 409 for already-resolved — ownership is never revealed through error differentiation (FR-008).
- **Declined request**: does not block the student from requesting the same alumnus again later — no cooldown in v1 (FR-007).
- **Unanswered request**: there is no expiry — a `PENDING` request stays pending until the alumnus responds or the student cancels it (FR-007a). Cancelling frees the student to re-request the same alumnus, so an unresponsive alumnus can never permanently lock the route.
- **Cancelling a resolved request, or someone else's**: 409 for already accepted/declined/cancelled; 404 when the request wasn't sent by the caller (no ownership leakage, FR-008).
- **Messaging after the mentorship ends**: blocked with 409; history is preserved and remains fully readable (FR-012).
- **Reading a thread you're not part of, or one that doesn't exist**: 404 (FR-011).
- **Ending an already-ended pair**: idempotent 200, not an error (FR-013).
- **Search with no filters supplied**: returns every available profile, most-recently-updated first, not an error or empty result (FR-003).
- **Interest tag matching**: case-insensitive exact string match against the alumnus's tags — no fuzzy matching or controlled vocabulary in v1 (see Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let an authenticated ALUMNI-role user create or replace (upsert) their own mentor profile: `currentRole`, `company`, `industry` (all optional, max 150 chars each), `careerInterests` (required, 1–20 tags, each max 50 chars), `bio` (optional, max 2,000 chars), defaulting `available` to `true` on first creation — and retrieve their own stored profile (404 when none has been created yet).
- **FR-002**: System MUST restrict profile creation/update to the ALUMNI role and restrict alumni search/request-sending to the STUDENT role; all other roles receive 403 on those endpoints.
- **FR-003**: System MUST let any authenticated STUDENT search alumni profiles, filterable by one or more career-interest tags and/or an industry, returning only profiles with `available: true`, ranked by number of matching interest tags descending, tied-broken by most-recently-updated first; an empty filter returns all available profiles in the same tie-break order.
- **FR-004**: System MUST let a STUDENT send a mentorship request to a specific alumni profile, with an optional introductory note (max 1,000 chars), only when that alumni profile exists and is currently available.
- **FR-005**: System MUST reject a new request (409) when the requesting student already has a `PENDING` request or an `ACTIVE` pair with the same alumnus.
- **FR-006**: System MUST return 404 when a student requests an `alumniId` that does not exist or is not currently available.
- **FR-007**: System MUST allow a student to send a new request to an alumnus after a prior request to them was `DECLINED` or `CANCELLED` — no cooldown or permanent block.
- **FR-007a**: System MUST let a student cancel their own `PENDING` request, marking it `CANCELLED` and recording `respondedAt`; cancelling a request that is already accepted, declined, or cancelled returns 409, and cancelling a request sent by a different student (or an unknown id) returns 404. Requests never expire automatically — cancellation is the only student-side exit from `PENDING`.
- **FR-008**: System MUST let the target alumnus view their own incoming `PENDING` requests (newest-first) and accept or decline each one; accepting creates a new `ACTIVE` mentorship pair and marks the request `ACCEPTED`; declining marks it `DECLINED` and creates no pair. Both actions MUST return 404 if the request does not belong to the calling alumnus (or doesn't exist), and 409 if the request has already been accepted or declined.
- **FR-009**: System MUST let a STUDENT view every request they've sent (newest-first, with current status) via a "my requests" endpoint.
- **FR-010**: System MUST let either participant of a mentorship pair view all their own pairs (active and ended, newest-first) via a "my pairs" endpoint. The endpoint accepts any authenticated role and scopes strictly by the caller's user id — a caller with no pairs (including RECRUITER/ADMIN roles, who can never be participants) receives 200 with an empty list, not 403.
- **FR-011**: System MUST let either participant of an `ACTIVE` pair post and read messages within that pair's thread (oldest-first); any user who is not a participant in the pair MUST receive 404 attempting to read or post to it.
- **FR-012**: System MUST reject new messages (409) once a pair's status is `ENDED`, while keeping the existing message thread fully readable by its former participants.
- **FR-013**: System MUST let either participant end an `ACTIVE` pair, setting its status to `ENDED` and recording `endedAt`; ending an already-`ENDED` pair MUST be idempotent (200, unchanged). Ending a pair MUST NOT delete or hide its message history.
- **FR-014**: System MUST mark a message as read (set `readAt`) whenever the thread is retrieved by the participant it was sent to, if it isn't already marked read.
- **FR-015**: System MUST expose `GET /mentorship/health` as a public endpoint.
- **FR-016**: All error responses MUST use the uniform shape `{ "error": string, "status": number }`.
- **FR-017**: All endpoints except `/mentorship/health` MUST require a valid JWT Bearer token.

### Key Entities

- **AlumniProfile**: id (UUID), userId (the alumnus, from the JWT), currentRole, company, industry, careerInterests (list of tags), bio, available (bool, default true), updatedAt. One profile per alumnus (upsert, not append).
- **MentorshipRequest**: id (UUID), studentId, alumniId, message (optional intro note), status (`PENDING` / `ACCEPTED` / `DECLINED` / `CANCELLED`), createdAt, respondedAt (set when accepted, declined, or cancelled).
- **MentorshipPair**: id (UUID), studentId, alumniId, requestId (the accepted request that created it), status (`ACTIVE` / `ENDED`), startedAt, endedAt (nullable).
- **Message**: id (UUID), pairId (FK), senderId, body, sentAt, readAt (nullable, set once the recipient views the thread).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A newly created or updated alumni profile is discoverable by students on the very next search request — no manual re-indexing step.
- **SC-002**: Search, request, and messaging requests return within 5 seconds for up to 300 alumni profiles and up to 50 messages within a single pair's thread.
- **SC-003**: All endpoints are covered by controller-slice and service unit tests.
- **SC-004**: Test line coverage of ≥ 70%, consistent with the platform's coverage standard.
- **SC-005**: Service starts cleanly via `docker-compose up mentorship-service` with no migration errors.
- **SC-006**: A student can complete the full journey end-to-end: search alumni by interest → send a request → (as the alumnus) accept it → exchange messages → either side ends the mentorship.
- **SC-007**: Alumni search ranking is explainable — given the same filters and profile data, the result order can be reproduced by hand from the documented rule (matching-tag count descending, then most-recently-updated).

## Assumptions

- Port 8008 and PostgreSQL schema `mentorship`, per `docs/architecture.md`; nginx prefix `/mentorship/` follows the existing gateway convention (`/matching/`, `/challenge/`, etc.).
- The `STUDENT` and `ALUMNI` roles already exist in the platform's JWT `role` claim (per `docs/architecture.md`'s Roles table); this service performs no account or role management of its own — that remains entirely in auth-service.
- `docs/database.md`'s existing schema sketch for this service lists `alumni_profiles`, `mentorship_pairs`, and `messages`, but not a requests table, even though `docs/architecture.md` names "mentorship request sending and acceptance" as a core responsibility and lists `mentorship_requests` among the data this service owns. v1 adds a `mentorship_requests` table (see Key Entities) to hold the pending/accepted/declined lifecycle before a pair exists; `docs/database.md` will be updated to match during planning.
- No hard cap on the number of concurrent active mentorships for either a student or an alumnus in v1 — alumni self-regulate their load using the `available` toggle rather than a system-enforced limit.
- Career-interest tags are free-text strings the alumnus enters (no controlled vocabulary/taxonomy in v1); a student's search filter matches them by exact, case-insensitive string comparison.
- Messaging is in-platform text only — no attachments, no push notifications on new messages or requests (notification-service is unbuilt), and no typing indicators or delivery receipts beyond the single `readAt` timestamp.
- No AI is involved anywhere in this service. Alumni discovery ranking is a deterministic tag-overlap count, consistent with the non-AI, hand-verifiable scoring already established by matching-service and challenge-service.
- List endpoints (search, incoming requests, my requests, my pairs, message threads) return the full eligible set with no pagination in v1, bounded by SC-002's volume assumption.
- JWT secret is shared platform-wide; mentorship-service validates tokens locally and reads the `role` claim for STUDENT/ALUMNI enforcement, the same as every other service.
- Tests use `@WebMvcTest` with mocked services; no running PostgreSQL required for the unit/controller-slice test suite.
