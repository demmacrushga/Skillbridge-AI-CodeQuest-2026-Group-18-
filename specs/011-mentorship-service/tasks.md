# Tasks: Mentorship Service

**Input**: Design documents from `/specs/011-mentorship-service/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/mentorship-api.md, quickstart.md

**Tests**: Included — Constitution Principle IV mandates unit tests for business logic and controller-slice tests for all endpoints (JaCoCo ≥ 70%, SC-003/SC-004).

**Organization**: Backend scaffolding is copied from `backend/challenge-service/` (plan Key Reuse). Tasks are grouped by user story; each story phase is an independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 profile, US2 discovery, US3 request, US4 respond, US5 messaging, US6 manage

## Path Conventions

- Backend: `backend/mentorship-service/src/main/java/com/skillbridge/mentorship/` (abbreviated `…/mentorship/` below); resources under `backend/mentorship-service/src/main/resources/`
- Backend tests: `backend/mentorship-service/src/test/java/com/skillbridge/mentorship/`
- Frontend: `frontend/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Service skeleton, copied scaffolding, build + infra wiring

- [X] T001 Create `backend/mentorship-service/` module: `pom.xml` copied from `backend/challenge-service/pom.xml` (artifactId/name/description → `mentorship-service`, "SkillBridge AI — Mentorship Microservice"; keep JaCoCo ≥ 70% with config/security-filter/Application exclusions) and `Dockerfile` (jar glob `mentorship-service-*.jar`, `EXPOSE 8008`)
- [X] T002 Create `MentorshipServiceApplication.java` in `…/mentorship/` and `application.yml` in `backend/mentorship-service/src/main/resources/` (port `${SERVER_PORT:8008}`, `default_schema: mentorship`, flyway `schemas: mentorship`, `accept-case-insensitive-enums: false`, `jwt.secret`, springdoc — copy challenge-service shape)
- [X] T003 [P] Copy security scaffolding into `…/mentorship/security/`: `JwtAuthFilter.java`, `JwtService.java`, `JwtUserDetails.java` (package rename only)
- [X] T004 [P] Copy config scaffolding into `…/mentorship/config/`: `CorrelationIdFilter.java` (verbatim), `SecurityConfig.java` (PUBLIC_ENDPOINTS → `/mentorship/health`, keep `@EnableMethodSecurity`), `StartupLogger.java` (strings → "Mentorship Service", `/mentorship/health`)
- [X] T005 [P] Add infra wiring: `docker-compose.yml` mentorship-service block (context `./backend/mentorship-service`, container `skillbridge-mentorship`, port 8008, standard env) + `- mentorship-service` under gateway `depends_on`; `nginx/nginx.conf` `location /mentorship/ { set $upstream http://mentorship-service:8008; … }` before the catch-all; `.github/workflows/ci.yml` matrix entry `- service: mentorship-service` / `path: backend/mentorship-service`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, entities, repositories, exception plumbing — required by every story

