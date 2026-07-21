---
description: "Task list for Matching Service"
---

# Tasks: Matching Service

**Input**: Design documents from `/specs/009-matching-service/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/matching-api.md

**Tests**: INCLUDED — required by Constitution IV (Test Coverage by Layer) and SC-003/SC-004 (JaCoCo ≥ 70%).

**Organization**: Grouped by user story (US1–US6) for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US6 maps to the spec user stories
- Backend base package: `com.skillbridge.matching` under `backend/matching-service/`
- Frontend base: `frontend/`

## Path Conventions

- **Backend**: `backend/matching-service/src/main/java/com/skillbridge/matching/`
- **Backend tests**: `backend/matching-service/src/test/java/com/skillbridge/matching/`
- **Migrations**: `backend/matching-service/src/main/resources/db/migration/`
- **Frontend**: `frontend/app/(app)/`, `frontend/services/`, `frontend/types/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: New service scaffold and build config

- [X] T001 Create `backend/matching-service/` directory tree mirroring `mock-interview-service` (config, controller, dto, entity, enums, exception, repository, security, service packages)
- [X] T002 Create `backend/matching-service/pom.xml` — parent `spring-boot-starter-parent:3.3.6`, Java 21, artifactId `matching-service`, deps: web/security/data-jpa/validation, flyway + flyway-database-postgresql, postgresql, jjwt 0.12.5, springdoc 2.5.0, lombok, test + spring-security-test; JaCoCo plugin ≥ 70% excluding config/security/Application
- [X] T003 [P] Create `backend/matching-service/Dockerfile` — two-stage Maven + eclipse-temurin:21-jre-alpine, `EXPOSE 8006`
- [X] T004 [P] Copy `mvnw`/`mvnw.cmd`/`.mvn` wrapper from mock-interview-service into `backend/matching-service/`
- [X] T005 Create `backend/matching-service/src/main/resources/application.yml` — `SERVER_PORT:8006`, `hibernate.default_schema: matching`, `flyway.schemas: matching`; NO anthropic/whisper/multipart config (this service has no external AI calls)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Scaffolding, security, DB, entities, and plumbing that ALL stories depend on

- [X] T006 Create `MatchingServiceApplication.java` (`@SpringBootApplication`)
- [X] T007 [P] Copy `security/JwtService.java`, `security/JwtUserDetails.java`, `security/JwtAuthFilter.java` from mock-interview-service, adjusting package to `com.skillbridge.matching`
- [X] T008 [P] Copy `config/CorrelationIdFilter.java` and `config/StartupLogger.java` from mock-interview-service (drop the Whisper probe block from StartupLogger)
- [X] T009 Create `config/SecurityConfig.java` — stateless, PUBLIC_ENDPOINTS = swagger + `/matching/health`, correlationId then jwt filters, **plus `@EnableMethodSecurity`** (research Decision 4 — first service with role guards)
- [X] T010 [P] Create Flyway `db/migration/V1__create_schema.sql` (`CREATE SCHEMA IF NOT EXISTS matching`)
- [X] T011 [P] Create Flyway `db/migration/V2__create_opportunities.sql` — `opportunities` (incl. `external_url VARCHAR(2048) NULL`) + `opportunity_skills` (FK CASCADE), indexes on `(active, deadline)` and `opportunity_id` per data-model.md
- [X] T012 [P] Create Flyway `db/migration/V3__create_applications.sql` — `applications` + UNIQUE `(student_id, opportunity_id)` + indexes on `student_id`, `opportunity_id`
- [X] T013 [P] Create Flyway `db/migration/V4__create_student_skills.sql` — `student_skills` + functional UNIQUE index `(student_id, lower(skill_name))` + index on `student_id`
- [X] T014 [P] Create `enums/OpportunityType.java` (INTERNSHIP, ENTRY_LEVEL — case-sensitive, string-stored)
- [X] T015 [P] Create `entity/Opportunity.java` (UUID PK, postedBy UUID, externalUrl nullable, `@OneToMany` skills cascade/orphan, `@OrderBy id`)
- [X] T016 [P] Create `entity/OpportunitySkill.java` (UUID PK, `@ManyToOne LAZY` opportunity, skillName, required boolean)
- [X] T017 [P] Create `entity/Application.java` (UUID PK, studentId UUID, `@ManyToOne LAZY` opportunity, appliedAt)
- [X] T018 [P] Create `entity/StudentSkill.java` (UUID PK, studentId UUID, skillName)
- [X] T019 [P] Create `repository/OpportunityRepository.java` — eligible-matches query (`active = true AND (deadline IS NULL OR deadline >= CURRENT_DATE)`), `findByPostedByOrderByCreatedAtDesc`
- [X] T020 [P] Create `repository/ApplicationRepository.java` — `existsByStudentIdAndOpportunityId`, `findByStudentIdOrderByAppliedAtDesc`, `findByOpportunityIdOrderByAppliedAtDesc`, `countByOpportunityId`
- [X] T021 [P] Create `repository/StudentSkillRepository.java` — `findByStudentId`, `deleteByStudentId`
- [X] T022 [P] Create exceptions: `OpportunityNotFoundException`, `DuplicateApplicationException`
- [X] T023 Create `exception/GlobalExceptionHandler.java` — uniform `{error,status}`: NotFound→404, Duplicate→409, validation→400, `AccessDeniedException`→403 (role guards)
- [X] T024 [P] Create `dto/request/PostOpportunityRequest.java` (@NotBlank title/companyName/description, @NotNull type, @FutureOrPresent deadline, externalUrl @Pattern(http/https) @Size(max=2048), @NotEmpty @Size(max=30) requiredSkills), `dto/request/SkillRequirementRequest.java`, `dto/request/UpdateSkillsRequest.java` (@NotNull @Size(max=50), entries @NotBlank @Size(max=150))
- [X] T025 [P] Create `dto/response/` records: `OpportunityResponse`, `MatchResponse`, `MatchListResponse`, `ApplicationResponse` (incl. externalUrl), `ApplicationWithOpportunityResponse`, `ApplicantResponse`, `SkillsResponse`

