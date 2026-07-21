---
description: "Task list for Mock Interview Service"
---

# Tasks: Mock Interview Service

**Input**: Design documents from `/specs/008-mock-interview-service/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/mock-interview-api.md

**Tests**: INCLUDED — required by Constitution IV (Test Coverage by Layer) and SC-004/SC-005 (JaCoCo ≥ 70%).

**Organization**: Grouped by user story (US1–US6) for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US6 maps to the spec user stories (US6 added 2026-07-09 — Voice Answers amendment)
- Backend base package: `com.skillbridge.mockinterview` under `backend/mock-interview-service/`
- Frontend base: `frontend/`

## Path Conventions

- **Backend**: `backend/mock-interview-service/src/main/java/com/skillbridge/mockinterview/`
- **Backend tests**: `backend/mock-interview-service/src/test/java/com/skillbridge/mockinterview/`
- **Migrations**: `backend/mock-interview-service/src/main/resources/db/migration/`
- **Frontend**: `frontend/app/(app)/`, `frontend/services/`, `frontend/types/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: New service scaffold and build config

- [X] T001 Create `backend/mock-interview-service/` directory tree mirroring `skill-gap-service` (config, controller, dto, entity, exception, repository, security, service packages)
- [X] T002 Create `backend/mock-interview-service/pom.xml` — parent `spring-boot-starter-parent:3.3.6`, Java 21, artifactId `mock-interview-service`, deps: web/security/data-jpa/validation, flyway + flyway-database-postgresql, postgresql, jjwt 0.12.5, springdoc 2.5.0, lombok, test + spring-security-test; JaCoCo plugin ≥ 70% excluding config/security/Application (NO pdfbox/poi-ooxml)
- [X] T003 [P] Create `backend/mock-interview-service/Dockerfile` — two-stage Maven + eclipse-temurin:21-jre-alpine, `EXPOSE 8005`
- [X] T004 [P] Copy `mvnw`/`mvnw.cmd`/`.mvn` wrapper from skill-gap-service into `backend/mock-interview-service/`
- [X] T005 Create `backend/mock-interview-service/src/main/resources/application.yml` — `SERVER_PORT:8005`, `hibernate.default_schema: mock_interview`, `flyway.schemas: mock_interview`, `anthropic.model: claude-sonnet-4-6`, `anthropic.max-tokens: 2048`, `claude.connect-timeout-ms/read-timeout-ms`, NO multipart config

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Scaffolding, security, DB, and Claude plumbing that ALL stories depend on

