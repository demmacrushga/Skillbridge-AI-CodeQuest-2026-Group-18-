# Producer Catalog: notification events by service

The authoritative map of every notification the platform produces — which service, at
which code path, to whom, with what content. All events POST to
`POST http://notification-service:8009/notification/internal/notify` with
`X-Internal-Token` (contract: `specs/012-notification-service/contracts/notification-api.md` §2).

All sends are best-effort (≤ 2s timeout, catch-all → WARN, never blocks the operation).

---

## challenge-service (1 event)

| # | Trigger (call site) | Recipient | Type | Title | Body template |
|---|---|---|---|---|---|
| C1 | `ChallengeServiceImpl.scoreSubmission()` — after the score is persisted | `submission.studentId` | `CHALLENGE_SCORED` | `Your submission was scored` | `{challenge.title} — you scored {score}. Check the leaderboard to see your rank.` |

Notes: fires on every score save, including re-scores (revised score = new information).

## mentorship-service (4 events)

| # | Trigger (call site) | Recipient | Type | Title | Body template |
|---|---|---|---|---|---|
| M1 | `MentorshipServiceImpl.sendRequest()` — after `saveAndFlush` succeeds | `request.alumniId` | `MENTORSHIP_REQUEST_RECEIVED` | `New mentorship request` | `A student has requested your mentorship.` |
| M2 | `acceptRequest()` — after the pair is created | `request.studentId` | `MENTORSHIP_REQUEST_ACCEPTED` | `Request accepted` | `Your mentorship request was accepted — you can start chatting now.` |
| M3 | `declineRequest()` — after the status flip | `request.studentId` | `MENTORSHIP_REQUEST_DECLINED` | `Request declined` | `Your mentorship request was declined. You can request another mentor anytime.` |
| M4 | `sendMessage()` — after the message is saved | the pair participant who is NOT the sender | `MENTORSHIP_MESSAGE` | `New message` | first 120 chars of `message.body`, `…`-suffixed when truncated |

Notes: `cancelRequest()` fires nothing. `getThread()`/`endPair()` fire nothing.

## matching-service (1 event, fan-out)

| # | Trigger (call site) | Recipient(s) | Type | Title | Body template |
|---|---|---|---|---|---|
| X1 | `MatchingServiceImpl.postOpportunity()` — after the opportunity is saved | every student whose `MatchScoringService.score()` for the new opportunity is **≥ 50.00**, capped at the **100** highest-scoring | `OPPORTUNITY_MATCH` | `New opportunity matches your skills` | `{title} at {companyName} — {score}% match.` |

Notes: recipients computed entirely from matching's own `student_skills` (distinct
student ids → score each in memory). The skipped count (beyond the cap) is logged.
Constants `MATCH_NOTIFY_THRESHOLD = 50.00` and `MATCH_NOTIFY_CAP = 100` live beside the
call site. Deactivation fires nothing.

## career-service (1 event — pending reconnaissance)

| # | Trigger (call site) | Recipient | Type | Title | Body template |
|---|---|---|---|---|---|
| R1 | milestone-completion service method (exact site confirmed in plan reconnaissance) | the student completing the milestone | `ROADMAP_MILESTONE` | `Milestone complete 🎉` | `You've completed {milestone.title} — {progressPercent}% of your roadmap done.` |

Notes: cut-able independently if career-service's structure resists (spec Assumptions).

---

## Non-events (deliberate silences)

- Acting users are never notified of their own actions (FR-004).
- Mentorship cancel; challenge/opportunity deactivation; leaderboard views; profile
  edits; applications (recruiters have an applicants view; a `APPLICATION_RECEIVED`
  type would be a new enum value — deferred).
- **A new challenge being posted** notifies nobody — students discover challenges via
  the browse board; a broadcast to every student per posting would be pure noise at
  platform scale. (A `CHALLENGE_POSTED` type is a possible future addition once
  challenge-interest preferences exist.)
- **A student updating their skill profile** never retro-fires `OPPORTUNITY_MATCH`
  against existing opportunities — X1 fires only when a *new* opportunity is posted.
  The student sees their refreshed matches immediately on the opportunities screen
  (scores are computed live), so a notification would duplicate what the screen
  already shows on next open.

## Reserved type with no producer

`SYSTEM` is deliberately absent from this catalog — no service emits it. It is reserved
for operator announcements sent manually (curl + `X-Internal-Token`, per
`specs/012-notification-service/quickstart.md` §2) and for future admin tooling. Users
can mute it like any other type.

## Shared client contract (per producer)

```java
// <service>.client.NotificationClient
void notify(UUID userId, String type, String title, String body);
// - POST {NOTIFICATION_URL}/notification/internal/notify, X-Internal-Token header
// - 2s connect+read timeout
// - try/catch(Exception) → log.warn("notification send failed: type={} …") — never rethrows
// - NOTIFICATION_URL blank/unset → permanent no-op, single INFO at startup
```

Config per producer (application.yml + docker-compose env):
`NOTIFICATION_URL=http://notification-service:8009`, `INTERNAL_SERVICE_TOKEN=${INTERNAL_SERVICE_TOKEN}`.
No `depends_on: notification-service` — failure isolation by design.
