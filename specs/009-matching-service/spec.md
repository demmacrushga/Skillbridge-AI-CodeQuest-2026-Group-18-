# Feature Specification: Matching Service

**Feature Branch**: `feat/matching-service`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "Matching service — match students to internship/job opportunities posted by recruiters. Recruiter posts a listing with required skills; the service scores skill alignment between the student's profile and each opportunity's requirements, returns a ranked match list per student, and tracks applications. Port 8006, schema `matching`, per docs/architecture.md, docs/api.md, docs/database.md."

## User Scenarios & Testing

### User Story 1 - Post an Opportunity (Priority: P1)

A recruiter creates an internship or entry-level job listing with a title, company name,
description, location, type, optional deadline, and a list of required skills (each marked
must-have or nice-to-have). The listing becomes visible to students immediately.

**Why this priority**: No other story is testable without opportunities in the system. This
is the data-ingestion path everything else depends on.

**Independent Test**: POST `/matching/opportunities` with a RECRUITER-role JWT and a valid
payload → receive 201 with the created opportunity including its `id` and `requiredSkills`.

**Acceptance Scenarios**:

1. **Given** an authenticated recruiter, **When** they POST to `/matching/opportunities`
   with a valid payload, **Then** the system returns 201 with the created opportunity,
   `active: true`, and all submitted fields persisted.

2. **Given** an authenticated STUDENT-role user, **When** they POST to
   `/matching/opportunities`, **Then** the system returns 403.

3. **Given** an authenticated recruiter, **When** they POST with a blank title, a blank
   description, an invalid `opportunityType` (including wrong case such as `"internship"`),
   or zero required skills, **Then** the system returns 400.

4. **Given** an unauthenticated request, **When** POSTing to `/matching/opportunities`,
   **Then** the system returns 401.

5. **Given** an authenticated recruiter, **When** they POST with an optional `externalUrl`
   (a valid http/https URL to the externally-hosted listing), **Then** the system returns
   201 with the `externalUrl` echoed; a malformed `externalUrl` returns 400.

---

### User Story 2 - View Ranked Matches (Priority: P1)

A student opens the opportunities screen and sees active, non-expired listings ranked by a
match score (0–100) computed from the overlap between the student's skills and each
opportunity's required skills, highest score first. Each entry shows the opportunity summary
and its score.

**Why this priority**: Core value-delivery moment — the student-facing reason the service
exists. P1 alongside US1; not testable until US1 exists.

**Independent Test**: With at least one active opportunity posted, GET `/matching/opportunities`
with a STUDENT JWT → receive 200 with a `matches` array ordered by `matchScore` descending,
each entry containing the opportunity summary, `matchScore` (0–100), and `rank`.

**Acceptance Scenarios**:

1. **Given** several active opportunities, **When** a student GETs `/matching/opportunities`,
   **Then** the system returns 200 with matches ordered by `matchScore` descending and
   `rank` starting at 1.

2. **Given** an opportunity whose deadline has passed or that has been deactivated,
   **When** a student GETs `/matching/opportunities`, **Then** that opportunity does not
   appear in the list.

3. **Given** no active opportunities, **When** a student GETs `/matching/opportunities`,
   **Then** the system returns 200 with an empty `matches` array.

4. **Given** a student whose skills exactly cover all of an opportunity's must-have skills,
   **When** matches are computed, **Then** that opportunity scores higher than an
   opportunity where must-have skills are missing.

5. **Given** a student with no skills on their matching profile, **When** they GET
   `/matching/opportunities`, **Then** every opportunity is returned with a defined
   minimum/zero score rather than an error.

---

### User Story 3 - Apply to an Opportunity (Priority: P1)

A student taps "Apply" on a matched opportunity. The system records the application and
confirms. Applying again to the same opportunity is rejected.

**Why this priority**: Completes the student loop — match → view → apply — which forms the
MVP together with US1 and US2.

**Independent Test**: POST `/matching/opportunities/{opportunityId}/apply` with a STUDENT
JWT → receive 201; repeating the same call → 409.

**Acceptance Scenarios**:

1. **Given** an active opportunity, **When** a student POSTs to
   `/matching/opportunities/{id}/apply`, **Then** the system returns 201 and the application
   is recorded with an `appliedAt` timestamp.

2. **Given** an opportunity the student already applied to, **When** they POST apply again,
   **Then** the system returns 409.

3. **Given** an opportunityId that does not exist or is inactive, **When** a student POSTs
   apply, **Then** the system returns 404.

4. **Given** an opportunity with an `externalUrl`, **When** a student POSTs apply, **Then**
   the system records the application exactly as for internal postings AND the response
   includes the `externalUrl` so the client can open the external listing.

---

### User Story 4 - View My Applications (Priority: P2)

A student views the list of opportunities they have applied to, with the opportunity summary
and application date, most recent first.

**Why this priority**: Depends on US3 producing data. Provides persistent value and closes
the loop on the student side.