- [X] T006 Create `MockInterviewServiceApplication.java` (`@SpringBootApplication`)
- [X] T007 [P] Copy `security/JwtService.java`, `security/JwtUserDetails.java`, `security/JwtAuthFilter.java` from skill-gap-service, adjusting package to `com.skillbridge.mockinterview`
- [X] T008 [P] Copy `config/CorrelationIdFilter.java` and `config/StartupLogger.java` from skill-gap-service
- [X] T009 [P] Create `config/RestTemplateConfig.java` (RestTemplate bean with connect/read timeouts from properties)
- [X] T010 Create `config/SecurityConfig.java` — stateless, PUBLIC_ENDPOINTS = swagger + `/mock-interview/health`, correlationId then jwt filters
- [X] T011 [P] Create Flyway `db/migration/V1__create_schema.sql` (`CREATE SCHEMA IF NOT EXISTS mock_interview`)
- [X] T012 [P] Create Flyway `db/migration/V2__create_interview_sessions.sql` (sessions table + user_id index) per data-model.md
- [X] T013 [P] Create Flyway `db/migration/V3__create_interview_questions.sql` (questions table + FK CASCADE + session_id index) per data-model.md
- [X] T014 [P] Create `entity/InterviewSession.java` (UUID PK, `@OneToMany` questions cascade/orphan, `@OrderBy orderIndex`)
- [X] T015 [P] Create `entity/InterviewQuestion.java` (UUID PK, `@ManyToOne LAZY` session, category incl. OTHER)
- [X] T016 [P] Create `repository/InterviewSessionRepository.java` — `findByIdAndUserId`, `findByUserIdOrderByCreatedAtDesc`
- [X] T017 [P] Create `repository/InterviewQuestionRepository.java` — `existsBySessionIdAndUserAnswerIsNull`
- [X] T018 [P] Create exceptions: `AiServiceException`, `SessionNotFoundException`, `SessionAlreadyCompletedException`, `SessionIncompleteException`, `QuestionAlreadyAnsweredException`
- [X] T019 Create `exception/GlobalExceptionHandler.java` — map to uniform `{error,status}`: NotFound→404, AlreadyCompleted/AlreadyAnswered→409, Incomplete→422, AiService→503, validation→400
- [X] T020 [P] Create `service/dto/QuestionTemplate.java`, `AnswerEvaluationTemplate.java`, `SessionSummaryTemplate.java` (Claude→DB bridge records)
- [X] T021 [P] Create `dto/request/StartSessionRequest.java` (`@NotBlank @Size(max=200)` role; difficulty enum ENTRY|MID|SENIOR, case-sensitive) and `dto/request/SubmitAnswerRequest.java` (`@NotBlank @Size(max=5000)` answer)
- [X] T022 [P] Create `dto/response/QuestionResponse.java`, `SessionResponse.java`, `SessionSummaryResponse.java` records
- [X] T023 Create `service/ClaudeInterviewService.java` with 3 named prompt constants (`MOCK_INTERVIEW_QUESTIONS_V1`, `MOCK_INTERVIEW_ANSWER_V1`, `MOCK_INTERVIEW_SUMMARY_V1`), Anthropic HTTP call, JSON-safety guard (first `[`/`{`), INFO logging of prompt name + latency
- [X] T024 Create `service/MockInterviewService.java` interface (all methods take `UUID userId` last)

**Checkpoint**: Service boots, migrations run, `/mock-interview/health` returns 200.

---

## Phase 3: User Story 1 — Start an Interview Session (P1)

**Goal**: Student picks role + difficulty; Claude generates 3–7 questions; session persisted.

**Independent Test**: POST `/mock-interview/sessions` → 201 with 3–7 questions each having questionText/category/orderIndex.

- [X] T025 [US1] Implement `ClaudeInterviewService.generateQuestions(targetRole, difficulty)` → `List<QuestionTemplate>` using `MOCK_INTERVIEW_QUESTIONS_V1`
- [X] T026 [US1] Implement `MockInterviewServiceImpl.startSession(request, userId)` — call Claude, guard empty questions → throw `AiServiceException` (→503), persist session + questions, return `SessionResponse`
- [X] T027 [US1] Add `POST /mock-interview/sessions` to `MockInterviewController` (`@Valid` body, `@AuthenticationPrincipal`, 201)
- [X] T028 [US1] Add `GET /mock-interview/health` (public) to controller
- [X] T029 [P] [US1] Unit test `ClaudeInterviewServiceTest` — questions parse, fence/preamble stripping, empty-array → AiServiceException
- [X] T030 [P] [US1] Controller-slice test `MockInterviewControllerTest` for POST /sessions — 201 happy path, 400 blank role, 400 invalid/lowercase difficulty, 503 on AI failure

**Checkpoint**: US1 independently testable — sessions can be created with questions.

---

## Phase 4: User Story 2 — Submit an Answer (P1)

**Goal**: Student answers a question; Claude scores (0–10) + feedback immediately.

**Independent Test**: POST answer endpoint → 200 with score + feedback.

- [X] T031 [US2] Implement `ClaudeInterviewService.evaluateAnswer(role, difficulty, questionText, category, answer)` → `AnswerEvaluationTemplate` using `MOCK_INTERVIEW_ANSWER_V1` (object parse, first `{` guard)
- [X] T032 [US2] Implement `MockInterviewServiceImpl.submitAnswer(sessionId, questionId, request, userId)` — ownership 404, session COMPLETED→409, question already answered→409, evaluate, persist score/feedback/answeredAt, return `QuestionResponse`
- [X] T033 [US2] Add `POST /mock-interview/sessions/{sessionId}/questions/{questionId}/answer` to controller
- [X] T034 [P] [US2] Unit test — answer evaluation parse; service guards (already-answered→409, completed-session→409, wrong-owner→404)
- [X] T035 [P] [US2] Controller-slice test — 200 happy, 400 blank/oversized answer, 404, 409, 503

