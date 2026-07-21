# Data Model: Notification Service

**Feature**: `specs/012-notification-service/spec.md` | **Plan**: `plan.md` | **Date**: 2026-07-19

PostgreSQL 16, isolated schema `notification`, Flyway migrations in
`backend/notification-service/src/main/resources/db/migration/`.

## Migrations

```text
V1__create_schema.sql            -- CREATE SCHEMA IF NOT EXISTS notification;
V2__create_notifications.sql
V3__create_push_tokens.sql
V4__create_notification_preferences.sql
```

## Enum

`NotificationType` (stored VARCHAR(50), case-sensitive on the wire):
`CHALLENGE_SCORED`, `MENTORSHIP_REQUEST_RECEIVED`, `MENTORSHIP_REQUEST_ACCEPTED`,
`MENTORSHIP_REQUEST_DECLINED`, `MENTORSHIP_MESSAGE`, `OPPORTUNITY_MATCH`,
`ROADMAP_MILESTONE`, `SYSTEM` (research Decision 3).

## Entities

### Notification — `notification.notifications`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | app-generated |
| user_id | UUID | NOT NULL | recipient (JWT `sub` of the target user); plain UUID, never verified cross-service |
| type | VARCHAR(50) | NOT NULL | `NotificationType` |
| title | VARCHAR(255) | NOT NULL | non-blank (DTO-enforced) |
| body | VARCHAR(2000) | NOT NULL | non-blank (DTO-enforced); sketch said TEXT — bounded per FR-005 |
| read | BOOLEAN | NOT NULL DEFAULT FALSE | flipped by mark-read / read-all; never un-read |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | inbox order DESC |

Indexes:
- `idx_notifications_user_created ON (user_id, created_at DESC)` — inbox fetch (LIMIT 100)
- `uq/partial: idx_notifications_user_unread ON (user_id) WHERE NOT read` — unread count is O(unread) (research Decision 6)

Java: `read` maps to field `read` (`isRead()`); no soft-delete — rows are immutable except the `read` flag.

### PushToken — `notification.push_tokens`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | NOT NULL | current owner; reassigned on cross-account registration (research Decision 5) |
| token | VARCHAR(255) | NOT NULL, UNIQUE | the Expo push token string — the device's identity |
| active | BOOLEAN | NOT NULL DEFAULT TRUE | flipped false on Expo `DeviceNotRegistered`; re-registration reactivates |
| registered_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | refreshed on re-registration |

Indexes: `UNIQUE (token)` (`uq_push_tokens_token`); `idx_push_tokens_user_active ON (user_id, active)`.

**Registration state machine** (keyed by token value):
- unknown token → INSERT (201)
- same user, existing token → touch `registered_at`, `active = true` (200)
- other user's token → UPDATE `user_id` to caller, `active = true`, touch (200) — shared-device safety
- deregister → DELETE by (token, caller); idempotent 204

### NotificationPreference — `notification.notification_preferences`

One lazy row per user (research Decision 4). Absent row ≡ defaults.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | NOT NULL, UNIQUE | |
| push_enabled | BOOLEAN | NOT NULL DEFAULT TRUE | global push switch |
| muted_types | JSONB | NOT NULL DEFAULT '[]' | `Set<NotificationType>` via `@JdbcTypeCode(SqlTypes.JSON)` |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | refreshed on PUT (full replace) |

Index: `UNIQUE (user_id)`.

## Push-eligibility rule (FR-006, SC-007)

```
push attempted ⇔ user has ≥1 active push_token
              AND (no preference row OR push_enabled = true)
              AND type ∉ muted_types
```
Evaluated at ingestion time only; preference changes never retro-affect stored rows.

## Relationships

```text
Notification  (immutable except read flag; capped reads at newest 100)
PushToken     (device identity; reassignable across users)
NotificationPreference (1 lazy row per user)
```
No FKs between the three tables — they relate only through `user_id`, and rows must
survive one another's lifecycle independently (e.g. deleting a token never touches
notifications). All `user_id` values come from JWT `sub` (or the producer's payload on
ingestion) — no cross-schema FKs (Constitution I).

## DTOs

### Requests

| DTO | Fields / validation |
|---|---|
| `IngestNotificationRequest` | `userId` (`@NotNull` UUID), `type` (`@NotNull NotificationType`), `title` (`@NotBlank @Size(max=255)`), `body` (`@NotBlank @Size(max=2000)`) |
| `RegisterPushTokenRequest` | `token` (`@NotBlank @Size(max=255)`) |
| `DeletePushTokenRequest` | `token` (`@NotBlank @Size(max=255)`) — in body, not path (Expo tokens contain `[]`) |
| `UpdatePreferencesRequest` | `pushEnabled` (`@NotNull` Boolean), `mutedTypes` (`@NotNull Set<NotificationType>`, may be empty) |

### Responses

| DTO | Shape |
|---|---|
| `NotificationResponse` | id, type, title, body, read, createdAt |
| `UnreadCountResponse` | `{ "unread": 3 }` |
| `ReadAllResponse` | `{ "marked": 3 }` |
| `PushTokenResponse` | token, active, registeredAt |
| `PreferencesResponse` | pushEnabled, mutedTypes[] |

## docs/database.md reconciliation (done as part of this feature)

- Add the missing `notification.notification_preferences` section (table above).
- Align `notifications.body` (TEXT → VARCHAR(2000)) and add the two indexes;
  `push_tokens`: rename sketch column `expo_push_token` → `token`, add UNIQUE.
- Schema Overview row: `notifications, push_tokens, notification_preferences`.
