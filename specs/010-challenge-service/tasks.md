---
description: "Task list for Challenge Service"
---

# Tasks: Challenge Service

**Input**: Design documents from `/specs/010-challenge-service/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/challenge-api.md

**Tests**: INCLUDED — required by Constitution IV (Test Coverage by Layer) and SC-003/SC-004 (JaCoCo ≥ 70%).

**Organization**: Grouped by user story (US1–US7) for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US7 maps to the spec user stories
- Backend base package: `com.skillbridge.challenge` under `backend/challenge-service/`
- Frontend base: `frontend/`

## Path Conventions

- **Backend**: `backend/challenge-service/src/main/java/com/skillbridge/challenge/`
- **Backend tests**: `backend/challenge-service/src/test/java/com/skillbridge/challenge/`
- **Migrations**: `backend/challenge-service/src/main/resources/db/migration/`
- **Frontend**: `frontend/app/(app)/`, `frontend/services/`, `frontend/types/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: New service scaffold and build config

- [X] T001 Create `backend/challenge-service/` directory tree mirroring `matching-service` (config, controller, dto, entity, exception, repository, security, service packages)
- [X] T002 Create `backend/challenge-service/pom.xml` — parent `spring-boot-starter-parent:3.3.6`, Java 21, artifactId `challenge-service`, deps: web/security/data-jpa/validation, flyway + flyway-database-postgresql, postgresql, jjwt 0.12.5, springdoc 2.5.0, lombok, test + spring-security-test; JaCoCo plugin ≥ 70% excluding config/security/Application
- [X] T003 [P] Create `backend/challenge-service/Dockerfile` — two-stage Maven + eclipse-temurin:21-jre-alpine, `EXPOSE 8007`
- [X] T004 [P] Copy `mvnw`/`mvnw.cmd`/`.mvn` wrapper from matching-service into `backend/challenge-service/`
- [X] T005 Create `backend/challenge-service/src/main/resources/application.yml` — `SERVER_PORT:8007`, `hibernate.default_schema: challenge`, `flyway.schemas: challenge`; NO anthropic/whisper/multipart config (this service has no external AI calls)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Scaffolding, security, DB, entities, and plumbing that ALL stories depend on

- [X] T006 Create `ChallengeServiceApplication.java` (`@SpringBootApplication`)
- [X] T007 [P] Copy `security/JwtService.java`, `security/JwtUserDetails.java`, `security/JwtAuthFilter.java` from matching-service, adjusting package to `com.skillbridge.challenge`
- [X] T008 [P] Copy `config/CorrelationIdFilter.java` and `config/StartupLogger.java` from matching-service
- [X] T009 Create `config/SecurityConfig.java` — copy from matching-service (incl. `@EnableMethodSecurity`); stateless, PUBLIC_ENDPOINTS = swagger + `/challenge/health`, correlationId then jwt filters
- [X] T010 [P] Create Flyway `db/migration/V1__create_schema.sql` (`CREATE SCHEMA IF NOT EXISTS challenge`)
- [X] T011 [P] Create Flyway `db/migration/V2__create_challenges.sql` — `challenges` table per data-model.md, indexes on `(active, deadline)` and `posted_by`
- [X] T012 [P] Create Flyway `db/migration/V3__create_submissions.sql` — `submissions` table, UNIQUE `(challenge_id, student_id)`, indexes on `student_id`, `challenge_id`, plus partial index `(challenge_id) WHERE score IS NOT NULL` for leaderboard reads
- [X] T013 [P] Create `entity/Challenge.java` (UUID PK, postedBy UUID, title, description, submissionFormat, deadline, active, createdAt)
- [X] T014 [P] Create `entity/Submission.java` (UUID PK, `@ManyToOne LAZY` challenge, studentId UUID, submissionUrl, score NUMERIC(5,2) nullable, submittedAt)
- [X] T015 [P] Create `repository/ChallengeRepository.java` — browse query (`active = true AND deadline > CURRENT_TIMESTAMP` ordered createdAt DESC), `findByPostedByOrderByCreatedAtDesc`
- [X] T016 [P] Create `repository/SubmissionRepository.java` — `existsByChallengeIdAndStudentId`, `findByChallengeIdOrderBySubmittedAtDesc`, `findByStudentIdOrderBySubmittedAtDesc`, `countByChallengeId`, `findByChallengeIdAndScoreIsNotNull`
- [X] T017 [P] Create exceptions: `ChallengeNotFoundException`, `DuplicateSubmissionException`
- [X] T018 Create `exception/GlobalExceptionHandler.java` — uniform `{error,status}`: NotFound→404, Duplicate→409, validation→400, `AccessDeniedException`→403 (role guards)
- [X] T019 [P] Create `dto/request/PostChallengeRequest.java` (@NotBlank @Size(max=255) title, @NotBlank @Size(max=5000) description, @NotBlank @Size(max=2000) submissionFormat, @NotNull @Future deadline), `dto/request/SubmitSolutionRequest.java` (@NotBlank @Pattern(http/https) @Size(max=2048) submissionUrl), `dto/request/ScoreSubmissionRequest.java` (@NotNull @DecimalMin("0.00") @DecimalMax("100.00") @Digits(integer=3, fraction=2) score)
- [X] T020 [P] Create `dto/response/` records: `ChallengeResponse`, `ChallengeListEntry`, `ChallengeListResponse`, `SubmissionResponse`, `MySubmissionResponse`, `SubmissionReviewResponse`, `LeaderboardResponse` per data-model.md

