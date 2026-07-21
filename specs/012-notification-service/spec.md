# Feature Specification: Notification Service

**Feature Branch**: `feat/notification-service`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "for the notification service — push notifications and in-app alerts across all user types. Other platform services record notification events for a user; the user sees them in an in-app inbox with unread tracking, receives a push notification on their device when they've registered one and their preferences allow it, and can mute notification types or turn push off entirely. Port 8009, schema `notification`, per docs/architecture.md, docs/api.md, docs/database.md."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See My Notifications (Priority: P1)

Any signed-in user opens their notification inbox and sees everything the platform has notified them about — a recruiter scored their challenge submission, an alumnus accepted their mentorship request, a new message arrived — newest first, each clearly marked read or unread, with an unread count the app can badge its bell icon with.

**Why this priority**: The inbox is the product — every other capability (ingestion, push, preferences) only matters because this screen exists. Testable with directly-seeded data before any producer wiring exists.

**Independent Test**: With notifications recorded for a user, `GET /notification` with that user's JWT → 200 list newest-first with `read` flags; `GET /notification/unread-count` → correct count.

**Acceptance Scenarios**:

1. **Given** a user with recorded notifications, **When** they GET their inbox, **Then** the system returns 200 with their notifications ordered newest-first, each carrying type, title, body, read state, and creation time.
2. **Given** notifications belonging to other users, **When** a user GETs their inbox, **Then** none of those appear — the inbox is strictly scoped to the caller.
3. **Given** a user with no notifications, **When** they GET their inbox, **Then** the system returns 200 with an empty list.
4. **Given** a mix of read and unread notifications, **When** the user GETs the unread count, **Then** the system returns the number of unread ones only.
5. **Given** an unauthenticated request, **When** calling any inbox endpoint, **Then** the system returns 401.

---

### User Story 2 - Mark Notifications Read (Priority: P1)

A user taps a notification and it stops counting as unread; a "mark all read" action clears the whole badge at once.

**Why this priority**: Read-state is what makes an inbox usable; without it the badge never clears. P1 with US1 — they're one screen.

**Independent Test**: `POST /notification/{id}/read` → 200 with `read: true`; `POST /notification/read-all` → 200, unread count drops to 0.

**Acceptance Scenarios**:

1. **Given** an unread notification belonging to the caller, **When** they mark it read, **Then** the system returns 200 with `read: true` and the unread count decreases by one.
2. **Given** an already-read notification, **When** the caller marks it read again, **Then** the system returns 200 unchanged (idempotent).
3. **Given** a notification belonging to a different user (or an unknown id), **When** a caller tries to mark it read, **Then** the system returns 404 (no ownership leakage).
4. **Given** several unread notifications, **When** the caller marks all read, **Then** the system returns 200 and the unread count becomes 0; running it again is harmless.

---

### User Story 3 - Services Record Notifications (Priority: P1)

Another platform service (challenge, mentorship, matching, career) records a notification for a specific user — for example, "Your submission was scored: 85.50" when a recruiter scores a challenge submission. The notification appears in that user's inbox immediately and triggers a push attempt if eligible.

**Why this priority**: The ingestion path is what fills the inbox in production. P1 alongside US1/US2 — together they form the MVP.

**Independent Test**: POST to the internal ingestion endpoint with a valid service credential and a payload (userId, type, title, body) → 201; the notification appears in that user's inbox.

**Acceptance Scenarios**:

1. **Given** a valid internal service credential, **When** a producer POSTs a notification event with a target user, a known type, a title, and a body, **Then** the system returns 201 and the notification appears in that user's inbox as unread.
2. **Given** a request without a valid service credential, **When** POSTing to the ingestion endpoint, **Then** the system returns 401 — end-user tokens are not accepted on this endpoint.
3. **Given** a payload with a missing/blank title or body, an unknown type, or no target user, **When** POSTing, **Then** the system returns 400.
4. **Given** a target user who has muted that notification type, **When** a producer POSTs it, **Then** the system still returns 201 and stores it in the inbox, but sends no push (preferences govern push, not in-app storage — see Key Entities).

---

### User Story 4 - Receive Push Notifications (Priority: P2)

A user who has the mobile app installed receives a push notification on their device when something notable happens — even with the app closed. Opening the notification takes them into the app.

**Why this priority**: The highest-value delivery channel, but it strictly depends on US3's ingestion and US5's token registration, and the platform is fully usable without it (in-app inbox works regardless).

**Independent Test**: With a registered, active push token and default preferences, ingest a notification for that user → a push delivery attempt is made to the push provider for that token; with push disabled in preferences, no attempt is made.

**Acceptance Scenarios**:

1. **Given** a user with an active registered device token and push enabled, **When** a notification is ingested for them, **Then** a push delivery attempt is made carrying the notification's title and body.
2. **Given** a user with no registered device token, **When** a notification is ingested, **Then** it is stored in the inbox and no push attempt is made — never an error.
3. **Given** a user who disabled push globally or muted that type, **When** a notification is ingested, **Then** it is stored and no push attempt is made.
4. **Given** the push provider is unreachable or rejects the send, **When** a notification is ingested, **Then** ingestion still succeeds (201) and the notification is stored — push is best-effort and never blocks or fails the recording.
5. **Given** the push provider reports a token as invalid/expired, **When** a push attempt fails that way, **Then** the token is deactivated so it isn't retried on future notifications.

