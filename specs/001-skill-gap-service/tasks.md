 ---
description: "Task list for skill-gap-service implementation"
---

# Tasks: skill-gap-service

**Input**: Design documents from `specs/001-skill-gap-service/`

**Prerequisites**: plan.md ✅ | spec.md ✅

**Tests**: Included in Phase 5 (constitution Principle IV mandates coverage; TDD not requested in spec).

**Organization**: Tasks grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story this task belongs to (US1 = CV Analysis, US2 = Report Retrieval)

---

## Phase 1: Setup (Project Skeleton)

**Purpose**: Establish the Maven project, container config, and application entry point.
All Phase 2+ tasks depend on Phase 1 completing.

- [X] T001 Create `backend/skill-gap-service/` directory structure (controller, service, service/dto, entity, repository, dto/response, exception, config, security, resources/db/migration)
- [X] T002 [P] Create `backend/skill-gap-service/pom.xml` — adapt career-service pom: change `artifactId` to `skill-gap-service`, drop `spring-boot-starter-cache` + caffeine, add `org.apache.pdfbox:pdfbox:3.0.3` and `org.apache.poi:poi-ooxml:5.3.0`
- [X] T003 [P] Copy Maven wrapper from career-service into `backend/skill-gap-service/` (`.mvn/`, `mvnw`, `mvnw.cmd`, `.dockerignore`)
- [X] T004 [P] Create `backend/skill-gap-service/Dockerfile` — copy career-service Dockerfile; change jar glob to `skill-gap-service-*.jar`; change `EXPOSE` to `8003`
- [X] T005 [P] Create `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/SkillGapServiceApplication.java` — `@SpringBootApplication` only, no `@EnableCaching`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: All shared infrastructure that BOTH user stories depend on. No story work can begin until this phase is complete.

**⚠️ CRITICAL**: Phase 3 and Phase 4 cannot start until all Phase 2 tasks are complete.

### Database Migrations

- [X] T006 [P] Create `backend/skill-gap-service/src/main/resources/db/migration/V1__create_schema.sql` — `CREATE SCHEMA IF NOT EXISTS skill_gap;`
- [X] T007 [P] Create `backend/skill-gap-service/src/main/resources/db/migration/V2__create_cv_uploads.sql` — table `skill_gap.cv_uploads` (id UUID PK, user_id UUID NOT NULL, file_name VARCHAR(255), file_type VARCHAR(50), storage_path VARCHAR(500), extracted_text TEXT, status VARCHAR(20) DEFAULT 'PROCESSING', created_at TIMESTAMPTZ DEFAULT NOW()); index on user_id and status
- [X] T008 [P] Create `backend/skill-gap-service/src/main/resources/db/migration/V3__create_gap_reports_and_skill_gaps.sql` — tables `skill_gap.gap_reports` (id, cv_upload_id FK, user_id, target_role VARCHAR(255), created_at) and `skill_gap.skill_gaps` (id, report_id FK, skill_name VARCHAR(255), importance_rank INT, gap_description TEXT); indexes on user_id, report_id
- [X] T009 [P] Create `backend/skill-gap-service/src/main/resources/db/migration/V4__create_resource_recommendations.sql` — table `skill_gap.resource_recommendations` (id UUID PK, skill_gap_id UUID NOT NULL REFERENCES skill_gap.skill_gaps(id) ON DELETE CASCADE, resource_type VARCHAR(100) NOT NULL, title VARCHAR(500) NOT NULL, url VARCHAR(1000))

### Entities

