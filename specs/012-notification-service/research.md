# Research: Notification Service

**Feature**: `specs/012-notification-service/spec.md` | **Date**: 2026-07-19

The stack is fixed by the constitution and the scaffolding pattern is proven three times
over (matching → challenge → mentorship). Research below records the design decisions,
concentrated on this feature's two platform-firsts: service-to-service authentication and
outbound push delivery.

---

## Decision 1: Internal ingestion auth = static service token in a dedicated header

**Decision**: `POST /notification/internal/notify` authenticates with a static shared
secret sent as `X-Internal-Token`, validated against `${INTERNAL_SERVICE_TOKEN}` from
the environment by a small servlet filter (`InternalTokenFilter`) that runs alongside
`JwtAuthFilter`. A valid internal token grants a synthetic `ROLE_INTERNAL` authority;
the endpoint is guarded with `@PreAuthorize("hasRole('INTERNAL')")`. User JWTs never
carry that role → 403; no token → 401. The internal path is also *not* routed through
nginx — producers call `http://notification-service:8009` directly on the compose
network, so the endpoint is unreachable from outside the cluster (defense in depth).

**Rationale**: v1 needs the simplest credible service credential. A static env-var token
matches the platform's existing secret handling (JWT_SECRET is already distributed the
same way), requires no new infrastructure, and the nginx omission means external callers
can't even reach the endpoint to try a token. Per-service JWTs (client-credentials style)
would need an issuer and rotation story — deferred with the v2 message broker.

**Alternatives considered**: mTLS (overkill for compose-network prototype); signed JWTs
minted by auth-service for services (adds a runtime dependency auth-service was
explicitly designed out of); no auth + network-only isolation (rejected — constitution II
requires auth on non-public endpoints, and a header check is nearly free).

## Decision 2: Expo push via direct HTTP POST, fire-and-forget, in-request

**Decision**: `ExpoPushClient` POSTs to `https://exp.host/--/api/v2/push/send` (URL
overridable via `EXPO_PUSH_URL` for tests) with a JSON array of
`{to, title, body, sound: "default"}` messages — one entry per active token, one HTTP
call per ingestion event. Total client timeout 3s. Any exception or non-OK response is
caught, logged at WARN with the notification id, and swallowed — ingestion has already
persisted the row. Expo per-receipt errors of type `DeviceNotRegistered` deactivate the
matching token (FR-008); other receipt errors are logged only. No Expo SDK dependency —
plain `RestClient` (Spring 6), no receipt polling in v1.