**Checkpoint**: Service boots, migrations run, `/challenge/health` returns 200 (wired in US1).

---

## Phase 3: User Story 1 — Post a Challenge (P1)

**Goal**: Recruiter creates a challenge with submission instructions and a deadline; persisted immediately.

**Independent Test**: POST `/challenge` → 201 with all fields echoed, `active: true`, `submissionCount: 0`.

- [X] T021 [US1] Implement `ChallengeService` interface + `ChallengeServiceImpl.postChallenge(request, userId)` — persist challenge, return `ChallengeResponse`
- [X] T022 [US1] Add `POST /challenge` to `ChallengeController` (`@PreAuthorize("hasRole('RECRUITER')")`, `@Valid` body, `@AuthenticationPrincipal`, 201)
- [X] T023 [US1] Add `GET /challenge/health` (public) to controller
- [X] T024 [P] [US1] Unit test `ChallengeServiceImplTest` — post persists all fields, defaults `active: true`, `submissionCount: 0`
- [X] T025 [P] [US1] Controller-slice test `ChallengeControllerTest` for POST /challenge — 201 happy, 400 blank title/description/submissionFormat, 400 missing deadline, 400 past deadline, 403 STUDENT, 401

**Checkpoint**: US1 independently testable — challenges exist in the system.

---

## Phase 4: User Story 2 — Browse Active Challenges (P1)

**Goal**: Any authenticated user sees active, non-expired challenges newest-first with a per-entry `submitted` flag.

**Independent Test**: GET `/challenge` → 200 `challenges` ordered `createdAt` DESC; after submitting, entry shows `submitted: true`.

- [X] T026 [US2] Implement `ChallengeServiceImpl.getActiveChallenges(userId)` — eligible browse query; load caller's submissions once (`findByStudentId…`), build challenge-id set, map entries with `submitted` flag (always false for RECRUITER callers); no N+1 existsBy calls
- [X] T027 [US2] Add `GET /challenge` to controller (any authenticated role — no `@PreAuthorize`)
- [X] T028 [P] [US2] Unit test — inactive excluded, expired excluded, boundary (future deadline included), `submitted` true/false, false for recruiter, empty list
- [X] T029 [P] [US2] Controller-slice test — 200 ordered DESC, `submitted` flag echoed, empty array, 401

**Checkpoint**: US1→US2 = recruiter posts → student sees the board (core discovery beat).

---

## Phase 5: User Story 3 — Submit a Solution (P1)

**Goal**: Student submits a solution link; duplicate → 409; expired/inactive → 404.

**Independent Test**: POST `.../submissions` → 201 with `score: null`; repeat → 409; browse re-fetch → `submitted: true`.

- [X] T030 [US3] Implement `ChallengeServiceImpl.submit(challengeId, request, userId)` — 404 unknown/inactive/expired, 409 duplicate (check `existsBy…` + catch unique-constraint violation as race fallback), persist and return `SubmissionResponse`
- [X] T031 [US3] Add `POST /challenge/{id}/submissions` to controller (`@PreAuthorize("hasRole('STUDENT')")`, `@Valid` body, 201)
- [X] T032 [P] [US3] Unit test — happy path, unknown → 404, inactive → 404, expired → 404, duplicate → 409 (incl. constraint-violation fallback), URL propagated
- [X] T033 [P] [US3] Controller-slice test — 201 happy, 400 blank/malformed URL, 403 RECRUITER, 404, 409

**Checkpoint**: US1→US3 = full student MVP loop (post → browse → submit).

---

## Phase 6: User Story 4 — View My Submissions (P2)