- [X] T010 [P] Create `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/entity/CvUpload.java` — `@Entity @Table(name="cv_uploads", schema="skill_gap")`, fields: id UUID, userId UUID, fileName, fileType, storagePath, extractedText, status (VARCHAR, not enum), createdAt Instant; one-to-many to GapReport (CascadeType.ALL)
- [X] T011 [P] Create `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/entity/GapReport.java` — `@Entity @Table(name="gap_reports", schema="skill_gap")`, fields: id UUID, cvUpload (ManyToOne LAZY), userId UUID, targetRole, createdAt Instant; one-to-many to SkillGap (CascadeType.ALL)
- [X] T012 [P] Create `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/entity/SkillGap.java` — `@Entity @Table(name="skill_gaps", schema="skill_gap")`, fields: id UUID, report (ManyToOne LAZY), skillName, importanceRank int, gapDescription; one-to-many to ResourceRecommendation (CascadeType.ALL)
- [X] T013 [P] Create `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/entity/ResourceRecommendation.java` — `@Entity @Table(name="resource_recommendations", schema="skill_gap")`, fields: id UUID, skillGap (ManyToOne LAZY), resourceType, title, url

### Repositories

- [X] T014 [P] Create `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/repository/CvUploadRepository.java` — `JpaRepository<CvUpload, UUID>`; custom: `List<CvUpload> findByUserIdOrderByCreatedAtDesc(UUID userId)`
- [X] T015 [P] Create `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/repository/GapReportRepository.java` — `JpaRepository<GapReport, UUID>`; custom: `Optional<GapReport> findByIdAndUserId(UUID id, UUID userId)`; `@Query` with `LEFT JOIN FETCH` for `findByUserIdWithGaps(@Param("userId") UUID userId)` to avoid N+1
- [X] T016 [P] Create `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/repository/SkillGapRepository.java` — `JpaRepository<SkillGap, UUID>`; custom: `List<SkillGap> findByReportIdOrderByImportanceRankAsc(UUID reportId)`
- [X] T017 [P] Create `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/repository/ResourceRecommendationRepository.java` — `JpaRepository<ResourceRecommendation, UUID>`; no custom queries (cascade handles persistence)

### Security (repackage from career-service)

- [X] T018 [P] Create `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/security/JwtService.java`, `JwtUserDetails.java`, `JwtAuthFilter.java` — copy from `backend/career-service/.../security/`; update package declaration to `com.skillbridge.skillgap.security`; logic unchanged

### Config

- [X] T019 [P] Create `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/config/RestTemplateConfig.java` — copy from `backend/career-service/.../config/RestTemplateConfig.java`; update package only
- [X] T020 [P] Create `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/config/SecurityConfig.java` — adapt from career-service; `permitAll` for `/health`, `/swagger-ui/**`, `/v3/api-docs/**`; authenticate all other routes; register `CorrelationIdFilter` before `JwtAuthFilter`
- [X] T021 [P] Create `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/config/StartupLogger.java` — copy from career-service; change display string to `"SkillBridge AI — Skill Gap Service is running on port {port}"`
- [X] T022 [P] Create `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/config/CorrelationIdFilter.java` — `extends OncePerRequestFilter`; read `X-Correlation-ID` header (generate UUID if absent); `MDC.put("correlationId", id)`; set on response; `MDC.clear()` in finally block

### Configuration & Cross-Cutting

- [X] T023 [P] Create `backend/skill-gap-service/src/main/resources/application.yml` — `server.port: ${SERVER_PORT:8003}`; `spring.jpa.properties.hibernate.default_schema: skill_gap`; `spring.flyway.schemas: skill_gap`; `spring.servlet.multipart.max-file-size: 5MB`, `max-request-size: 6MB`; `file.upload-dir: ${FILE_UPLOAD_DIR:/app/uploads}`; `anthropic.api-key`, `model: claude-sonnet-4-6`, `max-tokens: 4096`; `claude.connect-timeout-ms: 15000`, `read-timeout-ms: 120000`; `jwt.secret: ${JWT_SECRET}`; no cache config
- [X] T024 [P] Create response DTOs in `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/dto/response/` — `RecommendationResponse record(UUID id, String type, String title, String url)`, `SkillGapResponse record(UUID id, String skillName, int importanceRank, String description, List<RecommendationResponse> recommendations)`, `ReportResponse record(UUID reportId, String targetRole, List<SkillGapResponse> gaps)`
- [X] T025 [P] Create exception classes in `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/exception/` — `AiServiceException` (copy from `backend/career-service/.../exception/AiServiceException.java`, update package); `ReportNotFoundException extends RuntimeException`; `UnsupportedFileTypeException extends RuntimeException`; `FileSizeExceededException extends RuntimeException`; `FileParsingException extends RuntimeException`
- [X] T026 [P] Create `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/exception/GlobalExceptionHandler.java` — adapt from career-service; add handlers: `ReportNotFoundException` → 404, `UnsupportedFileTypeException` → 422, `FileSizeExceededException` → 413, `FileParsingException` → 422, `MaxUploadSizeExceededException` → 413; keep existing handlers for `MethodArgumentNotValidException` → 422, `AiServiceException` → 503, `AccessDeniedException` → 403, `Exception` → 500

