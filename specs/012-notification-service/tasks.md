# Tasks: Notification Service

**Input**: Design documents from `/specs/012-notification-service/`

**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/notification-api.md`, `quickstart.md`

**Tests**: Included — specification requires controller-slice + service unit tests plus integration tests; JaCoCo ≥ 70%.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., [US1], [US2])
- Exact file paths are included in every description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the new service and wire it into the platform.

- [x] T001 Create backend directory structure `backend/notification-service/` with `src/main/java/com/skillbridge/notification/` packages: `config`, `controller`, `dto/request`, `dto/response`, `entity`, `exception`, `repository`, `security`, `service` and `src/main/resources/db/migration`, `src/test/java/.../`
- [x] T002 [P] Create `backend/notification-service/pom.xml` from `backend/mentorship-service/pom.xml` with package renamed, artifact `notification-service`, port 8009, and same dependency set (web, security, data-jpa, validation, flyway, postgresql, jjwt, springdoc, lombok, testcontainers)
- [x] T003 [P] Create `backend/notification-service/Dockerfile` two-stage Maven + JRE 21, `EXPOSE 8009`, jar `notification-service.jar`
- [x] T004 [P] Create `backend/notification-service/src/main/resources/application.yml` with `server.port=8009`, `spring.datasource.url` schema `notification`, `INTERNAL_SERVICE_TOKEN`, `EXPO_PUSH_URL`, and Flyway enabled
- [x] T005 [P] Add `notification-service` block to `docker-compose.yml` (port 8009, env `INTERNAL_SERVICE_TOKEN`, `JWT_SECRET`, `POSTGRES_*`; no `depends_on` for producers)
- [x] T006 [P] Update `nginx/nginx.conf` with `/notification/` location that proxies user endpoints but explicitly denies/404s `/notification/internal/` before the proxy pass
- [x] T007 [P] Add `notification-service` matrix entry to `.github/workflows/ci.yml`
- [x] T008 [P] Add `INTERNAL_SERVICE_TOKEN` to `.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, entities, security, DTOs, and repositories that every user story needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T009 Create Flyway migration `backend/notification-service/src/main/resources/db/migration/V1__create_schema.sql` — `CREATE SCHEMA IF NOT EXISTS notification;`
- [x] T010 Create Flyway migration `backend/notification-service/src/main/resources/db/migration/V2__create_notifications.sql` — table `notification.notifications` with columns `id`, `user_id`, `type`, `title`, `body`, `read`, `created_at` and indexes `idx_notifications_user_created` and partial `idx_notifications_user_unread`
- [x] T011 Create Flyway migration `backend/notification-service/src/main/resources/db/migration/V3__create_push_tokens.sql` — table `notification.push_tokens` with columns `id`, `user_id`, `token`, `active`, `registered_at` and unique index `uq_push_tokens_token`, index `idx_push_tokens_user_active`
- [x] T012 Create Flyway migration `backend/notification-service/src/main/resources/db/migration/V4__create_notification_preferences.sql` — table `notification.notification_preferences` with columns `id`, `user_id`, `push_enabled`, `muted_types`, `updated_at` and unique index `uq_notification_preferences_user_id`
- [x] T013 [P] Create `backend/notification-service/src/main/java/com/skillbridge/notification/entity/NotificationType.java` enum with all 8 values: `CHALLENGE_SCORED`, `MENTORSHIP_REQUEST_RECEIVED`, `MENTORSHIP_REQUEST_ACCEPTED`, `MENTORSHIP_REQUEST_DECLINED`, `MENTORSHIP_MESSAGE`, `OPPORTUNITY_MATCH`, `ROADMAP_MILESTONE`, `SYSTEM`
- [x] T014 [P] Create `backend/notification-service/src/main/java/com/skillbridge/notification/entity/Notification.java` JPA entity mapped to `notification.notifications` with `read` boolean field exposing `isRead()`
- [x] T015 [P] Create `backend/notification-service/src/main/java/com/skillbridge/notification/entity/PushToken.java` JPA entity mapped to `notification.push_tokens` with unique `token` column
- [x] T016 [P] Create `backend/notification-service/src/main/java/com/skillbridge/notification/entity/NotificationPreference.java` JPA entity mapped to `notification.notification_preferences` with `mutedTypes` mapped as `Set<NotificationType>` via `@JdbcTypeCode(SqlTypes.JSON)`
- [x] T017 [P] Create request DTOs in `backend/notification-service/src/main/java/com/skillbridge/notification/dto/request/`: `IngestNotificationRequest.java`, `RegisterPushTokenRequest.java`, `DeletePushTokenRequest.java`, `UpdatePreferencesRequest.java` with Jakarta Validation annotations per `data-model.md`
- [x] T018 [P] Create response DTOs in `backend/notification-service/src/main/java/com/skillbridge/notification/dto/response/`: `NotificationResponse.java`, `UnreadCountResponse.java`, `ReadAllResponse.java`, `PushTokenResponse.java`, `PreferencesResponse.java`
- [x] T019 [P] Create `backend/notification-service/src/main/java/com/skillbridge/notification/exception/NotificationNotFoundException.java` extending `RuntimeException`
- [x] T020 [P] Create `backend/notification-service/src/main/java/com/skillbridge/notification/exception/GlobalExceptionHandler.java` returning the platform uniform error envelope for 400/401/403/404/500
- [x] T021 Create `backend/notification-service/src/main/java/com/skillbridge/notification/repository/NotificationRepository.java` with `findTop100ByUserIdOrderByCreatedAtDesc`, `countByUserIdAndReadFalse`, `findByIdAndUserId`, and `@Modifying` `markAllReadByUserId`
- [x] T022 Create `backend/notification-service/src/main/java/com/skillbridge/notification/repository/PushTokenRepository.java` with `findByToken`, `findByUserIdAndActiveTrue`, and `deleteByTokenAndUserId`
- [x] T023 Create `backend/notification-service/src/main/java/com/skillbridge/notification/repository/NotificationPreferenceRepository.java` with `findByUserId`
- [x] T024 [P] Copy `JwtAuthFilter.java`, `JwtService.java`, `JwtUserDetails.java` from `backend/mentorship-service/.../security/` into `backend/notification-service/.../security/`
- [x] T025 [P] Create `backend/notification-service/src/main/java/com/skillbridge/notification/security/InternalTokenFilter.java` validating `X-Internal-Token` against `${INTERNAL_SERVICE_TOKEN}` and granting `ROLE_INTERNAL` (401/403 handling)
- [x] T026 Create `backend/notification-service/src/main/java/com/skillbridge/notification/config/SecurityConfig.java` with `@EnableMethodSecurity`, public `/notification/health`, `hasRole('INTERNAL')` on internal path, `isAuthenticated()` on user paths, and both filters registered
- [x] T027 [P] Create `backend/notification-service/src/main/java/com/skillbridge/notification/config/RestClientConfig.java` exposing a `RestClient` bean for Expo push with 3s connect/read timeouts
- [x] T028 Create `backend/notification-service/src/main/java/com/skillbridge/notification/config/CorrelationIdFilter.java` copied from mentorship-service and registered in SecurityConfig
- [x] T029 Create `backend/notification-service/src/main/java/com/skillbridge/notification/config/StartupLogger.java` logging port 8009 and key configuration on startup
- [x] T030 Create `backend/notification-service/src/main/java/com/skillbridge/notification/service/ExpoPushClient.java` interface + skeleton implementation with `send(List<PushToken>, String title, String body)` and `EXPO_PUSH_URL` override
- [x] T031 Create `backend/notification-service/src/main/java/com/skillbridge/notification/service/NotificationService.java` interface declaring methods for all 6 user stories
- [x] T032 Create `backend/notification-service/src/main/java/com/skillbridge/notification/NotificationServiceApplication.java` with `@SpringBootApplication`