**Checkpoint**: US2 testable on top of US1 — full answer loop works.

---

## Phase 5: User Story 3 — Complete a Session (P1)

**Goal**: Claude produces overall score (0–100) + summary; session marked COMPLETED.

**Independent Test**: POST `/complete` after all answered → 200 with overallScore + overallFeedback, status COMPLETED.

- [X] T036 [US3] Implement `ClaudeInterviewService.generateSummary(role, difficulty, qaList)` → `SessionSummaryTemplate` using `MOCK_INTERVIEW_SUMMARY_V1`
- [X] T037 [US3] Implement `MockInterviewServiceImpl.completeSession(sessionId, userId)` — 404, already-completed→409, `existsBySessionIdAndUserAnswerIsNull`→422, set overallScore/Feedback/completedAt/status, return `SessionResponse`
- [X] T038 [US3] Add `POST /mock-interview/sessions/{sessionId}/complete` to controller
- [X] T039 [P] [US3] Unit test — summary parse; guards (incomplete→422, already-completed→409, wrong-owner→404)
- [X] T040 [P] [US3] Controller-slice test — 200 happy, 404, 409, 422, 503

**Checkpoint**: US1→US3 = complete backend interview loop (MVP).

---

## Phase 6: User Story 4 — View Session History (P2)

**Goal**: List past sessions; open one for full detail (resume support).

**Independent Test**: GET `/sessions` → 200 array newest-first; GET `/sessions/{id}` → full session.

- [X] T041 [US4] Implement `MockInterviewServiceImpl.getSessions(userId)` → `List<SessionSummaryResponse>` ordered createdAt DESC
- [X] T042 [US4] Implement `MockInterviewServiceImpl.getSession(sessionId, userId)` → `SessionResponse` (404 if not owned) — this is the resume mechanism
- [X] T043 [US4] Add `GET /mock-interview/sessions` and `GET /mock-interview/sessions/{sessionId}` to controller
- [X] T044 [P] [US4] Controller-slice test — list (empty + populated), get by id (200 + 404 wrong owner)

**Checkpoint**: US4 testable — history and resume work.

---

## Phase 7: User Story 5 — Delete a Session (P2)

**Goal**: Delete a session; questions cascade-delete.

**Independent Test**: DELETE `/sessions/{id}` → 204; subsequent GET → 404.

- [X] T045 [US5] Implement `MockInterviewServiceImpl.deleteSession(sessionId, userId)` — 404 if not owned, else delete (cascade)
- [X] T046 [US5] Add `DELETE /mock-interview/sessions/{sessionId}` to controller (204)
- [X] T047 [P] [US5] Controller-slice test — 204 owned, 404 wrong owner

**Checkpoint**: All backend endpoints complete.

---

## Phase 8: Infrastructure Wiring

**Purpose**: Make the service reachable and CI-covered

- [X] T048 Add `mock-interview-service` block to `docker-compose.yml` (port 8005, datasource/JWT/ANTHROPIC env, `SERVER_PORT:8005`, depends_on postgres healthy); add to `gateway.depends_on`
- [X] T049 Add `upstream mock_interview_service` + `location /mock-interview/` (180s read/send timeouts) to `nginx/nginx.conf`
- [X] T050 [P] Add `{ service: mock-interview-service, path: backend/mock-interview-service }` to `.github/workflows/ci.yml` matrix
- [X] T062 [P] [US6] Add `whisper-service` block to `docker-compose.yml` — image `ahmadmughees/whisper-asr-webservice` pinned to a specific digest (NOT `:latest`), ports `9006:9000`, env `ASR_MODEL=small`, `ASR_ENGINE=faster_whisper`, `restart: unless-stopped`
- [X] T063 [P] [US6] Add `WHISPER_URL=http://whisper-service:9000` + `WHISPER_STARTUP_PROBE=true` env to the `mock-interview-service` block in `docker-compose.yml`