**Checkpoint**: Service boots, migrations run, `/matching/health` returns 200 (wired in US1).

---

## Phase 3: User Story 1 — Post an Opportunity (P1)

**Goal**: Recruiter creates a listing (optionally external) with required skills; persisted immediately.

**Independent Test**: POST `/matching/opportunities` → 201 with all fields incl. `externalUrl` echo and `applicantCount: 0`.

- [X] T026 [US1] Implement `MatchingService` interface + `MatchingServiceImpl.postOpportunity(request, userId)` — persist opportunity + skills, return `OpportunityResponse`
- [X] T027 [US1] Add `POST /matching/opportunities` to `MatchingController` (`@PreAuthorize("hasRole('RECRUITER')")`, `@Valid` body, `@AuthenticationPrincipal`, 201)
- [X] T028 [US1] Add `GET /matching/health` (public) to controller
- [X] T029 [P] [US1] Unit test `MatchingServiceImplTest` — post persists skills + externalUrl, defaults `active: true`
- [X] T030 [P] [US1] Controller-slice test `MatchingControllerTest` for POST /opportunities — 201 happy, 400 blank title/description, 400 invalid/lowercase type, 400 empty skills, 400 past deadline (today OK), 400 malformed externalUrl, 403 STUDENT, 401

**Checkpoint**: US1 independently testable — opportunities exist in the system.

---

## Phase 4: User Story 2 — View Ranked Matches (P1)

**Goal**: Student sees active, non-expired listings scored 0–100 by the deterministic formula, ranked.

**Independent Test**: GET `/matching/opportunities` → 200 `matches` ordered by `matchScore` DESC with 1-based `rank` and `applied` flag.

- [X] T031 [US2] Create `service/MatchScoringService.java` — formula per research Decision 1 (required weight 2.0, nice-to-have 1.0; `100 × matched/total`, 2dp; case-insensitive trimmed comparison; empty student profile → 0.00)
- [X] T032 [US2] Implement `MatchingServiceImpl.getMatches(userId)` — eligible query, load caller skills, score each, sort score DESC then createdAt DESC, assign rank, set `applied` flag via `existsByStudentIdAndOpportunityId`
- [X] T033 [US2] Add `GET /matching/opportunities` to controller (any authenticated role — no `@PreAuthorize`)
- [X] T034 [P] [US2] Unit test `MatchScoringServiceTest` — quickstart §5 math (2 must-haves of 3 skills → 80.00), must-have weighted over nice-to-have, case-insensitivity, empty profile floor, deterministic repeat
- [X] T035 [P] [US2] Controller-slice test — ranked order + rank values, inactive excluded, past-deadline excluded, today-deadline included, empty matches array, `applied` flag true/false