**Goal**: Student lists own submissions with challenge summary and score, newest first.

**Independent Test**: GET `/challenge/my-submissions` → 200 array ordered `submittedAt` DESC (empty array when none).

- [X] T034 [US4] Implement `ChallengeServiceImpl.getMySubmissions(userId)` → `List<MySubmissionResponse>` (includes expired/deactivated challenges — history preserved; challenge embedded with `submissionCount: null`)
- [X] T035 [US4] Add `GET /challenge/my-submissions` to controller (`@PreAuthorize("hasRole('STUDENT')")`)
- [X] T036 [P] [US4] Controller-slice test — populated list ordered DESC incl. deactivated challenge, `score` null vs assigned, empty array, 403 RECRUITER

**Checkpoint**: US4 testable on top of US3 data.

---

## Phase 7: User Story 5 — Score Submissions (P2)

**Goal**: Owning recruiter reviews submissions and assigns/revises scores 0.00–100.00; scoring stays open after deadline and deactivation.

**Independent Test**: GET `.../submissions` → submissions with `score: null`; POST `.../score` → 200 with score persisted; re-POST → revised; scoring a deactivated challenge's submission → 200.

- [X] T037 [US5] Implement `ChallengeServiceImpl.getSubmissionsForReview(challengeId, userId)` (404 unknown/not owned → `[SubmissionReviewResponse]` DESC) and `scoreSubmission(challengeId, submissionId, request, userId)` (404 not owned, 404 submission not in challenge, upsert score, NO active/deadline guard — research Decision 1)
- [X] T038 [US5] Add `GET /challenge/{id}/submissions` and `POST /challenge/{id}/submissions/{submissionId}/score` to controller (`@PreAuthorize("hasRole('RECRUITER')")`)
- [X] T039 [P] [US5] Unit test — review list 404 not owned, score happy, upsert revision, score on expired challenge → success, score on deactivated challenge → success, submission-id mismatch → 404
- [X] T040 [P] [US5] Controller-slice test — 200 review, 200 score, 400 missing/negative/>100 score, 400 >2 decimal places (e.g. 85.555), 403 STUDENT, 404

**Checkpoint**: Scores exist; leaderboard (US6) has data to rank.

---

## Phase 8: User Story 6 — View Leaderboard (P2)

**Goal**: Any authenticated user sees a challenge's scored submissions ranked, deterministic on repeat.

**Independent Test**: With two equal scores, earlier submission ranks 1; unscored submissions absent; unknown id → 404.

- [X] T041 [US6] Create `service/LeaderboardService.java` — ranking per research Decision 2 (scored only; `score` DESC then `submittedAt` ASC; 1-based rank)
- [X] T042 [US6] Implement `ChallengeServiceImpl.getLeaderboard(challengeId)` — 404 unknown id; works for expired/deactivated challenges; delegates ranking to `LeaderboardService`
- [X] T043 [US6] Add `GET /challenge/{id}/leaderboard` to controller (any authenticated role — no `@PreAuthorize`)
- [X] T044 [P] [US6] Unit test `LeaderboardServiceTest` — DESC ordering, equal scores → earlier `submittedAt` wins, unscored excluded, empty → empty entries, deterministic repeat
- [X] T045 [P] [US6] Controller-slice test — 200 ranked entries with 1-based ranks, empty entries array, 404 unknown, 401

**Checkpoint**: The competitive payoff is live end-to-end (US3→US5→US6).

---

## Phase 9: User Story 7 — Manage Own Challenges (P2)

**Goal**: Recruiter lists own challenges (with submission counts), deactivates; data preserved.

**Independent Test**: GET `/mine` → own only, incl. inactive; deactivate → gone from browse, submissions → 404, second deactivate → 200.

- [X] T046 [US7] Implement `ChallengeServiceImpl.getMyChallenges(userId)` (with live `countByChallengeId`) and `deactivate(id, userId)` (404 not owned, idempotent 200)
- [X] T047 [US7] Add `GET /challenge/mine` and `POST /challenge/{id}/deactivate` to controller (`@PreAuthorize("hasRole('RECRUITER')")`)
- [X] T048 [P] [US7] Unit test — ownership 404s, deactivate idempotent, `submissionCount` accuracy, mine includes inactive
- [X] T049 [P] [US7] Controller-slice test — mine list (own only + includes inactive), deactivate 200/404, 403 STUDENT on both

**Checkpoint**: All 9 protected endpoints complete.

---

## Phase 10: Infrastructure Wiring

**Purpose**: Make the service reachable and CI-covered