---

## Phase 9: Frontend

**Purpose**: Mobile UI for the full interview flow (one question at a time)

- [X] T051 [P] Create `frontend/types/mockInterview.ts` — `Difficulty`, `SessionStatus`, `Category`, `InterviewQuestion`, `InterviewSession`, `SessionSummary`, request payloads
- [X] T052 Create `frontend/services/mockInterview.ts` mirroring `services/skillGap.ts` — `startSession`, `submitAnswer`, `completeSession`, `getSessions`, `getSession`, `deleteSession`
- [X] T053 [US1][US4][US5] Create `frontend/app/(app)/mock-interview.tsx` — history list (`useFocusEffect` + `getSessions`), Start flow (role input + difficulty selector → `startSession` → push session), optimistic delete
- [X] T054 [US2][US3] Create `frontend/app/(app)/mock-interview-session.tsx` — fetch session by param, one-question-at-a-time, submit → show score+feedback inline, last question → `completeSession` → `router.replace` to report; resume at first unanswered question
- [X] T055 [US3][US4] Create `frontend/app/(app)/mock-interview-report/[sessionId].tsx` — fetch session, overall score + feedback, per-question cards
- [X] T056 Register screens in `frontend/app/(app)/_layout.tsx` — visible `mock-interview` tab (mic icon) + hidden `mock-interview-session` and `mock-interview-report` (`href: null`, tab bar hidden)
- [X] T057 Update `frontend/app/(app)/index.tsx` — add "Interview" `QuickLink` (→ `./mock-interview`); remove "Mock Interviews" `ComingSoonCard`

---

## Phase 10: Polish & Cross-Cutting

- [X] T058 [P] Verify JaCoCo ≥ 70% (`./mvnw verify` in `backend/mock-interview-service/`); add tests if short
- [ ] T059 [P] Run `quickstart.md` end-to-end (health → start → answer → complete → list → delete) against docker-compose
- [X] T060 [P] Update `docs/api.md` with the 7 mock-interview endpoints
- [ ] T061 Manual mobile QA per quickstart §6 (full flow + history + detail)
- [X] T078 [P] [US6] Update `docs/api.md` with the 8th endpoint (`POST .../transcribe` multipart)
- [X] T079 [P] [US6] Run quickstart §6a (voice path: record → transcribe → edit → submit → fallback 503 + 422 + permission-denied) against docker-compose with `whisper-service` running

---

## Phase 11: User Story 6 — Answer by Voice (P2) [Voice Amendment, 2026-07-09]

**Goal**: Student records a spoken answer; a self-hosted faster-whisper service transcribes it; the transcript fills the existing text box for review/edit; the existing Submit Answer button feeds Claude through the unchanged `/answer` path.

**Independent Test**: POST `/mock-interview/sessions/{sessionId}/questions/{questionId}/transcribe` with multipart audio → 200 `{ "transcript": "..." }` (FR-014). Then POST the transcript to the unchanged `/answer` → 200 with score + feedback.

### Backend — Whisper integration