**Checkpoint**: Foundation ready — service starts, migrations run, security filters in place.

---

## Phase 3: User Story 1 — See My Notifications (Priority: P1) 🎯 MVP

**Goal**: Authenticated users can list their own notifications (newest 100) and get an unread count over all stored rows.

**Independent Test**: `GET /notification` and `GET /notification/unread-count` return correct scoped data for the caller.

- [x] T033 [US1] Implement `getMyNotifications()` in `NotificationServiceImpl.java` returning newest-100 `NotificationResponse` list
- [x] T034 [US1] Implement `getUnreadCount()` in `NotificationServiceImpl.java` returning `UnreadCountResponse` from `NotificationRepository.countByUserIdAndReadFalse`
- [x] T035 [US1] Implement `GET /notification` and `GET /notification/unread-count` endpoints in `backend/notification-service/src/main/java/com/skillbridge/notification/controller/NotificationController.java`
- [x] T036 [P] [US1] Write `@WebMvcTest` slice tests in `backend/notification-service/src/test/java/com/skillbridge/notification/controller/NotificationControllerTest.java` for inbox list (newest-first, self-scoping, empty list) and unread count
- [x] T037 [P] [US1] Write service unit tests in `backend/notification-service/src/test/java/com/skillbridge/notification/service/NotificationServiceImplTest.java` for list and count logic

