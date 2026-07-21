# Feature Specification: Notification Producers

**Feature Branch**: `feat/notification-producers`

**Created**: 2026-07-19

**Status**: Draft (blocked on 012-notification-service implementation)

**Input**: User description: "wire all the services into the notification service — challenge, mentorship, matching, and career services record notification events on notification-service's internal ingestion endpoint when notable things happen to a user, best-effort and never blocking the business operation."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Student Notified When Their Submission Is Scored (Priority: P1)

A recruiter scores a student's challenge submission; the student gets a notification — in their inbox and, if eligible, as a push — telling them their score and pointing them at the leaderboard.

**Why this priority**: The single highest-value event (a score landing is the payoff moment of the challenge loop), and the simplest producer — one call site. It proves the whole producer pattern first.

**Independent Test**: Score a submission via `POST /challenge/{id}/submissions/{sid}/score` → within one inbox fetch, the student's `GET /notification` shows a `CHALLENGE_SCORED` entry.

**Acceptance Scenarios**:

1. **Given** a scored submission, **When** the recruiter assigns a score, **Then** a `CHALLENGE_SCORED` notification is recorded for the submitting student carrying the challenge title and the score.
2. **Given** notification-service is down or unreachable, **When** the recruiter scores, **Then** scoring still succeeds exactly as today (200, score persisted) — the missed notification is logged and dropped.
3. **Given** a recruiter re-scores the same submission, **When** the new score is saved, **Then** a new notification is recorded (revised score = genuinely new information; documented behaviour).

---

### User Story 2 - Mentorship Lifecycle Notifications (Priority: P1)

An alumnus is told when a student requests their mentorship; the student is told when the alumnus accepts or declines; and each side is told when the other sends a message.

**Why this priority**: Mentorship is the platform's most conversational feature — without notifications, both sides must poll screens to notice anything happened.

**Independent Test**: Send a request → the alumnus's inbox gains `MENTORSHIP_REQUEST_RECEIVED`; accept it → the student's inbox gains `MENTORSHIP_REQUEST_ACCEPTED`; send a message → the counterpart's inbox gains `MENTORSHIP_MESSAGE`.

**Acceptance Scenarios**:

1. **Given** a student sends a mentorship request, **Then** the target alumnus gets `MENTORSHIP_REQUEST_RECEIVED`.
2. **Given** the alumnus accepts, **Then** the student gets `MENTORSHIP_REQUEST_ACCEPTED`; **Given** they decline, **Then** the student gets `MENTORSHIP_REQUEST_DECLINED`.
3. **Given** either participant sends a message, **Then** the *other* participant (never the sender) gets `MENTORSHIP_MESSAGE` with a preview of at most 120 characters of the body.
4. **Given** a student cancels their own pending request, **Then** no notification is sent to anyone (the alumnus never acted; notifying is noise).
5. **Given** notification-service is unavailable, **Then** every mentorship operation succeeds unchanged.

---

### User Story 3 - Students Notified of Matching Opportunities (Priority: P2)

A recruiter posts a new opportunity; every student whose skill profile scores at least 50.00 against it is notified that a matching opportunity exists.

**Why this priority**: High value but the only fan-out producer (one event → many recipients) — riskiest, so it lands after the single-recipient pattern is proven.

**Independent Test**: With two students — one whose skills score ≥ 50 against a new posting and one below — post the opportunity → only the first student's inbox gains `OPPORTUNITY_MATCH` with the computed percentage.

**Acceptance Scenarios**:

1. **Given** students with stored skill profiles, **When** a recruiter posts an opportunity, **Then** each student scoring ≥ 50.00 against it gets one `OPPORTUNITY_MATCH` notification carrying the title, company, and their personal match percentage.
2. **Given** a student scoring below 50.00 (or with no skills), **Then** they get nothing.
3. **Given** more than 100 students qualify, **Then** only the 100 highest-scoring are notified (documented safety cap); the count skipped is logged.
4. **Given** notification-service is unavailable mid-fan-out, **Then** posting still succeeds and remaining sends are dropped with a log — never retried, never blocking.

---

### User Story 4 - Roadmap Milestone Celebration (Priority: P3)

A student completes a roadmap milestone and gets a congratulatory notification with their updated progress percentage.

**Why this priority**: Nice-to-have motivational touch; career-service predates the platform's current build pattern, so this producer needs reconnaissance first and is the natural last slice — shippable independently or cut without affecting the others.

**Independent Test**: Complete a milestone via career-service's existing endpoint → the student's inbox gains `ROADMAP_MILESTONE` with the milestone title and progress percentage.