---

### User Story 5 - Manage My Devices (Priority: P2)

When a user signs in on a device, the app registers that device for push. When they sign out, the app removes it so the device stops receiving that account's notifications.

**Why this priority**: Prerequisite plumbing for US4; meaningless standalone but small.

**Independent Test**: `POST /notification/push-tokens` with a device token → 201; repeating with the same token → 200 (idempotent re-registration); `DELETE /notification/push-tokens` with the token → 204.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** the app registers a device push token, **Then** the system returns 201 and the token is active for that user.
2. **Given** the same token registered again by the same user, **When** the app re-registers it (e.g. app reinstall, token refresh), **Then** the system returns 200 and keeps exactly one active record (idempotent).
3. **Given** a token previously registered to a different user account, **When** a new user registers it (shared device, new sign-in), **Then** the token is reassigned to the new user — a device only ever receives the current account's notifications.
4. **Given** a signed-out flow, **When** the app deletes the token, **Then** the system returns 204 and no further pushes go to that device; deleting an unknown token also returns 204 (idempotent).
5. **Given** a malformed or blank token value, **When** registering, **Then** the system returns 400.

---

### User Story 6 - Control My Notification Preferences (Priority: P2)

A user opens notification settings and turns push off entirely, or mutes specific notification types they don't care about (e.g. keep mentorship messages, mute challenge leaderboard updates). Muting affects only future push delivery — the in-app inbox always receives everything.

**Why this priority**: User control and notification hygiene; depends on the delivery machinery existing first.

**Independent Test**: `GET /notification/preferences` → 200 defaults (push on, nothing muted); `PUT /notification/preferences` with `pushEnabled: false` → 200; subsequent ingestion stores but doesn't push.

**Acceptance Scenarios**:

1. **Given** a user who has never touched settings, **When** they GET preferences, **Then** the system returns 200 with defaults: push enabled, no types muted.
2. **Given** a user, **When** they PUT preferences with `pushEnabled: false` or a list of muted types, **Then** the system returns 200 with the stored preferences, and future ingestion honours them for push decisions.
3. **Given** an unknown type name in the muted list, **When** PUTting preferences, **Then** the system returns 400.
4. **Given** updated preferences, **When** the user GETs preferences again, **Then** the stored values are returned exactly (full-replace semantics, same as other platform settings).

---

### Edge Cases