**Checkpoint**: US1→US2 = recruiter posts → student sees ranked matches (core demo beat).

---

## Phase 5: User Story 3 — Apply to an Opportunity (P1)

**Goal**: One-tap apply; duplicate → 409; external postings return the URL (click-tracking).

**Independent Test**: POST `.../apply` → 201; repeat → 409; external posting's 201 includes `externalUrl`.

- [X] T036 [US3] Implement `MatchingServiceImpl.apply(opportunityId, userId)` — 404 unknown/inactive/expired, 409 duplicate (check `existsBy...` + catch unique-constraint violation as race fallback), return `ApplicationResponse` with `externalUrl` from the opportunity
- [X] T037 [US3] Add `POST /matching/opportunities/{id}/apply` to controller (`@PreAuthorize("hasRole('STUDENT')")`, 201)
- [X] T038 [P] [US3] Unit test — happy path, inactive → 404, expired → 404, duplicate → 409, externalUrl propagated
- [X] T039 [P] [US3] Controller-slice test — 201 happy, 403 RECRUITER, 404, 409

**Checkpoint**: US1→US3 = full student MVP loop (post → match → apply).

---

## Phase 6: User Story 4 — View My Applications (P2)

**Goal**: Student lists own applications with opportunity summary, newest first.

**Independent Test**: GET `/matching/applications` → 200 array ordered `appliedAt` DESC (empty array when none).

- [X] T040 [US4] Implement `MatchingServiceImpl.getApplications(userId)` → `List<ApplicationWithOpportunityResponse>` (includes deactivated postings — history preserved)
- [X] T041 [US4] Add `GET /matching/applications` to controller (`@PreAuthorize("hasRole('STUDENT')")`)
- [X] T042 [P] [US4] Controller-slice test — populated list ordered DESC incl. deactivated posting, empty array, 403 RECRUITER

**Checkpoint**: US4 testable on top of US3 data.

---

## Phase 7: User Story 5 — Manage Matching Skill Profile (P2)

**Goal**: Student views and replaces the skill list that drives scoring.

**Independent Test**: PUT skills → GET returns normalized list; next matches fetch reflects the change.

- [X] T043 [US5] Implement `MatchingServiceImpl.getSkills(userId)` and `updateSkills(request, userId)` — replace semantics in one transaction (delete + insert), normalize (trim, collapse whitespace), dedupe case-insensitively, return stored list
- [X] T044 [US5] Add `GET /matching/profile/skills` and `PUT /matching/profile/skills` to controller (`@PreAuthorize("hasRole('STUDENT')")`)
- [X] T045 [P] [US5] Unit test — replace semantics (removed skills deleted), trim/collapse normalization, case-insensitive dedupe, empty list valid, >50 rejected
- [X] T046 [P] [US5] Controller-slice test — 200 get empty/populated, 200 put returns stored list, 400 blank entry, 400 >50, 403 RECRUITER

**Checkpoint**: US5 testable — profile edits move match scores (verify against US2 endpoint).

---

## Phase 8: User Story 6 — Manage Own Postings and View Applicants (P2)

**Goal**: Recruiter lists own postings (with applicant counts), deactivates, views applicants.

**Independent Test**: GET `/mine` → own postings only; deactivate → gone from student matches; GET `.../applications` → applicants DESC.

- [X] T047 [US6] Implement `MatchingServiceImpl.getMyPostings(userId)` (with live `countByOpportunityId`), `deactivate(id, userId)` (404 not owned, idempotent 200), `getApplicants(id, userId)` (404 not owned → `[ApplicantResponse]` DESC)
- [X] T048 [US6] Add `GET /matching/opportunities/mine`, `POST /matching/opportunities/{id}/deactivate`, `GET /matching/opportunities/{id}/applications` to controller (`@PreAuthorize("hasRole('RECRUITER')")`)
- [X] T049 [P] [US6] Unit test — ownership 404s, deactivate idempotent, applicantCount accuracy
- [X] T050 [P] [US6] Controller-slice test — mine list (own only + includes inactive), deactivate 200/404, applicants 200/empty/404, 403 STUDENT on all three

**Checkpoint**: All 9 protected endpoints complete.

---

## Phase 9: Infrastructure Wiring

**Purpose**: Make the service reachable and CI-covered