**Checkpoint**: Foundation complete — both user stories can now begin in parallel.

---

## Phase 3: User Story 1 — CV Analysis (Priority: P1) 🎯 MVP

**Goal**: Student uploads a PDF/DOCX CV, specifies a target role, and receives a ranked list of skill gaps with recommendations.

**Independent Test**: `POST /skill-gap/analyse` with a real PDF and `targetRole=Software Engineer` → HTTP 201 with `{ reportId, targetRole, gaps: [{ skillName, importanceRank, description, recommendations: [...] }] }`.

### Implementation for User Story 1

- [X] T027 [US1] Create `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/service/FileParserService.java` — `@Service`; `extractText(MultipartFile file)`: (1) reject if `file.getSize() > 5MB` → `FileSizeExceededException`; (2) reject if MIME not in `[application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document]` → `UnsupportedFileTypeException`; (3) write bytes to `${file.upload-dir}/{userId}/{uuid}_{filename}` via `Files.write`; (4) extract text with PDFBox `Loader.loadPDF` + `PDFTextStripper` for PDF, or POI `XWPFDocument` + `XWPFWordExtractor` for DOCX; (5) throw `FileParsingException` on IOException; return `{ storagePath, extractedText }`
- [X] T028 [P] [US1] Create internal DTOs in `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/service/dto/` — `SkillGapTemplate record(String skillName, int importanceRank, String description, List<RecommendationTemplate> recommendations)` and `RecommendationTemplate record(String type, String title, String url)`
- [X] T029 [P] [US1] Create `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/service/ClaudeService.java` — `@Service`; constants: `private static final String PROMPT_NAME = "SKILL_GAP_ANALYSIS_V1"` and `SYSTEM_PROMPT` (JSON-array-only constraint, fields: skillName, importanceRank, description, recommendations[type/title/url]); `analyseGaps(String cvText, String targetRole)`: build RestTemplate request with headers `x-api-key`, `anthropic-version`; log `prompt=SKILL_GAP_ANALYSIS_V1 latencyMs=...`; apply same markdown-strip pattern as career-service ClaudeService; parse response into `List<SkillGapTemplate>`; assert non-empty; throw `AiServiceException` on HTTP error, parse error, or empty list
- [X] T030 [P] [US1] Create `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/service/SkillGapService.java` interface — declare: `ReportResponse analyseCV(MultipartFile file, String targetRole, UUID userId)`; `ReportResponse getReport(UUID reportId, UUID userId)`; `List<ReportResponse> getUserReports(UUID userId)`
- [X] T031 [US1] Create `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/service/SkillGapServiceImpl.java` — `@Service @RequiredArgsConstructor`; implement all three interface methods; `analyseCV` is `@Transactional`: call `fileParserService.extractText` → persist `CvUpload(PROCESSING)` → call `claudeService.analyseGaps` (on `AiServiceException`: set `status=FAILED`, save, rethrow) → persist `GapReport` + `SkillGap` list + `ResourceRecommendation` lists → set `status=COMPLETED` → return `ReportResponse`; `getReport`: `findByIdAndUserId` → `orElseThrow(ReportNotFoundException)`; `getUserReports`: `findByUserIdWithGaps` → map to `List<ReportResponse>`
- [X] T032 [US1] Create `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/controller/SkillGapController.java` — `@RestController @RequestMapping("/skill-gap") @RequiredArgsConstructor @Validated`; add `POST /analyse` endpoint: `@PostMapping(value="/analyse", consumes=MULTIPART_FORM_DATA_VALUE)`, `@RequestParam MultipartFile file`, `@RequestParam @NotBlank String targetRole`, `@AuthenticationPrincipal JwtUserDetails`, returns `ResponseEntity.status(201).body(response)`; add `GET /health` endpoint: public, returns `ResponseEntity.ok(Map.of("status","UP","service","skill-gap-service"))`