- **Producer records a notification for a nonexistent user id**: accepted (201) — this service cannot verify user existence (no cross-schema reads); the notification is simply never fetched. Documented as an accepted trade-off of service autonomy.
- **Push token registered but user never gets notifications**: nothing happens — tokens are passive until an ingestion event targets that user.
- **Same device, two accounts over time**: registration reassigns the token to the latest account (US5 AC3), so the previous account silently stops reaching that device.
- **Push provider outage**: ingestion is never blocked; notifications accumulate in the inbox and only the push attempt is skipped/failed silently (logged for observability).
- **Invalid/expired token discovered at send time**: deactivated automatically (US4 AC5); the user re-registers naturally on next app launch.
- **Marking read races with reading the list**: read-state writes are idempotent; double-taps and repeated mark-all-read calls are harmless.
- **Unread count vs. list drift**: the count endpoint computes from the same store as the list — no separately-maintained counter to drift. The count covers all stored notifications, so with more than 100 unread it can legitimately exceed what the capped list shows; mark-all-read clears the invisible remainder.
- **Muted type arrives**: stored unread in the inbox, no push (US3 AC4) — muting is a push filter, not an inbox filter.
- **Huge inbox**: list returns the most recent 100 notifications in v1 (see Assumptions) — the platform's first bounded list, since notifications accumulate indefinitely unlike other entities.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let any authenticated user list their own notifications, newest first, each with type, title, body, read flag, and creation time, limited to the most recent 100; other users' notifications MUST never be visible.
- **FR-002**: System MUST expose the caller's unread notification count, computed over **all** their stored notifications (not just the 100 the list shows) from the same store as the list — no separately-maintained counter. When unread notifications exist beyond the list cap, the count may exceed what the list displays; mark-all-read (FR-003) is the path that clears them.
- **FR-003**: System MUST let the owner mark a single notification read (idempotent 200; 404 for another user's or unknown id — no ownership leakage) and mark all their notifications read in one call (idempotent).
- **FR-004**: System MUST accept notification events from platform services on an internal ingestion endpoint authenticated by a shared service credential distinct from end-user tokens; end-user tokens MUST be rejected (401) on that endpoint.
- **FR-005**: Ingestion payloads MUST carry a target user id, a type from the platform's defined notification-type set, a non-blank title (max 255 chars), and a non-blank body (max 2,000 chars); violations return 400. Accepted events MUST appear in the target user's inbox as unread immediately.
- **FR-006**: On accepting a notification, the system MUST attempt push delivery to each of the target user's active device tokens via the platform's push provider — only when the user's preferences have push enabled and the notification's type is not muted.
- **FR-007**: Push delivery MUST be best-effort: provider unavailability or send failure MUST NOT fail or delay ingestion (the notification is stored regardless), and failures MUST be logged.
- **FR-008**: When the push provider reports a device token invalid or expired, the system MUST deactivate that token so future notifications skip it.
- **FR-009**: System MUST let an authenticated user register a device push token (201; idempotent 200 on re-registration of the same token by the same user; one active record per token). Registering a token previously held by a different account MUST reassign it to the caller.
- **FR-010**: System MUST let an authenticated user deregister a device push token (204, idempotent — deleting an unknown token is also 204).
- **FR-011**: System MUST let an authenticated user read and replace their notification preferences: a global push on/off flag (default on) and a set of muted notification types (default empty). Unknown type names in the muted set return 400. Preferences govern push delivery only — in-app storage is unconditional.
- **FR-012**: System MUST expose `GET /notification/health` as a public endpoint.
- **FR-013**: All error responses MUST use the platform's uniform error envelope.
- **FR-014**: All endpoints except `/notification/health` MUST require authentication — user JWT for user-facing endpoints, the internal service credential for the ingestion endpoint.

### Key Entities

- **Notification**: id (UUID), userId (recipient), type (from the platform's notification-type set, e.g. challenge scored, mentorship request received/responded, new mentorship message), title, body, read (bool, default false), createdAt. Owned entirely by this service; producers fire-and-forget.
- **PushToken**: id (UUID), userId, token (the device's push token, unique per device), active (bool), registeredAt. Reassigned on cross-account re-registration; deactivated when the provider reports it dead.
- **NotificationPreference**: one per user (created lazily with defaults on first read/write): userId, pushEnabled (default true), mutedTypes (set of type names, default empty), updatedAt.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A notification recorded by a producer service is visible in the target user's inbox on the very next fetch — no delay, queue, or manual step.
- **SC-002**: Inbox, unread-count, and preference requests return within 5 seconds with up to 10,000 stored notifications per user (list capped at the newest 100).
- **SC-003**: Ingestion returns success within 5 seconds even when the push provider is completely unreachable — push failure never degrades recording.
- **SC-004**: All endpoints are covered by controller-slice and service unit tests; line coverage ≥ 70%, consistent with the platform standard.
- **SC-005**: Service starts cleanly via `docker-compose up notification-service` with no migration errors.
- **SC-006**: The mobile app can complete the notification loop end-to-end: producer event → badge count rises → inbox shows the entry → tapping marks it read → badge count falls; and with a registered device, a push arrives for an eligible event.
- **SC-007**: Push-eligibility decisions are explainable: given a user's preferences and token state, whether a push attempt happens can be predicted by hand from the documented rule (active token AND pushEnabled AND type not muted).

## Assumptions

- Port 8009 and PostgreSQL schema `notification` per `docs/architecture.md`; nginx prefix `/notification/` follows the existing gateway convention.
- Push delivery uses the Expo Push Notification API (fixed by `docs/architecture.md`); "push provider" in this spec means that API.
- **Producer wiring is a separate follow-up feature.** This feature delivers the notification platform itself (ingestion endpoint + inbox + push + preferences). Modifying challenge-, mentorship-, matching-, and career-service to actually call the ingestion endpoint touches four committed services and is scoped as its own increment, so each producer can be wired and tested independently. Until then the ingestion endpoint is exercised by tests and the quickstart.
- This is the platform's first service-to-service call surface. v1 authenticates producers with a shared internal service credential supplied via environment configuration (per `docs/architecture.md`, direct HTTP calls in the prototype; a message broker is deferred to v2).
- The notification-type set is a fixed enumeration defined by this service (covering the platform's known events: challenge scored, mentorship request received/accepted/declined, new mentorship message, opportunity match, roadmap milestone, and a generic system type). Producers must use a known type; new types are added by code change, keeping preference muting well-defined.
- The inbox list is capped at the newest 100 notifications in v1 — the first bounded list on the platform, justified because notifications accumulate indefinitely; there is no pagination, archive, or delete endpoint in v1.
- No read receipts back to producers, no digest/batching, no email/SMS channels, and no real-time (WebSocket) inbox updates in v1 — the app refreshes on focus like every other screen.
- `docs/database.md` sketches `notifications` and `push_tokens` but omits the `notification_preferences` table that `docs/architecture.md` lists as owned data (same doc gap as mentorship's requests table); this feature adds it and updates the doc during planning. The sketched `read BOOLEAN` column is kept as-is.
- Recording notifications for user ids this service cannot verify is accepted (service autonomy — no cross-schema reads); unfetchable rows are harmless and bounded by the 100-item cap on reads.
- JWT secret is shared platform-wide for user-facing endpoints, same as every other service; tests use `@WebMvcTest` slices plus service unit tests, no running PostgreSQL required for the unit suite.