- [X] T006 Create Flyway migrations in `backend/mentorship-service/src/main/resources/db/migration/`: `V1__create_schema.sql`, `V2__create_alumni_profiles.sql` (unique `user_id`, JSONB `career_interests`, `idx_alumni_profiles_available`), `V3__create_mentorship_requests.sql` (partial unique index `uq_request_pending … WHERE status = 'PENDING'`, `idx_requests_alumni`, `idx_requests_student`), `V4__create_mentorship_pairs.sql` (FK → requests, `idx_pairs_student`, `idx_pairs_alumni`), `V5__create_messages.sql` (FK → pairs, `idx_messages_pair`) — columns per data-model.md
- [X] T007 [P] Create enums `RequestStatus` (PENDING, ACCEPTED, DECLINED, CANCELLED) and `PairStatus` (ACTIVE, ENDED) in `…/mentorship/entity/`
- [X] T008 [P] Create entities in `…/mentorship/entity/`: `AlumniProfile.java` (with JSONB `List<String> careerInterests` attribute converter), `MentorshipRequest.java`, `MentorshipPair.java`, `Message.java` — per data-model.md
- [X] T009 Create repositories in `…/mentorship/repository/`: `AlumniProfileRepository` (findByUserId, findByAvailableTrue), `MentorshipRequestRepository` (findByAlumniIdAndStatusOrderByCreatedAtDesc, findByStudentIdOrderByCreatedAtDesc, existsByStudentIdAndAlumniIdAndStatus, findByIdAndAlumniId, findByIdAndStudentId), `MentorshipPairRepository` (participant-scoped finders: findByStudentIdOrAlumniIdOrderByStartedAtDesc, findByIdAndParticipant via @Query, existsByStudentIdAndAlumniIdAndStatus), `MessageRepository` (findByPairIdOrderBySentAtAsc)
- [X] T010 [P] Create exceptions in `…/mentorship/exception/`: `ProfileNotFoundException`, `RequestNotFoundException`, `PairNotFoundException`, `DuplicateRequestException`, `RequestAlreadyResolvedException`, `PairEndedException`, and `GlobalExceptionHandler` (copy challenge-service handler shape; map 404 × 3, 409 × 3, plus standard 400/401/403/500 branches per contracts/mentorship-api.md status table)
- [X] T011 Create `…/mentorship/service/MentorshipService.java` interface and empty `MentorshipServiceImpl.java` + `…/mentorship/controller/MentorshipController.java` with the health endpoint `GET /mentorship/health` → `{"status":"UP"}`
- [ ] T012 Checkpoint: `cd backend/mentorship-service && ./mvnw verify` compiles; `docker-compose up --build -d mentorship-service` starts clean, V1–V5 applied, `curl :8080/mentorship/health` → UP (quickstart §1)

---

## Phase 3: US1 — Maintain a Mentor Profile (P1)

**Goal**: Alumni create/replace/read their own profile (PUT-upsert, tag normalization).
**Independent test**: quickstart §2 — PUT profile as ALUMNI → 200 normalized; GET returns it; STUDENT → 403; empty tags → 400.

- [X] T013 [P] [US1] Create `UpsertProfileRequest` (validation per contract §3) in `…/mentorship/dto/request/` and `ProfileResponse` in `…/mentorship/dto/response/`
- [X] T014 [US1] Implement profile upsert + get in `MentorshipServiceImpl`: upsert keyed on `userId` (create or full replace, refresh `updatedAt`), tag normalization (trim, collapse whitespace, case-insensitive dedupe keeping first casing), get → `ProfileNotFoundException` when absent
- [X] T015 [US1] Add `GET /mentorship/profile` + `PUT /mentorship/profile` to `MentorshipController` with `@PreAuthorize("hasRole('ALUMNI')")`
- [X] T016 [P] [US1] Service unit tests in `…test…/service/MentorshipServiceImplTest.java`: create-then-replace upsert, tag normalization/dedupe, available default true, get-missing → 404 exception
- [X] T017 [P] [US1] Controller-slice tests in `…test…/controller/MentorshipControllerTest.java` (`@WebMvcTest`): 200 PUT/GET happy paths, 400 empty/oversize tags + fieldErrors shape, 401 no token, 403 STUDENT

---

## Phase 4: US2 — Discover Alumni (P1)

**Goal**: Students search available alumni, ranked by tag-overlap count.
**Independent test**: quickstart §3 — 2-tag match ranks above 1-tag; `available:false` disappears; no filters → all available; hand-check order (SC-007).

- [X] T018 [P] [US2] Create `AlumniSearchEntry` + `AlumniSearchResponse` in `…/mentorship/dto/response/`
- [X] T019 [US2] Implement `AlumniSearchService.java` in `…/mentorship/service/`: static `normalize()` (trim/collapse/lowercase); filter `available: true` + optional case-insensitive industry match; rank by matching-tag count DESC, `updatedAt` DESC tie-break (research Decision 3)
- [X] T020 [US2] Add `GET /mentorship/alumni` (repeatable `interest` param, optional `industry`) to `MentorshipController` with `@PreAuthorize("hasRole('STUDENT')")`, wired through `MentorshipServiceImpl`
- [X] T021 [P] [US2] Unit tests in `…test…/service/AlumniSearchServiceTest.java`: rank order + tie-break, case/whitespace-insensitive tag match, industry filter, unavailable excluded, no-filter → all available, empty result, deterministic repeat calls
- [X] T022 [P] [US2] Controller-slice tests: 200 with ranked payload, 401, 403 (ALUMNI caller)