**Independent Test**: GET `/matching/applications` with a STUDENT JWT → 200 array (possibly
empty) ordered by `appliedAt` descending.

**Acceptance Scenarios**:

1. **Given** a student with prior applications, **When** they GET `/matching/applications`,
   **Then** the system returns 200 with entries ordered newest-first, each containing the
   opportunity summary and `appliedAt`.

2. **Given** a student with no applications, **When** they GET `/matching/applications`,
   **Then** the system returns 200 with an empty array.

---

### User Story 5 - Manage Matching Skill Profile (Priority: P2)

A student maintains the skill list used for match scoring — adding and removing skills so
their match scores reflect their current abilities.

**Why this priority**: Match quality depends on current skills, but a first slice of US2 can
be built with a seeded or minimal skill set. The profile is matching-service-owned (FR-010).

**Independent Test**: Update the student's skill list, then GET `/matching/opportunities` →
scores reflect the updated skills.

**Acceptance Scenarios**:

1. **Given** a student, **When** they set their skill list to a new value, **Then**
   subsequent match requests score against the new list.

2. **Given** a student adds a skill that is a must-have for an active opportunity, **When**
   they re-fetch matches, **Then** that opportunity's score increases.

---

### User Story 6 - Manage Own Postings and View Applicants (Priority: P2)

A recruiter views the opportunities they have posted, can deactivate one so it no longer
appears in student matches, and can view the list of applicants to one of their own
postings (student identifier + applied date, newest first).

**Why this priority**: A real demo needs recruiter-side management, but the student loop
(US1–US3) delivers the core value independently.

**Independent Test**: GET `/matching/opportunities/mine` with a RECRUITER JWT → 200 array of
own postings; POST `/matching/opportunities/{id}/deactivate` → the listing disappears from
student matches; GET `/matching/opportunities/{id}/applications` → 200 array of applicants.

**Acceptance Scenarios**:

1. **Given** a recruiter with postings, **When** they GET their own postings, **Then** the
   system returns 200 with only that recruiter's postings, ordered newest-first.

2. **Given** a recruiter, **When** they deactivate one of their own postings, **Then** the
   posting no longer appears in student match results.

3. **Given** a posting with applicants, **When** the owning recruiter GETs its applications,
   **Then** the system returns 200 with one entry per applicant (student id, `appliedAt`)
   ordered newest-first; a posting with no applicants returns an empty array.

4. **Given** a postingId owned by a different recruiter, **When** a recruiter tries to view,
   deactivate, or list its applicants, **Then** the system returns 404 (no ownership
   leakage).

5. **Given** a STUDENT-role user, **When** they call any recruiter management endpoint,
   **Then** the system returns 403.

---

### Edge Cases

- **Opportunity with no required skills**: rejected at creation with 400 (FR-001) — a listing
  with no skill requirements gives every student the same meaningless score.
- **Duplicate application**: rejected with 409 (FR-006); applications are idempotent per
  student × opportunity.
- **Applying to an expired or inactive opportunity**: 404 (FR-006) — expired/inactive listings
  are treated as unavailable to students.
- **Deadline passes after posting**: opportunity is automatically excluded from match results;
  applications already recorded remain visible in the student's application history.
- **Student with empty skill profile**: match list still returns, with all scores at the
  defined floor (0.00), ordered by recency as the tie-break (FR-004) — never an error.
- **Identical scores**: tie-broken deterministically (most recently posted first) so repeated
  requests return a stable order.
- **Recruiter deactivates a posting students already applied to**: applications remain in
  students' history; the posting simply stops matching.
- **What if the student's skills change after matches were viewed?** Scores are computed at
  request time (FR-003) — the next fetch reflects the new profile immediately; no stale cache.
- **Recruiter edits needed after posting**: v1 has no edit endpoint — the correction path is
  deactivate + repost (documented assumption). Applications stay attached to the deactivated
  posting, preserving student history.
- **Recruiter views the student match list** (`GET /matching/opportunities` accepts any
  authenticated role): recruiters cannot hold a skill profile (FR-010 is STUDENT-only), so
  they receive all opportunities with floor scores ordered by recency — a deliberate,
  documented behavior, useful for browsing the board as students see it.
- **External listing goes stale on the company's side**: the platform does not validate
  external URLs after posting; the recruiter deactivates the posting as with internal ones.

## Requirements

### Functional Requirements

- **FR-001**: System MUST accept opportunity postings with `title` (non-blank, max 255),
  `companyName` (non-blank), `description` (non-blank), `location` (optional),
  `opportunityType` (INTERNSHIP | ENTRY_LEVEL, case-sensitive), `deadline` (optional date,
  today or future), `externalUrl` (optional, valid http/https URL, max 2048 — marks the
  listing as externally hosted), and `requiredSkills` (1–30 entries, each
  `{ skillName, required: boolean }`).
- **FR-002**: System MUST restrict opportunity creation (and any recruiter-management
  endpoints) to authenticated users with the RECRUITER role; all other roles receive 403.
