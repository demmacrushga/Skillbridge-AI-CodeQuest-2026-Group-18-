# API Contract: notification-service

**Base path**: `/notification` (service on port 8009)
**Auth**: user endpoints require `Authorization: Bearer <JWT>` (any role — every user
type receives notifications); the internal ingestion endpoint requires
`X-Internal-Token: <INTERNAL_SERVICE_TOKEN>` instead and rejects user JWTs.
**Routing**: user endpoints are proxied by nginx under `/notification/`;
`/notification/internal/**` is NOT routed by the gateway — producers call
`http://notification-service:8009` directly on the compose network.
**Errors**: platform envelope `{ "timestamp", "status", "error", "message", "path" }`
(+ `fieldErrors` on 400 validation failures).
**Types**: `CHALLENGE_SCORED`, `MENTORSHIP_REQUEST_RECEIVED`,
`MENTORSHIP_REQUEST_ACCEPTED`, `MENTORSHIP_REQUEST_DECLINED`, `MENTORSHIP_MESSAGE`,
`OPPORTUNITY_MATCH`, `ROADMAP_MILESTONE`, `SYSTEM` — case-sensitive.

---

## 1. Health (public)

```
GET /notification/health
```
**200** — `{ "status": "UP" }`

---

## 2. Ingest a notification (internal services only)

```
POST /notification/internal/notify
X-Internal-Token: <INTERNAL_SERVICE_TOKEN>
```
```json
{
  "userId": "uuid",
  "type": "CHALLENGE_SCORED",
  "title": "Your submission was scored",
  "body": "Build a Fraud Detection API — you scored 85.50. View the leaderboard to see your rank."
}
```
| Field | Rules |
|---|---|
| `userId` | required UUID (not verified against auth-service — service autonomy) |
| `type` | required, one of the types above, case-sensitive |
| `title` | required, non-blank, ≤ 255 chars |
| `body` | required, non-blank, ≤ 2,000 chars |

Stores the notification unread, then attempts best-effort push to each of the user's
active tokens when eligible (active token AND pushEnabled AND type not muted). Push
failure never affects the response.

**201** — `NotificationResponse`:
```json
{
  "id": "uuid",
  "type": "CHALLENGE_SCORED",
  "title": "Your submission was scored",
  "body": "Build a Fraud Detection API — you scored 85.50. View the leaderboard to see your rank.",
  "read": false,
  "createdAt": "2026-07-19T12:00:00Z"
}
```
**Errors**: 400 (missing userId, unknown/wrong-case type, blank/oversize title or body);
401 (missing/invalid `X-Internal-Token`); 403 (a user JWT presented instead of the
service token)

---

## 3. My inbox

```
GET /notification
Authorization: Bearer <JWT>   (any role)
```
Newest 100 notifications for the caller, `createdAt` DESC.

**200** — `[NotificationResponse]`. Empty → `[]`.
**Errors**: 401

---

## 4. Unread count

```
GET /notification/unread-count
Authorization: Bearer <JWT>
```
**200** — `{ "unread": 3 }` (0 when none). Counts **all** stored unread notifications, so it can exceed the 100 entries the list shows; `read-all` clears the remainder.
**Errors**: 401

---

## 5. Mark one read

```
POST /notification/{notificationId}/read
Authorization: Bearer <JWT>
```
Idempotent — marking an already-read notification returns 200 unchanged.

**200** — `NotificationResponse` (`read: true`)
**Errors**: 401; 404 (unknown id or belongs to a different user — indistinguishable)

---

## 6. Mark all read

```
POST /notification/read-all
Authorization: Bearer <JWT>
```
Single bulk update, self-scoped. Idempotent.

**200** — `{ "marked": 3 }` (`0` when nothing was unread)
**Errors**: 401

---

## 7. Register a device push token

```
POST /notification/push-tokens
Authorization: Bearer <JWT>
```
```json
{ "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" }
```
| Field | Rules |
|---|---|
| `token` | required, non-blank, ≤ 255 chars |

Upsert keyed on the token value: new token → 201; same user re-registering → 200
(touched + reactivated); token previously held by another account → 200, reassigned to
the caller (a device only ever receives the current account's notifications).

**201 / 200** — `PushTokenResponse`:
```json
{ "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]", "active": true, "registeredAt": "2026-07-19T12:00:00Z" }
```
**Errors**: 400 (blank/oversize token); 401

---

## 8. Deregister a device push token

```
DELETE /notification/push-tokens
Authorization: Bearer <JWT>
```
```json
{ "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" }
```
Token travels in the body, not the path (Expo tokens contain `[]`). Deletes the caller's
record for that token. Idempotent — unknown token or someone else's token both return
204 with no effect on other users' registrations.

**204** — no body.
**Errors**: 400 (blank token); 401

---

## 9. Get my preferences

```
GET /notification/preferences
Authorization: Bearer <JWT>
```
Returns stored preferences, or the defaults when the user has never saved any
(push enabled, nothing muted) — the row is created lazily on first PUT.

**200** — `PreferencesResponse`:
```json
{ "pushEnabled": true, "mutedTypes": [] }
```
**Errors**: 401

---

## 10. Replace my preferences

```
PUT /notification/preferences
Authorization: Bearer <JWT>
```
```json
{ "pushEnabled": false, "mutedTypes": ["MENTORSHIP_MESSAGE", "OPPORTUNITY_MATCH"] }
```
| Field | Rules |
|---|---|
| `pushEnabled` | required boolean |
| `mutedTypes` | required array (may be empty) of known type names, case-sensitive — an unknown name fails JSON deserialization → 400 |

Full replace. Governs push only — the inbox always stores everything.

**200** — `PreferencesResponse` (stored values)
**Errors**: 400 (missing pushEnabled, unknown type name); 401

---

## Status-code → exception mapping

| Status | Source |
|---|---|
| 400 | `MethodArgumentNotValidException` (+fieldErrors), `HttpMessageNotReadableException` (malformed JSON / unknown enum value), `IllegalArgumentException` |
| 401 | missing/invalid JWT or internal token (filters) / `AuthenticationException` |
| 403 | `AccessDeniedException` (user JWT on the internal endpoint) |
| 404 | `NotificationNotFoundException` (mark-read on unknown/foreign id) |
| 500 | anything else (logged with stack trace; push failures are NOT 500s — they're swallowed per FR-007) |