---

## Phase 5: US3 — Send a Mentorship Request (P1)

**Goal**: Student sends (and can cancel) a request; duplicate-pending guarded; MVP loop complete with US1+US2.
**Independent test**: quickstart §4 first half — POST request → 201 PENDING; repeat → 409; unknown/unavailable alumni → 404; cancel → 200 CANCELLED; cancel again → 409; re-send → 201.

- [X] T023 [P] [US3] Create `SendRequestRequest` in `…/mentorship/dto/request/` and `RequestResponse` in `…/mentorship/dto/response/`
- [X] T024 [US3] Implement send/cancel/list-mine in `MentorshipServiceImpl`: send — target profile must exist and be available (else `RequestNotFoundException`-style 404), guard PENDING-request/ACTIVE-pair duplicate (app check + catch `DataIntegrityViolationException` → `DuplicateRequestException`, research Decision 2); cancel — sender-scoped lookup (404), PENDING-only (`RequestAlreadyResolvedException` → 409), set CANCELLED + `respondedAt`; list mine — `createdAt` DESC all statuses
- [X] T025 [US3] Add `POST /mentorship/requests`, `POST /mentorship/requests/{requestId}/cancel`, `GET /mentorship/requests/mine` to `MentorshipController` with `@PreAuthorize("hasRole('STUDENT')")`
- [X] T026 [P] [US3] Service unit tests: happy send, duplicate-pending → 409, active-pair → 409, unique-constraint race → 409, unavailable/unknown alumni → 404, cancel happy + already-resolved → 409 + wrong-sender → 404, re-send after cancel/decline succeeds, list ordering
- [X] T027 [P] [US3] Controller-slice tests: 201 send, 400 missing alumniId/oversize message, 401, 403 (ALUMNI caller), 404, 409; cancel 200/404/409; mine 200

**Checkpoint — MVP**: Phases 1–5 deliver the P1 student loop (profile → discover → request/cancel).

---

## Phase 6: US4 — Respond to a Request (P2)

**Goal**: Alumnus views incoming requests, accepts (creates ACTIVE pair) or declines.
**Independent test**: quickstart §4 second half — incoming lists PENDING; decline → 200 then 409 on repeat; accept → 200 pair ACTIVE; wrong alumnus → 404.

- [X] T028 [P] [US4] Create `PairResponse` in `…/mentorship/dto/response/`
- [X] T029 [US4] Implement incoming/accept/decline in `MentorshipServiceImpl`: incoming — addressee-scoped PENDING `createdAt` DESC; accept — addressee-scoped lookup (404), PENDING-only (409), mark ACCEPTED + `respondedAt`, create ACTIVE `MentorshipPair` with `requestId` provenance in one transaction; decline — same guards, mark DECLINED, no pair
- [X] T030 [US4] Add `GET /mentorship/requests/incoming`, `POST /mentorship/requests/{requestId}/accept`, `POST /mentorship/requests/{requestId}/decline` to `MentorshipController` with `@PreAuthorize("hasRole('ALUMNI')")`
- [X] T031 [P] [US4] Service unit tests: incoming scoping/order, accept creates pair + stamps request, decline creates no pair, already-resolved → 409, wrong-addressee → 404, accepted request enables no further transitions
- [X] T032 [P] [US4] Controller-slice tests: 200 incoming/accept/decline, 401, 403 (STUDENT caller), 404, 409

---

## Phase 7: US5 — Message a Mentor/Mentee (P2)