- [X] T064 [P] [US6] Add `WHISPER_URL` (default `http://whisper-service:9000`), `WHISPER_TIMEOUT_MS` (default `60000`), and `WHISPER_STARTUP_PROBE` (default `true`) properties to `backend/mock-interview-service/src/main/resources/application.yml`; also add `spring.servlet.multipart.max-file-size: 25MB` and `spring.servlet.multipart.max-request-size: 25MB`
- [X] T065 [P] [US6] Create `dto/response/TranscribeResponse.java` — record with single field `String transcript`
- [X] T066 [P] [US6] Create `service/WhisperTranscriptionService.java` interface — `String transcribe(byte[] audioBytes, String contentType)` throwing `AiServiceException` on remote failure and `SessionIncompleteException`-style for empty transcript (or a new `EmptyTranscriptException` if cleaner)
- [X] T067 [US6] Implement `service/WhisperTranscriptionServiceImpl.java` — POST multipart `{ audio: <bytes> }` to `${WHISPER_URL}/asr` via `RestTemplate` with configured timeout; parse first non-empty `{` … use the JSON-safety guard (FR-010 analogue); INFO-log `"WHISPER_TRANSCRIBE_V1"` + latency ms; if upstream non-2xx / timeout → throw `AiServiceException` (→503); if parsed transcript is blank → throw new `EmptyTranscriptException` (→422)
- [X] T068 [US6] Add `EmptyTranscriptException` to `exception/` package + add a `@ExceptionHandler` mapping in `GlobalExceptionHandler` returning `422 { "error": "No speech detected", "status": 422 }`
- [X] T069 [US6] Implement `MockInterviewServiceImpl.transcribe(sessionId, questionId, userId, file)` — ownership 404 (reuse session lookup), question must belong to session (404), session COMPLETED or question already answered → 409 (reuse existing guards from `/answer`), validate file not empty + size ≤ 25 MB + mime ∈ {audio/mpeg, audio/m4a, audio/wav} else 400, read bytes, call `WhisperTranscriptionService.transcribe`, return `TranscribeResponse`
- [X] T070 [US6] Add `POST /mock-interview/sessions/{sessionId}/questions/{questionId}/transcribe` to `MockInterviewController` — consumes `multipart/form-data`, `@RequestParam("audio") MultipartFile`, `@AuthenticationPrincipal`, returns 200 `TranscribeResponse`
- [X] T071 [P] [US6] Add startup probe to `config/StartupLogger.java` — if `WHISPER_STARTUP_PROBE=true`, issue a non-blocking HTTP HEAD to `${WHISPER_URL}/` and WARN-log on failure ("WHISPER_URL unreachable — voice path disabled, typed answers still work"). Must NOT fail startup

### Backend — Tests for US6

- [X] T072 [P] [US6] Unit test `WhisperTranscriptionServiceImplTest` — mocked `RestTemplate`: success returns trimmed transcript; non-2xx / timeout → `AiServiceException`; empty Whisper response → `EmptyTranscriptException`; verify INFO log emits "WHISPER_TRANSCRIBE_V1" + latency
- [X] T073 [P] [US6] Controller-slice test for `POST /transcribe` in `MockInterviewControllerTest` — use `MockMultipartFile` for: 200 happy path (transcript populated), 400 missing part, 400 oversize (mock multipart size > 25MB), 400 wrong mimetype, 404 not owned, 409 already-answered question, 409 completed session, 422 empty transcript (service mock throws `EmptyTranscriptException`), 503 whisper down (service mock throws `AiServiceException`)

### Frontend — Voice recorder UI

- [X] T074 [P] [US6] Add `expo-av` dependency to `frontend/package.json`; verify SDK 54 compatibility (Per Expo docs `expo-av` is replaced by `expo-audio`/`expo-video` in SDK 54+ — prefer the new `expo-audio` module if the existing project SDK supports it; otherwise pin `expo-av` to a compatible version)
- [X] T075 [P] [US6] Update `frontend/app.json` — add the chosen audio plugin under `plugins` (e.g. `"expo-audio"` or `"expo-av"`); add `ios.infoPlist.NSMicrophoneUsageDescription`: "Used to record spoken answers for mock interviews."; add `android.permissions`: `["android.permission.RECORD_AUDIO"]`
- [X] T076 [P] [US6] Create `frontend/hooks/useInterviewRecorder.ts` — wraps `expo-audio` (or `expo-av`) recorder: requests mic permission on first call; if denied → returns `{ permissionDenied: true }` (caller hides the recorder, FR-017); exposes `{ isRecording, recordingSeconds, permissionDenied, start, stop } -> Promise<fileUri>`; aborts recording at ~5 min OR ~24 MB (whichever first), emits a stopped file URI without crashing so the existing transcribe flow can still run
- [X] T077 [P] [US6] Add `transcribeAnswer(token, sessionId, questionId, audioUri)` to `frontend/services/mockInterview.ts` — builds `FormData` with `audio` file part (type `audio/m4a`), POSTs to `/mock-interview/sessions/{sessionId}/questions/{questionId}/transcribe` with Bearer auth; parses `{ transcript }` on 200; throws `{status,message}` on 400/404/409/422/503 (consistent with `request<T>` error shape)
- [X] T078a [US6] Modify `frontend/app/(app)/mock-interview-session.tsx` — in the `!wasAnswered` branch, conditionally render a "Record" / "Stop" button under the `TextInput` (hidden when `permissionDenied`); while transcribing show a "Transcribing…" `ActivityIndicator`; on 200 → `setAnswer(transcript)` so the existing TextInput fills for editing; on 422 → error toast "No speech was detected — please try again" (keep recorder visible); on 503 → error toast "Voice unavailable, please type your answer"; on 400 → "Recording too long or wrong format — try again". Keep the existing Submit Answer button and `handleSubmit` flow entirely unchanged. Save the STOP optional cap warnings next to the timer (e.g. "Max 5 min").