- **FR-003**: System MUST compute a `matchScore` between 0.00 and 100.00 for a student ×
  opportunity pair from the overlap between the student's skills and the opportunity's
  required skills, weighting must-have (`required: true`) skills more heavily than
  nice-to-have skills. Scores MUST be deterministic: the same student profile and the same
  opportunity always produce the same score.
- **FR-004**: System MUST return matches ordered by `matchScore` descending, tie-broken by
  opportunity `createdAt` descending, with a 1-based `rank`.
- **FR-005**: System MUST exclude inactive opportunities and opportunities whose deadline
  has passed from student match results.
- **FR-006**: System MUST record an application on `POST .../apply`, return 409 on duplicate
  application, and 404 for unknown/inactive opportunity ids. When the opportunity has an
  `externalUrl`, the apply response MUST include it (the application is still recorded —
  click-tracking semantics — and the client opens the URL to complete the application on
  the external site).
- **FR-007**: System MUST return a student's applications ordered by `appliedAt` descending.
- **FR-008**: System MUST return 404 for any resource not owned by the requesting user
  (student applications, recruiter postings) — no ownership leakage.
- **FR-009**: System MUST expose `GET /matching/health` as a public endpoint.
- **FR-010**: System MUST store a matching-service-owned student skill profile (a list of
  skill names per student) and MUST use it as the sole source of student skills for match
  scoring. Students MUST be able to view their profile and replace their skill list (add
  and remove skills) through the API; an empty profile is valid and yields floor scores
  per the edge cases.
- **FR-011**: System MUST provide recruiter management endpoints: list own postings
  (newest-first), deactivate an own posting, and list applicants of an own posting
  (student id + `appliedAt`, newest-first). All are RECRUITER-role only (403 otherwise)
  and ownership-scoped (404 when not owned).
- **FR-012**: All error responses MUST use the uniform shape `{ "error": string, "status": number }`.
- **FR-013**: All endpoints except `/matching/health` MUST require a valid JWT Bearer token.

### Key Entities

- **Opportunity**: id (UUID), postedBy (recruiter user id), title, companyName, description,
  location (nullable), opportunityType (INTERNSHIP | ENTRY_LEVEL), deadline (nullable),
  externalUrl (nullable — externally-hosted listing), active, createdAt.
- **OpportunitySkill**: id (UUID), opportunityId (FK), skillName, required (must-have flag).
- **StudentMatch** (derived/cache): studentId, opportunityId, matchScore (0.00–100.00),
  generatedAt.
- **Application**: id (UUID), studentId, opportunityId (FK), appliedAt.
- **StudentSkillProfile**: studentId, list of skill names, updatedAt. Owned by the matching
  service; sole source of student skills for scoring.

## Success Criteria

- **SC-001**: A posted opportunity appears in student match results immediately (on the next
  match request, no manual re-indexing step).
- **SC-002**: Ranked match requests return within 5 seconds for up to 500 active
  opportunities.
- **SC-003**: All endpoints are covered by controller-slice and service unit tests.
- **SC-004**: JaCoCo line coverage ≥ 70%.
- **SC-005**: Service starts cleanly via `docker-compose up matching-service` with no
  migration errors.
- **SC-006**: Mobile app can complete the student loop end-to-end: view ranked matches →
  open an opportunity → apply → see it in "My Applications".
- **SC-007**: Match scores are explainable: given a student profile and an opportunity, the
  score can be reproduced by hand from the documented formula (deterministic scoring).

## Assumptions

- JWT secret is shared across all services; matching-service validates tokens locally and
  reads the `role` claim for RECRUITER enforcement.
- Career Readiness Score is not built yet — v1 ranks on skill alignment only; CRS can be
  folded into the score formula later without changing endpoint contracts.
- "Apply" records intent only — no cover letter, CV attachment, or external redirect in v1.
- No cross-service database access; the matching schema owns all its data (Constitution I).
- No notifications on new matches or applications in v1 (notification-service is unbuilt).
- Port 8006 is used (8001–8005 taken); nginx prefix `/matching/` per existing gateway
  conventions.
- Tests use `@WebMvcTest` with mocked services; no running PostgreSQL required.
- Match scores are computed at request time; the `student_matches` table (per
  docs/database.md) is an optional cache and not required for v1 correctness.
- v1 has no edit/update endpoint for postings — the correction path is deactivate + repost.
  A PATCH endpoint can be added later without breaking the contract.
- Match and list endpoints return the full eligible set (no pagination in v1); volume is
  bounded by SC-002 (500 active opportunities). Pagination can be added as a MINOR version
  bump if volume grows.
- External postings are manually created by recruiters via `externalUrl`; automated
  ingestion (scraping job boards, bulk import, admin-curated feeds) is out of scope for v1.
- External URLs are not re-validated after posting; stale external listings are handled by
  recruiter deactivation, same as internal ones.