**Goal**: Paired participants exchange messages; thread fetch marks incoming messages read.
**Independent test**: quickstart §5 — student sends → 201 readAt null; alumni GET thread → readAt stamped; blank body → 400; non-participant → 404.

- [X] T033 [P] [US5] Create `SendMessageRequest` in `…/mentorship/dto/request/` and `MessageResponse` + `ThreadResponse` in `…/mentorship/dto/response/`
- [X] T034 [US5] Implement send/read-thread in `MentorshipServiceImpl`: participant-scoped pair lookup (`PairNotFoundException` → 404); send — ACTIVE only (`PairEndedException` → 409); read — full thread `sentAt` ASC, stamp `readAt` on unread messages where `senderId != caller` in the same transaction (research Decision 6); thread readable on ENDED pairs
- [X] T035 [US5] Add `GET /mentorship/pairs/{pairId}/messages` + `POST /mentorship/pairs/{pairId}/messages` to `MentorshipController` (authenticated, participant-scoped — no role annotation)
- [X] T036 [P] [US5] Service unit tests: send happy, read marks only counterpart's unread messages (sender's own untouched, already-read stable), ended-pair send → 409 / read → 200, non-participant → 404, thread ordering
- [X] T037 [P] [US5] Controller-slice tests: 201 send, 200 thread, 400 blank/oversize body, 401, 404, 409

---

## Phase 8: US6 — Manage My Mentorships (P2)

**Goal**: Both participants list their pairs; either ends an active pair (idempotent).
**Independent test**: quickstart §6 — end → 200 ENDED; end again → 200 unchanged; message after end → 409; thread still readable; pair listed ENDED for both.

- [X] T038 [US6] Implement pairs-mine/end in `MentorshipServiceImpl`: mine — participant-scoped (either side), `startedAt` DESC, both statuses, any authenticated role (empty list for non-participants, FR-010); end — participant-scoped lookup (404), set ENDED + `endedAt` if ACTIVE, idempotent 200 if already ENDED, messages untouched
- [X] T039 [US6] Add `GET /mentorship/pairs/mine` + `POST /mentorship/pairs/{pairId}/end` to `MentorshipController` (authenticated, no role annotation)
- [X] T040 [P] [US6] Service unit tests: mine returns both sides' pairs + ordering + empty-for-outsider, end happy + idempotent repeat + non-participant → 404, end preserves messages
- [X] T041 [P] [US6] Controller-slice tests: 200 mine (incl. empty list for non-participant role), 200 end + idempotent, 401, 404

---

## Phase 9: Frontend

**Purpose**: Expo screens for both roles (plan structure; patterns mirror challenges/challenges-manage)

- [X] T042 [P] Create `frontend/types/mentorship.ts`: `AlumniProfile`, `AlumniSearchEntry`, `MentorshipRequest`, `MentorshipPair`, `Message`, `Thread`, payload types (`UpsertProfilePayload`, `SendRequestPayload`, `SendMessagePayload`)
- [X] T043 [P] Create `frontend/services/mentorship.ts` mirroring `services/challenge.ts` (`request<T>()` helper, Bearer token, `{status,message}` throw; one exported function per endpoint with US comment banners)
- [X] T044 Create shared thread component `frontend/components/mentorship/MessageThread.tsx`: fetch thread on open, oldest-first list, composer (disabled with "ended" notice when pair ENDED), optimistic append on send
- [X] T045 Create `frontend/app/(app)/mentorship.tsx` (student): interest/industry search with ranked results, send-request modal with intro note, my requests list (status chips, cancel button on PENDING), my pairs list with expandable `MessageThread`, `useFocusEffect` + `RefreshControl`
- [X] T046 Create `frontend/app/(app)/mentorship-manage.tsx` (alumni): profile editor (tags, availability toggle, PUT-upsert), incoming requests with accept/decline, my pairs list with expandable `MessageThread` + end-mentorship action
- [X] T047 Register both hidden screens in `frontend/app/(app)/_layout.tsx` (`href: null`, `tabBarStyle: {display:'none'}`) and add the "Mentorship" QuickLink in `frontend/app/(app)/index.tsx` routing `user?.role === 'ALUMNI' ? './mentorship-manage' : './mentorship'`