**Checkpoint**: US6 independently testable on top of US1+US2 — voice path records → transcribes → fills text box → user edits → submits through the unchanged `/answer` endpoint. Typed path unaffected when mic is denied or Whisper is down.

---

## Dependencies & Story Completion Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** block everything.
- **US1 (start)** → prerequisite for US2/US3 (need a session with questions).
- **US2 (answer)** → prerequisite for US3 (complete needs answered questions).
- **US3 (complete)** completes the MVP loop.
- **US4 (history)**, **US5 (delete)** depend only on US1 producing data; independent of each other.
- **US6 (voice)** depends on US2 (the existing `/answer` endpoint is the final submit path after transcription), the new `whisper-service` infra container, and the new `WhisperTranscriptionService`. It does NOT touch `ClaudeInterviewService`, the schema, or existing endpoints.
- **Infra (Phase 8)** can run in parallel with backend once controller paths exist; needed before frontend E2E.
- **Frontend (Phase 9)** depends on backend endpoints + infra routing.
- **US6 infra (T062/T063)** can run in parallel with US6 backend — the whisper container starts independently of the Spring Boot code.

## Parallel Execution Examples

- Foundational: T007–T009, T011–T018, T020–T022 are all `[P]` (distinct files).
- Per story, the two test tasks (`[P]`) run alongside each other once the impl task lands.
- Infra: T050 `[P]` independent of T048/T049.
- Frontend: T051 `[P]` (types) before T052 (service); screens T053–T055 share `_layout` so T056 follows.
- **US6 backend**: T064, T065, T066, T071 are `[P]` with each other (distinct files) — T067 depends on T066; T068 depends on nothing existing yet (`@ExceptionHandler`); T069 depends on T067/T068; T070 depends on T069.
- **US6 frontend**: T074, T075, T076, T077 are `[P]` (distinct files); T078a (screen modify) depends on T076 (hook) + T077 (service method).
- **US6 tests**: T072, T073 are `[P]` with each other once the impl task lands.

## Implementation Strategy

**MVP = Phases 1–5 + minimal infra (T048–T049)** → a working backend interview loop (start → answer → complete) reachable through the gateway. Ship, then layer US4/US5, then the frontend, then polish.

**Voice (US6) = Phase 11 + infra T062/T063 + polish T078/T079** → only start after US2 is in place (the `/answer` path is unchanged and remains the grade step). US6 can ship entirely independently: start with the infra container + backend Whisper service + tests against the mocked `WhisperTranscriptionService`, then layer the frontend recorder; typed answers stay working throughout. If `whisper-service` cannot start on a developer's machine, the rest of the feature still works — voice is opt-in.

---

**Total tasks**: 79 (61 original + 18 voice amendment)
**Per story**: US1 = 6, US2 = 5, US3 = 5, US4 = 4, US5 = 3, US6 = 15 (remainder: Setup 5, Foundational 19, Infra 5, Frontend 7, Polish 5)
