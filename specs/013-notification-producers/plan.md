# Implementation Plan: Notification Producers

## Objective

Wire the four producer services into `notification-service` so that user-facing events are recorded as notifications exactly as defined in `contracts/producer-catalog.md`. All sends remain best-effort, non-blocking, and failure-isolated.

## Build Order

012-notification-service is implemented and deployed. This plan implements 013-notification-producers.

## Design Decisions

1. **Client pattern**: Each producer gets its own `NotificationClient` copied into the service (platform convention: copy-not-share). The client uses Spring `RestClient` (available in Boot 3.3.6) with a 2-second connect+read timeout and catches all exceptions.
2. **No startup dependency**: `NOTIFICATION_URL` blank/missing → client becomes a no-op with a single INFO log. No `depends_on` in docker-compose.
3. **Authentication**: `X-Internal-Token` header populated from `INTERNAL_SERVICE_TOKEN` environment variable.
4. **Fan-out**: matching-service computes scores in-memory from its own `student_skills` table, notifies only ≥ `MATCH_NOTIFY_THRESHOLD` (50.00), capped at `MATCH_NOTIFY_CAP` (100) highest-scoring.
5. **No new persistence**: no migrations or new entities. Producers call `POST /notification/internal/notify`.

## Artifacts

- `spec.md` (existing) — user scenarios and requirements
- `contracts/producer-catalog.md` (existing) — exact trigger/recipient/type/content map
- `checklists/requirements.md` (existing) — quality checklist
- `research.md` (this plan) — reconnaissance notes and decision log
- `tasks.md` — ordered implementation tasks
- `quickstart.md` — end-to-end validation steps

## Per-Service Wiring

### challenge-service

- New file: `client/NotificationClient.java`
- New file: `client/NotificationClientProperties.java` (record-style `@ConfigurationProperties`)
- Modify: `config/RestClientConfig.java` (or create) with notification RestClient bean
- Modify: `service/ChallengeServiceImpl.java` — after `submissionRepository.save()` in `scoreSubmission`, call `notificationClient.notify(submission.getStudentId(), "CHALLENGE_SCORED", title, body)`
- Modify: `application.yml` — add `notification.url` and `internal.service.token`
- Modify tests: `ChallengeServiceImplTest.java` — add happy and throwing cases

### mentorship-service

- New files: `client/NotificationClient.java`, `client/NotificationClientProperties.java`
- Modify: `service/MentorshipServiceImpl.java`
  - `sendRequest`: after save, notify alumniId with `MENTORSHIP_REQUEST_RECEIVED`
  - `acceptRequest`: after pair creation, notify studentId with `MENTORSHIP_REQUEST_ACCEPTED`
  - `declineRequest`: after status flip, notify studentId with `MENTORSHIP_REQUEST_DECLINED`
  - `sendMessage`: after save, notify the other participant with `MENTORSHIP_MESSAGE` (body preview ≤ 120 chars)
  - `cancelRequest`: no notification
- Modify: `application.yml`
- Modify tests: `MentorshipServiceImplTest.java`

### matching-service

- New files: `client/NotificationClient.java`, `client/NotificationClientProperties.java`
- Modify: `service/MatchingServiceImpl.java`
  - `postOpportunity`: after save, query distinct student ids, score each, filter ≥ 50.00, sort desc, cap 100, notify each
- Modify: `application.yml`
- Modify tests: `MatchingServiceImplTest.java`

### career-service

- New files: `client/NotificationClient.java`, `client/NotificationClientProperties.java`
- Modify: `service/CareerServiceImpl.java`
  - `completeMilestone`: after save and progress recompute, notify requestingUserId with `ROADMAP_MILESTONE`
- Modify: `application.yml`
- Modify tests: `CareerServiceImplTest.java`

## Platform Wiring

- `docker-compose.yml`: add `NOTIFICATION_URL` and `INTERNAL_SERVICE_TOKEN` env vars to challenge, mentorship, matching, career services. No `depends_on`.
- `.env.example`: add `INTERNAL_SERVICE_TOKEN` placeholder.
- `.github/workflows/ci.yml`: add notification service build step and env vars for producer service tests (already present for notification-service from 012).

## Testing Strategy

- Each producer service unit test covers:
  - Happy path: `NotificationClient.notify(...)` invoked with correct arguments.
  - Failure isolation: `NotificationClient.notify(...)` throws → business operation still succeeds and logs warning.
  - Missing config: `notification.url` blank → `notify()` is no-op, no exception.
- No integration tests that require Docker (environment lacks Docker).
- Keep existing coverage ≥ 70% per service.

## Quickstart Validation

Documented in `quickstart.md`:
1. Start the full stack (or just notification-service + one producer).
2. Trigger each producer event via its public endpoint.
3. Fetch the recipient's inbox via `GET /notification` and verify the expected type.
4. Stop notification-service and repeat each operation; confirm 200s and no exceptions.

## Risks

- Career-service predates current build pattern; the milestone completion site is clean and cut-able if needed.
- Docker unavailable in this environment, so integration tests are skipped; unit tests must carry the failure-isolation guarantee.

## Done When

- All four producer services have a `NotificationClient` and call it at the cataloged sites.
- All producer test suites pass with mocked happy and throwing notification clients.
- `docker-compose.yml` and CI pass env vars for notification wiring.
- Backend verification passes (`./mvnw verify` for each touched service).