**Checkpoint**: User Story 1 complete — `POST /skill-gap/analyse` and `GET /health` are independently functional.

---

## Phase 4: User Story 2 — Report Retrieval (Priority: P2)

**Goal**: Student retrieves a previous gap report by ID, or lists all their past reports.

**Independent Test**: Given a `reportId` from a prior analyse call, `GET /skill-gap/reports/{reportId}` → HTTP 200 with full report. `GET /skill-gap/reports` → HTTP 200 with array (empty array if none).

### Implementation for User Story 2

- [X] T033 [US2] Add GET endpoints to `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/controller/SkillGapController.java` — `GET /reports/{reportId}`: `@PathVariable UUID reportId`, returns `ResponseEntity.ok(skillGapService.getReport(reportId, principal.userId()))`; `GET /reports`: returns `ResponseEntity.ok(skillGapService.getUserReports(principal.userId()))`

**Checkpoint**: User Stories 1 and 2 are both independently functional and testable.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Integration, documentation, and test coverage. All [P] — can run concurrently after Phase 4.

### Integration

- [X] T034 [P] Update `docker-compose.yml` — add `skill-gap-service` service block: build context `./backend/skill-gap-service`, `ports: ["8003:8003"]`, env vars (`SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `JWT_SECRET`, `ANTHROPIC_API_KEY`, `SERVER_PORT: 8003`, `FILE_UPLOAD_DIR: /app/uploads`), `volumes: [skillgap_uploads:/app/uploads]`, `depends_on: postgres (service_healthy)`; add `skillgap_uploads:` under top-level `volumes:`
- [X] T035 [P] Update `nginx/nginx.conf` — add upstream block `skill_gap_service { server skill-gap-service:8003; }`; add location block `location /skill-gap/ { proxy_pass http://skill_gap_service; proxy_http_version 1.1; ... client_max_body_size 6M; }`
- [X] T036 [P] Update `.env.example` — add `FILE_UPLOAD_DIR=/app/uploads` with comment `# Local path where uploaded CV files are stored (mounted as Docker volume)`
- [X] T037 [P] Update `.github/workflows/` — open the existing CI workflow file; add `skill-gap-service` to the build matrix or add a new job following the same pattern used for `auth-service` and `career-service` (lint → test → build)
- [X] T038 [P] Update `CLAUDE.md` — replace plan reference between `<!-- SPECKIT START -->` and `<!-- SPECKIT END -->` markers to point to `specs/001-skill-gap-service/plan.md`

### Tests (constitution Principle IV)

- [X] T039 [P] Create `backend/skill-gap-service/src/test/java/com/skillbridge/skillgap/service/ClaudeServiceTest.java` — `@ExtendWith(MockitoExtension.class)`; mock `RestTemplate`; cases: valid response → returns `List<SkillGapTemplate>` with correct fields; HTTP error → throws `AiServiceException`; malformed JSON → throws `AiServiceException`; empty JSON array `[]` → throws `AiServiceException`
- [X] T040 [P] Create `backend/skill-gap-service/src/test/java/com/skillbridge/skillgap/service/SkillGapServiceTest.java` — `@ExtendWith(MockitoExtension.class)`, `@InjectMocks SkillGapServiceImpl`; mock all repos + `ClaudeService` + `FileParserService`; cases: `analyseCV` happy path → repos saved, returns `ReportResponse`; `analyseCV` Claude failure → `CvUpload` saved with `status=FAILED`; `analyseCV` unsupported file → no repo saves; `getReport` found → returns report; `getReport` not found → throws `ReportNotFoundException`; `getUserReports` → returns ordered list; `getUserReports` empty → returns empty list
- [X] T041 [P] Create `backend/skill-gap-service/src/test/java/com/skillbridge/skillgap/controller/SkillGapControllerTest.java` — `@WebMvcTest(SkillGapController.class)`, `@AutoConfigureMockMvc(addFilters=false)`, mock `SkillGapService`; cases: `POST /analyse` valid → 201 + `$.reportId` exists; `POST /analyse` missing targetRole → 400; `POST /analyse` AI unavailable → 503; `POST /analyse` unsupported file type → 422; `GET /reports/{id}` found → 200 + `$.gaps` array; `GET /reports/{id}` not found → 404; `GET /reports` empty → 200 + empty JSON array; `GET /health` → 200 + `$.status == "UP"`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS Phase 3 and Phase 4
- **Phase 3 (US1)**: Depends on Phase 2 completion; T027 and T028/T029/T030 can run in parallel; T031 needs T027+T029+T030; T032 needs T031
- **Phase 4 (US2)**: Depends on Phase 3 (T031 must exist to add to it); T033 adds GET methods to controller
- **Phase 5 (Polish)**: Depends on Phase 3 completion; all Phase 5 tasks are independent [P]

### User Story Dependencies

- **US1 (P1)**: No dependency on US2 — independently testable after Phase 3
- **US2 (P2)**: Depends on US1 (GET endpoints retrieve reports produced by US1's analyse call)

### Within Phase 3

```
T027 FileParserService ──┐
T028 Internal DTOs    ──┤─→ T031 ServiceImpl ──→ T032 Controller
T029 ClaudeService    ──┤
T030 Interface        ──┘
```

### Parallel Opportunities

```bash
# Phase 2 — all 21 tasks run concurrently:
T006 V1 migration  &  T007 V2 migration  &  T008 V3 migration  &  T009 V4 migration
T010 CvUpload      &  T011 GapReport     &  T012 SkillGap       &  T013 Recommendation
T014 Repo          &  T015 Repo          &  T016 Repo           &  T017 Repo
T018 Security      &  T019 RestTemplate  &  T020 SecurityConfig &  T021 StartupLogger
T022 CorrelFilter  &  T023 app.yml       &  T024 DTOs           &  T025 Exceptions  &  T026 Handler

# Phase 3 — parallel start:
T027 FileParserService  &  T028 DTOs  &  T029 ClaudeService  &  T030 Interface

# Phase 5 — all concurrent:
T034 docker-compose  &  T035 nginx  &  T036 .env.example  &  T037 CI  &  T038 CLAUDE.md
T039 ClaudeServiceTest  &  T040 ServiceTest  &  T041 ControllerTest
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundational (T006–T026) — CRITICAL blocking phase
3. Complete Phase 3: User Story 1 (T027–T032)
4. **STOP and VALIDATE**: `./mvnw test` passes; manually POST a CV → 201 response
5. Optionally deploy/demo: `docker-compose up skill-gap-service`

### Incremental Delivery

1. Setup (Phase 1) + Foundational (Phase 2) → service compiles, migrations run
2. User Story 1 (Phase 3) → CV analysis works end-to-end → **MVP**
3. User Story 2 (Phase 4) → Report retrieval added
4. Polish (Phase 5) → docker-compose integration, CI, tests

---

## Notes

- [P] = different files, no dependencies on incomplete tasks in the same phase
- [US1]/[US2] = user story ownership for traceability
- Tests are in Phase 5 (not TDD) — constitution requires ≥70% JaCoCo coverage but spec did not request TDD
- T031 ServiceImpl implements ALL three interface methods (analyseCV for US1, getReport + getUserReports for US2) in one class; T033 only adds GET endpoints to the controller
- Security classes (T018) are a package rename only — no logic changes
- `AiServiceException` in T025 is a copy+repackage from career-service, not a new class
- Constitution Principle V requires `CorrelationIdFilter` (T022) — this is new and was NOT in career-service