- [X] T050 Add `challenge-service` block to `docker-compose.yml` (port 8007, datasource/JWT env, `SERVER_PORT:8007`, depends_on postgres healthy); add to `gateway.depends_on`
- [X] T051 Add `location /challenge/` to `nginx/nginx.conf` — follow the resolver-variable style (`set $upstream http://challenge-service:8007;`)
- [X] T052 [P] Add `{ service: challenge-service, path: backend/challenge-service }` to `.github/workflows/ci.yml` matrix

---

## Phase 11: Frontend

**Purpose**: Mobile UI for student loop + recruiter management (hidden screens, research Decision 7)

- [X] T053 [P] Create `frontend/types/challenge.ts` — `Challenge`, `ChallengeListEntry`, `Submission`, `MySubmission`, `SubmissionReview`, `LeaderboardEntry`, request payloads
- [X] T054 Create `frontend/services/challenge.ts` mirroring `services/matching.ts` — `postChallenge`, `getChallenges`, `submit`, `getMySubmissions`, `getLeaderboard`, `getMyChallenges`, `getSubmissions`, `scoreSubmission`, `deactivate`
- [X] T055 [US2][US3][US4] Create `frontend/app/(app)/challenges.tsx` — `useFocusEffect` fetch of challenges; expandable cards (description + submissionFormat); Submit URL input (optimistic → `submitted` state); "My Submissions" section showing score or "Score pending"; leaderboard link per challenge rendering anonymized labels ("Student a1b2…")
- [X] T056 [US1][US5][US7] Create `frontend/app/(app)/challenges-manage.tsx` — post form (title, description, submissionFormat, deadline); my challenges list with submission counts; per-challenge submissions review with score input (2dp); deactivate with confirm
- [X] T057 Register both screens in `frontend/app/(app)/_layout.tsx` (`href: null`, tab bar hidden)
- [X] T058 Update `frontend/app/(app)/index.tsx` — "Challenges" `QuickLink` (`trophy-outline`) routing by role (`RECRUITER` → manage screen, else student screen)

---

## Phase 12: Polish & Cross-Cutting

- [X] T059 [P] Verify JaCoCo ≥ 70% (`./mvnw verify` in `backend/challenge-service/`); add tests if short
- [X] T060 [P] Update `docs/api.md` with the 10 challenge endpoints (replace the 4-endpoint sketch); note in `docs/database.md` that `leaderboard_entries` is deferred (computed at request time in v1)
- [ ] T061 [P] Run `quickstart.md` §1–§8 end-to-end against docker-compose (incl. tie-break hand-check + score-after-deactivate check)
- [ ] T062 Manual mobile QA per quickstart §9 (student loop + recruiter manage + role-routed QuickLink)

---

## Dependencies & Story Completion Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** block everything.
- **US1 (post)** → prerequisite for US2/US3/US5/US7 (need challenges).
- **US2 (browse)** depends on US1 data only.
- **US3 (submit)** → prerequisite for US4 (my submissions), US5 (scoring), and feeds the `submitted` flag in US2.
- **US5 (scoring)** depends on US3 (submissions); **US6 (leaderboard)** depends on US5 (scores).
- **US7 (manage)** depends on US1 (challenges) and is strengthened by US3 (counts).
- **Infra (Phase 10)** can run in parallel with backend once controller paths exist; needed before frontend E2E.
- **Frontend (Phase 11)** depends on backend endpoints + infra routing.

## Parallel Execution Examples

- Foundational: T007–T008, T010–T017, T019–T020 are all `[P]` (distinct files).
- Per story, the two test tasks (`[P]`) run alongside each other once the impl task lands.
- US6: T041 (`LeaderboardService`) can start while US5 tests finish — different files.
- Infra: T052 `[P]` independent of T050/T051.
- Frontend: T053 `[P]` (types) before T054 (service); T055/T056 (screens) are independent of each other once T054 lands; T057/T058 follow the screens.

## Implementation Strategy

**MVP = Phases 1–5 + minimal infra (T050–T051)** → working loop (post → browse → submit) reachable through the gateway. Ship, then layer US4/US5/US6/US7, then the frontend, then polish.

**Note**: No AI integration in this service — second service (after matching) with no Claude/Whisper dependency. Leaderboard correctness is fully covered by deterministic unit tests (T044).

---

**Total tasks**: 62
**Per story**: US1 = 5, US2 = 4, US3 = 4, US4 = 3, US5 = 4, US6 = 5, US7 = 4 (remainder: Setup 5, Foundational 15, Infra 3, Frontend 6, Polish 4)
