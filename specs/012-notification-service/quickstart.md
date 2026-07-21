# Quickstart: Notification Service Validation

End-to-end validation guide for `notification-service`. Contract:
[`contracts/notification-api.md`](contracts/notification-api.md); entities:
[`data-model.md`](data-model.md).

## Prerequisites

- Docker + Docker Compose; `.env` populated (`POSTGRES_*`, `JWT_SECRET`, and the new
  `INTERNAL_SERVICE_TOKEN=<any long random string>`)
- One test account of any role via auth-service (its access token below as `$USER_TOKEN`;
  its user id as `$USER_ID` — decode the JWT `sub` or read it from the register response)

```bash
docker-compose up --build -d postgres auth-service notification-service gateway
export USER_TOKEN=...
export USER_ID=...
export INTERNAL=$(grep INTERNAL_SERVICE_TOKEN .env | cut -d= -f2)
BASE=http://localhost:8080          # gateway (user endpoints)
DIRECT=http://localhost:8009        # service direct (internal endpoint)
```

## §1 Health & startup

```bash
curl -s $BASE/notification/health          # → {"status":"UP"}
docker logs skillbridge-notification | grep "Notification Service is running"
# Flyway V1..V4 applied, no migration errors (SC-005)
```

## §2 Internal ingestion + gateway isolation (US3)

```bash
# Producer path (direct, with service token) → 201
curl -s -X POST $DIRECT/notification/internal/notify \
  -H "X-Internal-Token: $INTERNAL" -H 'Content-Type: application/json' \
  -d "{\"userId\":\"$USER_ID\",\"type\":\"CHALLENGE_SCORED\",
       \"title\":\"Your submission was scored\",\"body\":\"You scored 85.50.\"}"

# Guards:
#   no token → 401; wrong token → 401; USER_TOKEN as Bearer (no X-Internal-Token) → 401/403
#   unknown type "challenge_scored" (lowercase) → 400; blank title → 400 with fieldErrors
# Gateway isolation: the internal path must NOT be reachable through nginx:
curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/notification/internal/notify \
  -H "X-Internal-Token: $INTERNAL" -d '{}'      # → 404/403 from nginx, never 201
```

## §3 Inbox & unread count (US1)

```bash
curl -s $BASE/notification -H "Authorization: Bearer $USER_TOKEN"
# → the ingested notification, newest first, read: false
curl -s $BASE/notification/unread-count -H "Authorization: Bearer $USER_TOKEN"
# → {"unread":1}
# Ingest 2 more (§2) → list order newest-first, unread 3
# A second user's token sees an empty list (strict self-scoping)
```

## §4 Read-state (US2)

```bash
NOTIF_ID=<id from §3>
curl -s -X POST $BASE/notification/$NOTIF_ID/read -H "Authorization: Bearer $USER_TOKEN"
# → 200 read:true; repeat → 200 unchanged (idempotent); unread count drops by 1
# Another user's token on the same id → 404 (no ownership leakage)
curl -s -X POST $BASE/notification/read-all -H "Authorization: Bearer $USER_TOKEN"
# → {"marked":2}; unread-count → 0; repeat → {"marked":0}
```

## §5 Push tokens (US5)

```bash
TOKEN='ExponentPushToken[test-device-token-0001]'
curl -s -X POST $BASE/notification/push-tokens -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' -d "{\"token\":\"$TOKEN\"}"      # → 201 active:true
# Re-register same token, same user → 200 (idempotent)
# Register same token with a SECOND user's JWT → 200, reassigned (first user loses it)
curl -s -X DELETE $BASE/notification/push-tokens -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' -d "{\"token\":\"$TOKEN\"}"      # → 204; repeat → 204
```

## §6 Preferences & push eligibility hand-check (US4 + US6, SC-007)

```bash
curl -s $BASE/notification/preferences -H "Authorization: Bearer $USER_TOKEN"
# → defaults {"pushEnabled":true,"mutedTypes":[]} (no row yet — lazy)

curl -s -X PUT $BASE/notification/preferences -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"pushEnabled":true,"mutedTypes":["MENTORSHIP_MESSAGE"]}'        # → 200 stored
# Unknown type in mutedTypes → 400

# Push eligibility (rule: active token AND pushEnabled AND type not muted):
#   watch logs while ingesting — with a registered token and CHALLENGE_SCORED → push attempt logged;
#   ingest MENTORSHIP_MESSAGE (muted) → stored (201), NO push attempt;
#   set pushEnabled:false → no attempts at all; ingestion still 201 every time.
docker logs -f skillbridge-notification | grep -i push
```

**Expo-down resilience (SC-003)**: set `EXPO_PUSH_URL=http://localhost:9/unreachable` on
the service, ingest → still 201 within 5s, WARN logged, notification in inbox.

## §7 Backend test suite

```bash
cd backend/notification-service && ./mvnw verify
# unit + slice green locally; Testcontainers integration (token reassignment, bulk
# read-all, partial-index count, stubbed-Expo eligibility) runs where Docker exists (CI);
# JaCoCo ≥ 70% (SC-004)
```

## §8 Mobile QA (SC-006)

1. Sign in on a device → app registers the Expo push token automatically.
2. Home header shows the bell; ingest an event (§2) → badge count rises on next focus.
3. Open the bell → inbox lists the notification unread-highlighted; tap → highlight
   clears, badge falls; "Mark all read" clears everything.
4. Preferences section: mute a type, toggle push off/on — saved values survive reload.
5. With a real device + default preferences, ingest → OS push notification arrives;
   with push off or the type muted → inbox only, no push.
6. Sign out → token deregistered; further ingestions produce no push to that device.