**Acceptance Scenarios**:

1. **Given** a student completes a milestone, **Then** they get `ROADMAP_MILESTONE` with the milestone title and their roadmap progress percentage.
2. **Given** notification-service is unavailable, **Then** milestone completion succeeds unchanged.

---

### Edge Cases

- **notification-service down/slow/erroring**: every producer treats notification as strictly best-effort — bounded timeout, one warning log, business operation entirely unaffected (FR-002). No retries or queues in v1.
- **Notification config absent** (`NOTIFICATION_URL` unset): the producer's client becomes a no-op with a single startup log — every service still runs standalone (FR-003).
- **Re-scored submission**: notifies again by design (US1 AC3).
- **Cancelled mentorship request**: silent by design (US2 AC4).
- **Fan-out over-trigger**: matching's producer is bounded — threshold 50.00, cap 100 recipients per posting (US3 AC3); both constants documented in the producer catalog.
- **Sender self-notification**: never — mentorship messages notify only the counterpart; no producer ever notifies the acting user about their own action.
- **No hard startup dependency**: producers do NOT declare `depends_on: notification-service` — a notification outage must never prevent a producer from starting (failure isolation).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each producer service (challenge, mentorship, matching, career) MUST record notification events on notification-service's internal ingestion endpoint, authenticated with the shared internal service credential, exactly at the trigger points and with the recipients/types/content defined in the producer catalog (`contracts/producer-catalog.md`).
- **FR-002**: Notification recording MUST be best-effort and non-blocking: a bounded timeout (≤ 2 seconds), all failures caught and logged as warnings, and the triggering business operation's outcome, latency class, and response unchanged by any notification failure.
- **FR-003**: Each producer MUST degrade to a logged no-op when notification configuration is absent, so every service remains independently runnable.
- **FR-004**: A producer MUST never notify the acting user about their own action — recipients are always the *other* party (or parties) affected.
- **FR-005**: Matching's opportunity fan-out MUST notify only students scoring ≥ 50.00 against the new posting, capped at the 100 highest-scoring recipients, computed from matching-service's own data (no cross-service reads).
- **FR-006**: Notification content MUST NOT include free-text message bodies beyond a 120-character preview (mentorship messages) and MUST NOT include any data the recipient couldn't already see in the source service.
- **FR-007**: Every producer's happy path and its failure-isolation behaviour (throwing notification client → operation still succeeds) MUST be covered by unit tests in that producer's own suite.

### Key Entities

No new persisted entities. Each producer gains one `NotificationClient` (copied per the platform's copy-not-share convention) and configuration (`NOTIFICATION_URL`, `INTERNAL_SERVICE_TOKEN`). The event vocabulary is `notification-service`'s existing `NotificationType` enum — this feature adds no new types.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After scoring, requesting, responding, messaging, or posting a qualifying opportunity, the affected user's inbox shows the notification on their very next fetch.
- **SC-002**: With notification-service completely stopped, every producer operation's success rate and response time are unchanged from feature-less baseline (hand-verifiable via quickstart: stop the container, run each flow).
- **SC-003**: Each producer's test suite passes with the notification client both mocked-happy and mocked-throwing; overall coverage stays ≥ 70% per service.
- **SC-004**: A full demo loop works end-to-end on mobile: recruiter scores → student's bell badges within one app-focus; alumnus accepts → student sees it; message sent → counterpart badges.
- **SC-005**: Opportunity fan-out with 100 students and 30 skills each completes within the posting request's existing 5-second budget.

## Assumptions

- **Hard dependency**: feature 012 (notification-service) must be implemented and deployed first — this feature has no meaning without its ingestion endpoint. Build order: 012 → 013.
- The 50.00 fan-out threshold and 100-recipient cap are v1 constants chosen for demo signal-to-noise; both are named constants, changeable without contract impact.
- Career-service predates the current build pattern; its exact milestone-completion call site is confirmed during planning reconnaissance. If it proves structurally awkward, US4 is cut from v1 without affecting US1–US3 (independent slices).
- `NotificationClient` is copied into each producer rather than shared as a library — consistent with the platform's existing copy-not-share scaffolding convention (JWT filters, correlation filter).
- No producer `depends_on` notification-service in docker-compose, and no message broker — direct best-effort HTTP per architecture.md's v1 posture; broker-based delivery is the v2 path.
- Notification bodies use the recipient's existing visibility: e.g. the mentorship message preview goes to the thread's other participant who could read it anyway; no PII beyond that ever leaves a producer.
- Frontend requires no changes — feature 012's bell/inbox surface displays whatever arrives.