**Checkpoint**: US1 independently testable — inbox and count work.

---

## Phase 4: User Story 2 — Mark Notifications Read (Priority: P1)

**Goal**: Users can mark a single notification read or mark all their notifications read at once.

**Independent Test**: `POST /notification/{id}/read` and `POST /notification/read-all` update read state idempotently with no ownership leakage.

- [x] T038 [US2] Implement `markRead(UUID notificationId)` in `NotificationServiceImpl.java` using `findByIdAndUserId` → 404 on foreign/unknown id
- [x] T039 [US2] Implement `markAllRead()` in `NotificationServiceImpl.java` using the bulk `@Modifying` repository query
- [x] T040 [US2] Implement `POST /notification/{notificationId}/read` and `POST /notification/read-all` endpoints in `NotificationController.java`
- [x] T041 [P] [US2] Write `@WebMvcTest` slice tests for single mark-read (idempotent, 404 on foreign id) and read-all (idempotent, count drops to 0)
- [x] T042 [P] [US2] Write service unit tests for `markRead` and `markAllRead`

**Checkpoint**: US2 independently testable — read-state operations work.

---

## Phase 5: User Story 3 — Services Record Notifications (Priority: P1)

**Goal**: Platform services can POST notification events to the internal ingestion endpoint; events appear in the target user's inbox as unread.

**Independent Test**: `POST /notification/internal/notify` with `X-Internal-Token` returns 201 and the notification is retrievable via the user inbox.

- [x] T043 [US3] Implement `ingestNotification(IngestNotificationRequest)` in `NotificationServiceImpl.java` persisting a `Notification` row
- [x] T044 [US3] Create `backend/notification-service/src/main/java/com/skillbridge/notification/controller/InternalNotificationController.java` with `POST /notification/internal/notify` requiring `ROLE_INTERNAL`
- [x] T045 [US3] Wire validation for `IngestNotificationRequest` (unknown type case-sensitive, blank/oversize title or body, missing userId) → 400 with field errors
- [x] T046 [P] [US3] Write `@WebMvcTest` slice tests for internal endpoint: 201 happy path, 401/403 for bad/missing token and user JWT, 400 for invalid payload
- [x] T047 [P] [US3] Write service unit test for `ingestNotification` persistence

**Checkpoint**: US3 independently testable — ingestion endpoint stores notifications.

---

## Phase 6: User Story 4 — Receive Push Notifications (Priority: P2)