**Rationale**: Expo's push API is a single unauthenticated-by-default HTTPS endpoint
accepting batches of up to 100 messages — a plain HTTP call is simpler than the Java
community SDK and keeps the dependency set identical to the other services. Synchronous
best-effort matches the constitution's synchronous-calls posture and SC-003 (ingestion
succeeds within 5s even with the provider down — a 3s client timeout guarantees it).
Receipt *polling* (Expo's two-phase delivery confirmation) is deliberately dropped:
`DeviceNotRegistered` already surfaces in the immediate ticket response, which is enough
for FR-008.

**Alternatives considered**: expo-server-sdk-java (unofficial, extra dependency for a
one-endpoint API); async queue/executor for sends (premature — a 3s bounded call
in-request is fine at demo scale, and matches "synchronous Claude calls" precedent);
receipt polling for delivery confirmation (v2 — needs a scheduler and buys nothing
user-visible now).

## Decision 3: NotificationType is a fixed enum owned by this service

**Decision**: `NotificationType` enum: `CHALLENGE_SCORED`, `MENTORSHIP_REQUEST_RECEIVED`,
`MENTORSHIP_REQUEST_ACCEPTED`, `MENTORSHIP_REQUEST_DECLINED`, `MENTORSHIP_MESSAGE`,
`OPPORTUNITY_MATCH`, `ROADMAP_MILESTONE`, `SYSTEM`. Stored as VARCHAR(50). Ingestion
payloads and preference muted-sets must use these names exactly (case-sensitive, Jackson
`accept-case-insensitive-enums: false` as platform-standard); unknown names → 400.
`SYSTEM` has no service producer by design — it is reserved for operator-sent
announcements (curl + the internal token, exactly as the quickstart exercises ingestion)
and for future admin tooling; users can mute it like any other type.

**Rationale**: A closed set keeps preference muting well-defined (FR-011 must reject
unknown names, impossible with free-text types) and gives the frontend a stable set of
icons/labels. Producers adding event kinds is a code change here by design — the same
"new enum value = reviewed change" posture as `OpportunityType`/`RequestStatus`.

**Alternatives considered**: free-text type strings (rejected — unvalidatable muting,
typo-prone producers); a types registry table (rejected — YAGNI, an enum in code is the
registry).

## Decision 4: Preferences = one lazy row per user, mutedTypes as JSONB

**Decision**: `notification_preferences` holds one row per user (`user_id` UNIQUE),
`push_enabled BOOLEAN NOT NULL DEFAULT TRUE`, `muted_types JSONB NOT NULL DEFAULT '[]'`
mapped to `Set<NotificationType>` via `@JdbcTypeCode(SqlTypes.JSON)`. The row is created
lazily: reads return in-memory defaults when absent; the first PUT persists. PUT is
full-replace (platform pattern: matching skills, mentorship profile).

**Rationale**: Same JSONB-collection treatment proven in mentorship's `career_interests`
— the muted set is only ever read/written whole and filtered in memory at push time.
Lazy creation avoids a provisioning hook on user registration (this service can't know
about registrations anyway — no cross-service events yet).

**Alternatives considered**: row-per-(user,type) mute table (rejected — SQL-level
filtering not needed at one-user-at-a-time push decisions); eager default rows (no
signup hook exists to create them).

## Decision 5: Push token identity = the token string, reassignable across users

**Decision**: `push_tokens.token` VARCHAR(255) UNIQUE across the table. Registration
upserts by token value: same user + same token → touch (idempotent 200); token held by
another user → reassign `user_id` to the caller and reactivate (spec US5 AC3); brand-new
token → insert (201). Deregistration deletes by (token, caller) and is idempotent (204
even if unknown). `active` flag flips false on Expo `DeviceNotRegistered` (Decision 2);
re-registration reactivates.

**Rationale**: The device token is the real-world identity — a physical device holds
exactly one Expo token at a time, and a device must only ever receive the *current*
account's notifications (shared-device safety, spec US5 AC3). A DB unique constraint on
the token makes reassignment an update instead of a duplicate-row hazard.

**Alternatives considered**: unique on (user, token) allowing one token under two users
(rejected — leaks notifications to previous account's device session); hard-delete on
`DeviceNotRegistered` (soft `active=false` is kept so re-registration is an update and
the platform soft-delete convention holds).

## Decision 6: Inbox cap 100, no unread-count denormalization

**Decision**: `GET /notification` returns the newest 100 rows for the caller
(`ORDER BY created_at DESC LIMIT 100`, index on `(user_id, created_at DESC)`).
`GET /notification/unread-count` is a `COUNT(*) WHERE user_id = ? AND read = FALSE`
against a partial index `ON notifications (user_id) WHERE NOT read`. No stored counter.

**Rationale**: The platform's first bounded list (spec assumption) — notifications
accumulate indefinitely. Counting from the store keeps FR-002's list/count consistency
by construction (no counter drift); the partial index makes it O(unread), which is small
by definition for any active user.

**Alternatives considered**: cursor pagination (v2 if anyone scrolls past 100); a
maintained unread counter column (rejected — the classic drift bug for zero measured
need).

## Decision 7: Mark-all-read as a single bulk UPDATE

**Decision**: `POST /notification/read-all` executes one
`UPDATE ... SET read = TRUE WHERE user_id = ? AND read = FALSE` via a `@Modifying`
repository query, returning 200 with the number updated. Single-mark uses an
owner-scoped fetch (`findByIdAndUserId`) → 404-not-403, idempotent 200.

**Rationale**: Loading potentially thousands of rows to flip a boolean would be the
naive JPA trap; a bulk update is one statement. Owner-scoped single-mark reuses the
platform's ownership-privacy pattern verbatim.

**Alternatives considered**: none serious.

## Decision 8: Endpoint inventory = 10 paths / 10 handlers

| # | Endpoint | Auth |
|---|---|---|
| 1 | `GET /notification/health` | public |
| 2 | `POST /notification/internal/notify` | internal service token (`ROLE_INTERNAL`) |
| 3 | `GET /notification` | any authenticated user |
| 4 | `GET /notification/unread-count` | any authenticated user |
| 5 | `POST /notification/{id}/read` | owner (404-not-403) |
| 6 | `POST /notification/read-all` | any authenticated user (self-scoped) |
| 7 | `POST /notification/push-tokens` | any authenticated user |
| 8 | `DELETE /notification/push-tokens` | any authenticated user (token in body) |
| 9 | `GET /notification/preferences` | any authenticated user |
| 10 | `PUT /notification/preferences` | any authenticated user |

User-facing endpoints take any role — every user type receives notifications
(architecture.md: "across all user types"), so guards are `isAuthenticated()` +
self-scoping by JWT `sub`, with `hasRole('INTERNAL')` only on ingestion. DELETE for
push-tokens carries the token in the request body rather than the path (Expo tokens
contain `[]` characters that are hostile to URL paths).

**Rationale/alternatives**: same `@PreAuthorize` method-security pattern as 010/011.
A path-param DELETE was rejected for the URL-encoding footgun above.

## Decision 9: Producer wiring stays out; quickstart exercises ingestion directly

**Decision**: No other service is modified in this feature (spec assumption). The
quickstart validates ingestion with `curl -H "X-Internal-Token: ..."` simulating a
producer. A follow-up feature (013) wires challenge/mentorship/matching/career
producers with a small shared `NotificationClient` copied into each.

**Rationale**: Keeps this a single-service increment like 009–011; producer wiring
touches four committed services and deserves its own spec/tests.

## Decision 10: Frontend = one hidden notifications screen + header bell badge

**Decision**: `app/(app)/notifications.tsx` (hidden screen, all roles) shows the inbox
with unread highlighting, tap-to-mark-read, mark-all-read, and a preferences section
(push toggle + per-type mute switches). The home screen header gains a bell icon with
the unread count, polling on focus (`useFocusEffect`, platform pattern). Push token
registration runs on sign-in via `expo-notifications` (`getExpoPushTokenAsync`), and
deregistration on sign-out. No new tab (bar is full); the bell routes to the screen.

**Rationale**: Same hidden-screen + focus-refresh idiom as challenges/mentorship. One
screen serves every role since notifications are role-agnostic.

**Alternatives considered**: real-time badge via WebSocket (out per spec assumptions);
per-role screens (nothing role-specific to show).