- [X] T051 Add `matching-service` block to `docker-compose.yml` (port 8006, datasource/JWT env, `SERVER_PORT:8006`, depends_on postgres healthy); add to `gateway.depends_on`
- [X] T052 Add `location /matching/` to `nginx/nginx.conf` — follow the resolver-variable style currently in the file (`set $upstream http://matching-service:8006;`)
- [X] T053 [P] Add `{ service: matching-service, path: backend/matching-service }` to `.github/workflows/ci.yml` matrix

---

## Phase 10: Frontend

**Purpose**: Mobile UI for student loop + recruiter management (hidden screens, research Decision 6)

- [X] T054 [P] Create `frontend/types/matching.ts` — `OpportunityType`, `SkillRequirement`, `Opportunity`, `Match`, `ApplicationWithOpportunity`, `Applicant`, request payloads
- [X] T055 Create `frontend/services/matching.ts` mirroring `services/mockInterview.ts` — `postOpportunity`, `getMatches`, `apply`, `getApplications`, `getSkills`, `updateSkills`, `getMyPostings`, `deactivate`, `getApplicants`
- [X] T056 [US2][US3][US4][US5] Create `frontend/app/(app)/opportunities.tsx` — `useFocusEffect` fetch of matches; score badge + "External ↗" badge on cards; expandable detail; Apply button (optimistic → `applied` state; on 201 with externalUrl open it via `Linking`); "My Applications" section; "Edit skills" chip editor calling PUT then refetching matches
- [X] T057 [US1][US6] Create `frontend/app/(app)/opportunities-manage.tsx` — post form (title, company, description, location, type picker, optional deadline, optional externalUrl, skill editor with must-have toggle); my postings list with applicant counts; deactivate with confirm; per-posting applicants list
- [X] T058 Register both screens in `frontend/app/(app)/_layout.tsx` (`href: null`, tab bar hidden)
- [X] T059 Update `frontend/app/(app)/index.tsx` — "Opportunities" `QuickLink` routing by role (`RECRUITER` → manage screen, else student screen); remove the last `ComingSoonCard` ("Internship Matches") and the now-empty Coming Soon section

---

## Phase 11: Polish & Cross-Cutting

- [X] T060 [P] Verify JaCoCo ≥ 70% (`./mvnw verify` in `backend/matching-service/`); add tests if short
- [X] T061 [P] Update `docs/api.md` with the 10 matching endpoints (replace the 3-endpoint sketch)
- [ ] T062 [P] Run `quickstart.md` §1–§7 end-to-end against docker-compose (incl. external-URL variant + hand-checked 80.00 score)
- [ ] T063 Manual mobile QA per quickstart §8 (student loop + recruiter manage + role-routed QuickLink)

---

## Dependencies & Story Completion Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** block everything.
- **US1 (post)** → prerequisite for US2/US3/US4/US6 (need opportunities).
- **US2 (matches)** depends on US1 data + US5's skill storage existing (T018/T021 foundational entities suffice; US5's *endpoints* are independent).
- **US3 (apply)** → prerequisite for US4 (applications list) and feeds US6 (applicant views).
- **US5 (skills)** is independently testable; it only *influences* US2 scores.
- **US6 (manage)** depends on US1 (postings) and US3 (applicants).
- **Infra (Phase 9)** can run in parallel with backend once controller paths exist; needed before frontend E2E.
- **Frontend (Phase 10)** depends on backend endpoints + infra routing.

## Parallel Execution Examples

- Foundational: T007–T008, T010–T022, T024–T025 are all `[P]` (distinct files).
- Per story, the two test tasks (`[P]`) run alongside each other once the impl task lands.
- Infra: T053 `[P]` independent of T051/T052.
- Frontend: T054 `[P]` (types) before T055 (service); T056/T057 (screens) are independent of each other once T055 lands; T058/T059 follow the screens.
- US2: T031 (scoring service) can start while T030 (US1 controller test) finishes — different files.

## Implementation Strategy

**MVP = Phases 1–5 + minimal infra (T051–T052)** → working loop (post → ranked matches → apply) reachable through the gateway. Ship, then layer US4/US5/US6, then the frontend, then polish.

**Note**: No AI integration in this service — the first service with no Claude/Whisper dependency. Scoring correctness is fully covered by deterministic unit tests (T034).

---

**Total tasks**: 63
**Per story**: US1 = 5, US2 = 5, US3 = 4, US4 = 3, US5 = 4, US6 = 4 (remainder: Setup 5, Foundational 20, Infra 3, Frontend 6, Polish 4)