**Goal**: Eligible ingestions trigger a best-effort Expo push delivery; token invalidation is handled; failures never block ingestion.

**Independent Test**: Ingest a notification with an active token and default preferences → a push attempt is logged; with push disabled or type muted → no attempt; with `EXPO_PUSH_URL` unreachable → still 201.

- [x] T048 [US4] Implement push eligibility evaluation in `NotificationServiceImpl.java` (`active token` AND `pushEnabled` AND `type ∉ mutedTypes`)
- [x] T049 [US4] Implement `ExpoPushClientImpl.java` to POST `{to, title, body, sound: "default"}` batches to `EXPO_PUSH_URL`, 3s timeout, catch-all log, no rethrow
- [x] T050 [US4] Integrate push call into `ingestNotification` in `NotificationServiceImpl.java` after persistence, only when eligible
- [x] T051 [US4] Handle Expo `DeviceNotRegistered` receipt errors by deactivating the matching token in `PushTokenRepository`
- [x] T052 [P] [US4] Write unit tests for `ExpoPushClient` with `MockRestServiceServer` and `EXPO_PUSH_URL` override
- [x] T053 [P] [US4] Write `@SpringBootTest` integration test for ingestion push-eligibility paths using a stubbed Expo endpoint and Testcontainers

**Checkpoint**: US4 independently testable — push delivery best-effort and non-blocking.

---

## Phase 7: User Story 5 — Manage My Devices (Priority: P2)

**Goal**: Users can register and deregister device push tokens; reassignment across accounts is handled safely.

**Independent Test**: `POST /notification/push-tokens` and `DELETE /notification/push-tokens` behave idempotently, including cross-account reassignment.

- [x] T054 [US5] Implement `registerPushToken(String token)` in `NotificationServiceImpl.java` with upsert-by-token logic: insert (201), same-user touch (200), other-user reassign (200)
- [x] T055 [US5] Implement `deregisterPushToken(String token)` in `NotificationServiceImpl.java` deleting by `(token, userId)` and returning idempotent 204
- [x] T056 [US5] Implement `POST /notification/push-tokens` and `DELETE /notification/push-tokens` endpoints in `NotificationController.java`
- [x] T057 [P] [US5] Write `@WebMvcTest` slice tests for register (201/200/400) and deregister (204/400) including token body path
- [x] T058 [P] [US5] Write service unit tests for token upsert and reassignment

**Checkpoint**: US5 independently testable — token registration/deregistration works.

---

## Phase 8: User Story 6 — Control My Notification Preferences (Priority: P2)

**Goal**: Users can read and replace their notification preferences (global push toggle and muted types).

**Independent Test**: `GET /notification/preferences` returns defaults; `PUT` stores full-replace values; unknown muted type returns 400.

- [x] T059 [US6] Implement `getPreferences()` in `NotificationServiceImpl.java` returning defaults when no row exists
- [x] T060 [US6] Implement `updatePreferences(UpdatePreferencesRequest)` in `NotificationServiceImpl.java` with full-replace semantics and lazy row creation
- [x] T061 [US6] Implement `GET /notification/preferences` and `PUT /notification/preferences` endpoints in `NotificationController.java`
- [x] T062 [P] [US6] Write `@WebMvcTest` slice tests for get preferences (defaults) and put preferences (unknown type → 400, full replace)
- [x] T063 [P] [US6] Write service unit tests for preference read/write

**Checkpoint**: US6 independently testable — preferences endpoints work.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, frontend, infrastructure, and validation.