---

## Phase 10: Polish & Cross-Cutting

- [X] T048 [P] Update `docs/database.md`: add `mentorship.mentorship_requests` section, change `career_interests` TEXT → JSONB, align Schema Overview row wording to `mentorship_requests` (data-model.md reconciliation notes)
- [X] T049 [P] Update `docs/api.md`: add mentorship-service section (12 paths / 14 handlers, pointer to `specs/011-mentorship-service/contracts/mentorship-api.md`) and write `docs/services/mentorship-service.md` in the established narrative style
- [X] T053 Integration tests in `…test…/integration/MentorshipIntegrationTest.java` (`@SpringBootTest` + Testcontainers PostgreSQL; add `org.testcontainers:postgresql` + `junit-jupiter` test-scope deps to `backend/mentorship-service/pom.xml`): request state machine against the real schema (partial unique index blocks second PENDING, allows re-request after CANCEL/DECLINE; concurrent duplicate insert → 409), accept-creates-pair transaction, read-receipt stamping transactionality — satisfies Constitution IV's "integration tests for all API endpoints" for the stateful flows that `@WebMvcTest` slices cannot exercise
- [X] T050 Verify JaCoCo ≥ 70% via `cd backend/mentorship-service && ./mvnw verify`; fill coverage gaps if under threshold (SC-003/SC-004)
- [ ] T051 [P] Run quickstart §1–§6 end-to-end against docker-compose (incl. ranking hand-check, cancel escape hatch, read-receipt stamp, idempotent end); note wall-clock timings for search/thread requests as an SC-002 sanity check
- [ ] T052 Manual mobile QA per quickstart §8 (student search→request loop, alumni profile+respond loop, messaging both directions, end + read-only history, role-routed QuickLink)

---

## Dependencies

```text
Phase 1 (Setup) ──► Phase 2 (Foundational) ──► US1 (P3) ──► US2 (P4) ──► US3 (P5)  ← MVP
                                                                            │
                                                              US4 (P6) ◄────┘  (needs requests from US3)
                                                                 │
                                                              US5 (P7)  (needs pairs from US4)
                                                                 │
                                                              US6 (P8)  (needs pairs from US4; US5 for the 409-after-end check)
Phase 9 (Frontend) — starts after US3 for the student screen; alumni screen needs US4–US6 endpoints
Phase 10 (Polish) — after all above
```

- US2 technically depends only on Phase 3's profiles existing as data (its code is independent of US1's endpoints); US1 → US2 → US3 is priority order, and US3 needs US1's profile availability check.
- US4 consumes US3's requests; US5/US6 consume US4's pairs. Within every story phase, DTO tasks [P] precede service, service precedes controller, tests [P] can run alongside each other once implementation lands.

## Parallel Execution Examples

- **Phase 1**: T003, T004, T005 in parallel after T001–T002.
- **Phase 2**: T007, T008, T010 in parallel after T006; T009 after T008.
- **Per story**: DTO task(s) [P] first, then service → controller sequentially, then both test tasks [P] together (e.g. T016 + T017; T021 + T022; T026 + T027).
- **Phase 9**: T042 + T043 in parallel; T045 + T046 in parallel after T044.
- **Phase 10**: T048, T049, T051 in parallel; T053 and T050 before T051 sign-off (T053 runs in CI with Testcontainers, no manual DB setup).

## Implementation Strategy

**MVP first (Phases 1–5)**: setup + foundation + US1–US3 delivers the full P1 student loop — an alumnus publishes a profile, a student finds them and sends (or cancels) a request. Independently demoable via quickstart §1–§4 (first half).

**Increment 2 (Phases 6–8)**: US4–US6 complete the relationship lifecycle — accept/decline, messaging with read receipts, end-with-history.

**Increment 3 (Phases 9–10)**: frontend screens, docs, coverage gate, end-to-end + mobile QA.