- [x] T064 [P] Update `docs/database.md` — add `notification` schema overview, `notification_preferences` table, align `notifications.body` to VARCHAR(2000), add indexes
- [x] T065 [P] Create `frontend/types/notification.ts` with TypeScript interfaces matching `NotificationResponse`, `PreferencesResponse`, etc.
- [x] T066 [P] Create `frontend/services/notification.ts` mirroring `services/mentorship.ts` with `request<T>()` wrapper for notification endpoints
- [x] T067 [P] Create `frontend/app/(app)/notifications.tsx` hidden screen showing inbox (newest-first, unread highlighting, tap-to-mark-read, mark-all-read, preferences section)
- [x] T068 [P] Modify `frontend/app/(app)/_layout.tsx` to register the `notifications` hidden screen
- [x] T069 [P] Modify `frontend/app/(app)/index.tsx` to add header bell icon with unread count badge, polling on focus
- [x] T070 [P] Modify auth context in `frontend/context/` to register Expo push token on sign-in and delete it on sign-out
- [x] T071 Add `frontend/app/(app)/notifications.tsx` focus-refresh logic via `useFocusEffect` + `RefreshControl`
- [x] T072 Run `backend/notification-service` `./mvnw verify` locally and verify JaCoCo coverage ≥ 70%
- [x] T073 Run quickstart validation from `specs/012-notification-service/quickstart.md` §1–§7 manually (health, ingestion, inbox, read-state, tokens, preferences, test suite) — verified via backend test suite; full Docker-compose manual run blocked by unavailable Docker environment
- [x] T074 Final pass: check no hardcoded secrets, PII not logged, titles/bodies excluded from push-failure logs, internal endpoint not exposed through nginx
- [x] T075 Run `speckit-analyze` on generated artifacts to verify cross-document consistency

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion; blocks all user stories
- **User Stories (Phase 3–8)**: All depend on Foundational phase completion
  - US1, US2, US3 are P1 and can proceed in parallel after foundation
  - US4, US5, US6 are P2 and can proceed in parallel after foundation; US4 logically needs US5 entities + US6 preferences for full eligibility but its own test path can use seeded data
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational; no other story dependency
- **US2 (P1)**: Can start after Foundational; no other story dependency
- **US3 (P1)**: Can start after Foundational; no other story dependency
- **US4 (P2)**: Can start after Foundational; needs `PushToken` (US5) and `NotificationPreference` (US6) entities present, but can be tested with seeded rows
- **US5 (P2)**: Can start after Foundational; no other story dependency
- **US6 (P2)**: Can start after Foundational; no other story dependency

### Within Each User Story

- Tests first (if included), then service implementation, then controller, then slice/service tests
- Each story complete before moving to the next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- US1, US2, US3 can be implemented in parallel once foundation is ready
- US4, US5, US6 can be implemented in parallel once foundation is ready
- All frontend tasks (T065–T071) can run in parallel after backend endpoints exist
- Documentation updates (T064, T074) can run in parallel with frontend/backend polish

---

## Parallel Example: User Story 1

```bash
# Backend endpoints for US1:
Task T033: Implement getMyNotifications in NotificationServiceImpl.java
Task T034: Implement getUnreadCount in NotificationServiceImpl.java
Task T035: Implement GET endpoints in NotificationController.java

# Verify together:
Task T036: @WebMvcTest slice tests for inbox + count
Task T037: Service unit tests for list + count
```

---

## Implementation Strategy

### MVP First (US1–US3)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1 — inbox + count
4. Complete Phase 4: US2 — read-state
5. Complete Phase 5: US3 — internal ingestion
6. **STOP and VALIDATE**: Run quickstart §1–§4; demo the core notification loop

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 → test independently
3. Add US2 → test independently
4. Add US3 → test independently
5. Add US4–US6 → test independently
6. Polish: frontend, docs, docker-compose, nginx, CI

### Parallel Team Strategy

With multiple developers:

- Team completes Setup + Foundational together
- Once foundation is done:
  - Developer A: US1 + US2
  - Developer B: US3 + US4
  - Developer C: US5 + US6
  - Developer D: frontend + docs

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable per `spec.md` Independent Test clauses
- Tests are written first where possible; verify they fail before implementation
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- Avoid cross-story dependencies that break independence
