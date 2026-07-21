# Tasks: AI-Powered Portfolio Verification

**Input**: Design documents from `specs/005-ai-powered-portfolio-verification/`

**Organization**: Tasks grouped by user story (US1→US3) to enable independent testing of each increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 (AI auto-verify), US2 (graceful fallback), US3 (admin override)

---

## Phase 1: Foundation (Blocking Prerequisites)

**Purpose**: Schema + entity + config changes that ALL user stories depend on. Must complete before any story work.

**⚠️ CRITICAL**: All Phase 1 tasks block US1, US2, and US3.

- [X] T001 Create `backend/portfolio-service/src/main/resources/db/migration/V5__add_review_source_to_verification_requests.sql` — `ALTER TABLE portfolio.verification_requests ADD COLUMN IF NOT EXISTS review_source VARCHAR(20) NOT NULL DEFAULT 'AI';`
- [X] T002 [P] Add `private String reviewSource;` field to `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/entity/VerificationRequest.java`
- [X] T003 [P] Add `String reviewSource` param to `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/dto/response/VerificationRequestResponse.java` record — insert after `reviewerNote`, before `requestedAt`
- [X] T004 [P] Create `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/exception/AiServiceException.java` — copy from `backend/career-service/src/main/java/com/skillbridge/career/exception/AiServiceException.java`, update package to `com.skillbridge.portfolio.exception`
- [X] T005 [P] Create `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/service/dto/ClaudeVerificationResponse.java` — `record ClaudeVerificationResponse(String decision, String reason) {}`
- [X] T006 [P] Update `backend/portfolio-service/src/main/resources/application.yml` — add block: `anthropic: {api-key: "${ANTHROPIC_API_KEY}", model: "claude-sonnet-4-6", verification-max-tokens: 256}` and `claude: {connect-timeout-ms: 15000, read-timeout-ms: 120000}`
- [X] T007 [P] Update `docker-compose.yml` — add `ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}` to `portfolio-service` environment block

**Checkpoint**: Foundation ready — all entity/DTO/config changes in place. US1, US2, US3 phases can now begin.

---

## Phase 2: US1 + US2 — AI Auto-Verify with Graceful Fallback (P1 + P2) 🎯 MVP

**Goal**: `POST /portfolio/items/{id}/verify` calls Claude synchronously → returns APPROVED or REJECTED immediately (US1). When Claude is unavailable → returns 200 with PENDING + fallback note, no 5xx (US2).

**Why combined**: US1 (happy path) and US2 (fallback/catch) live in the same method — cannot implement one without the other.

**Independent Test**: `POST /portfolio/items/{id}/verify` with valid item → `status: APPROVED` or `REJECTED`, `reviewSource: AI`. With `ANTHROPIC_API_KEY=invalid` → `status: PENDING`, `reviewSource: PENDING_FALLBACK`, HTTP 200.

- [X] T008 [US1] Create `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/service/ClaudeVerificationService.java`:
  - Named constant: `private static final String PROMPT_NAME = "PORTFOLIO_VERIFICATION_V1";`
  - System prompt: instructs Claude to return ONLY valid JSON `{ "decision": "APPROVED"|"REJECTED", "reason": "..." }` — no preamble, no markdown
  - `@Value("${anthropic.api-key}")`, `@Value("${anthropic.model}")`, `@Value("${anthropic.verification-max-tokens}")` injected via constructor
  - `public ClaudeVerificationResponse verify(PortfolioItem item)` method:
    - Truncate `item.getDescription()` to 2000 chars; log WARN if truncated
    - Build user message: `"Item type: %s\nTitle: %s\nDescription: %s\nExternal URL: %s".formatted(...)`
    - POST to `https://api.anthropic.com/v1/messages` with headers `x-api-key`, `anthropic-version: 2023-06-01`
    - Extract `content[0].text` from response JSON
    - Strip markdown fences if present
    - Parse to `ClaudeVerificationResponse` via `ObjectMapper`
    - Log at INFO: `"prompt={}, latencyMs={}", PROMPT_NAME, elapsed`
    - Throw `AiServiceException` on `RestClientException` or `JsonProcessingException`
- [X] T009 [US1] Update `toVerificationResponse()` mapper in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/service/PortfolioServiceImpl.java` — add `vr.getReviewSource()` as argument after `vr.getReviewerNote()` in `VerificationRequestResponse` constructor call
- [X] T010 [US1] Add `private final ClaudeVerificationService claudeVerificationService;` field to `PortfolioServiceImpl` (Lombok `@RequiredArgsConstructor` wires it automatically)
- [X] T011 [US1] [US2] Update `PortfolioServiceImpl.requestVerification()` in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/service/PortfolioServiceImpl.java`:
  - Add `@Transactional` annotation (saves VerificationRequest + possibly item atomically)
  - After existing ownership + duplicate checks, build and populate `VerificationRequest` then:
    - **US1 — happy path**: call `claudeVerificationService.verify(item)` → set `vr.setStatus(result.decision())`, `vr.setReviewerNote(result.reason())`, `vr.setReviewSource("AI")`, `vr.setReviewedAt(Instant.now())`; if `"APPROVED".equals(result.decision())` → `item.setVerified(true)`, `portfolioItemRepository.save(item)`
    - **US2 — fallback**: `catch (AiServiceException e)` → set `vr.setStatus("PENDING")`, `vr.setReviewerNote("Automated review unavailable — your item has been queued for manual review.")`, `vr.setReviewSource("PENDING_FALLBACK")`; leave `reviewedAt = null`
  - Save and return `toVerificationResponse(verificationRequestRepository.save(vr))`
- [X] T012 [P] [US2] Update `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/exception/GlobalExceptionHandler.java` — add `@ExceptionHandler(AiServiceException.class)` → 503 Service Unavailable (defensive: handles any `AiServiceException` that escapes the service layer)

**Checkpoint**: US1 + US2 fully functional. `POST /verify` returns AI decision immediately; fallback returns PENDING on Claude failure.

---

## Phase 3: US3 — Admin Manual Override (P3)

**Goal**: `PATCH /portfolio/verification/{id}` still works for admin manual override; now stamps `reviewSource: HUMAN` on the decision. No new endpoint — existing flow updated.

**Independent Test**: Admin `PATCH /portfolio/verification/{id}` with `decision: APPROVED` → `status: APPROVED`, `reviewSource: HUMAN`. Non-admin → 403 (unchanged).

- [X] T013 [US3] Update `PortfolioServiceImpl.reviewVerification()` in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/service/PortfolioServiceImpl.java` — after setting `vr.setStatus(decision.decision())`, add `vr.setReviewSource("HUMAN")`

**Checkpoint**: Admin override stamps `reviewSource: HUMAN`. All three user stories now functional.

---

## Phase 4: Tests

**Purpose**: Cover all three user stories + protect against regressions in existing feature 004 tests.

- [X] T014 [P] [US1] [US2] Create `backend/portfolio-service/src/test/java/com/skillbridge/portfolio/service/ClaudeVerificationServiceTest.java` — mock `RestTemplate.postForObject`:
  - `verify_validItem_claudeApproves_returnsApprovedDecision` — mock returns `{"content":[{"text":"{\"decision\":\"APPROVED\",\"reason\":\"Clear project.\"}"}]}`
  - `verify_validItem_claudeRejects_returnsRejectedDecision` — mock returns REJECTED JSON
  - `verify_malformedJson_throwsAiServiceException` — mock returns `{"content":[{"text":"not json"}]}`
  - `verify_httpError_throwsAiServiceException` — mock throws `RestClientException`
  - `verify_longDescription_truncatesTo2000Chars` — item with 3000-char description; assert truncation (verify Claude receives ≤2000 chars in the request body)
- [X] T015 [P] [US1] [US2] [US3] Update `backend/portfolio-service/src/test/java/com/skillbridge/portfolio/service/PortfolioServiceTest.java`:
  - Add `@Mock ClaudeVerificationService claudeVerificationService;` field
  - Update `requestVerification_happyPath_returnsPendingRequest` → rename to `requestVerification_claudeApproves_returnsApprovedStatus`; mock `claudeVerificationService.verify()` → returns `new ClaudeVerificationResponse("APPROVED", "Good project")`; assert `status=APPROVED`, `reviewSource=AI`
  - Add `requestVerification_claudeApproves_setsItemVerifiedTrue` — assert `item.isVerified() == true` after APPROVED
  - Add `requestVerification_claudeRejects_itemRemainsUnverified` — mock returns REJECTED; assert `item.isVerified() == false`, `reviewSource=AI`
  - Add `requestVerification_claudeUnavailable_returnsPending` — mock throws `AiServiceException`; assert `status=PENDING`, `reviewSource=PENDING_FALLBACK`
  - Update `reviewVerification_approved_setsItemVerifiedTrue` — assert `reviewSource=HUMAN` on saved request
  - Update `reviewVerification_rejected_itemRemainsUnverified` — assert `reviewSource=HUMAN` on saved request
- [X] T016 [P] [US1] [US2] Update `backend/portfolio-service/src/test/java/com/skillbridge/portfolio/controller/PortfolioControllerTest.java`:
  - Rename `requestVerification_happyPath_returns201` → `requestVerification_claudeApproves_returns200`; change `status().isCreated()` → `status().isOk()`; update mock `VerificationRequestResponse` to include `reviewSource: "AI"`; assert `$.reviewSource` = `"AI"`
  - Update `reviewVerification_adminApproves_returns200` mock response — include `reviewSource: "HUMAN"` in `VerificationRequestResponse` constructor; assert `$.reviewSource` = `"HUMAN"`
  - Add `requestVerification_claudeUnavailable_returns200WithPending` — mock `portfolioService.requestVerification()` returns PENDING response with `reviewSource: PENDING_FALLBACK`; assert HTTP 200 and `$.status` = `"PENDING"`

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Foundation) ──────────────────────────────────────────► Phase 2 (US1+US2)
                                                                          │
                                                              ┌───────────┤
                                                              ▼           ▼
                                                        Phase 3 (US3)  Phase 4 (Tests)*
```

*Tests depend on US1+US2+US3 all being implemented, so run after Phase 3.

### User Story Dependencies

- **US1 + US2 (P1+P2)**: Requires Phase 1 complete. Same implementation unit — cannot be split.
- **US3 (P3)**: Requires Phase 1 complete. Independent of US1/US2 implementation (touches different method).
- **Tests (Phase 4)**: Requires US1+US2+US3 complete.

### Within Each Phase

- Phase 1: T002–T007 all [P] — run in parallel after T001 (migration first, entities depend on it logically)
- Phase 2: T008 → T009 → T010 → T011 sequential (each builds on previous); T012 [P] independent
- Phase 3: T013 single task
- Phase 4: T014, T015, T016 all [P] — different test files, no dependencies between them

---

## Parallel Execution Examples

### Phase 1 (after T001):
```
T002 VerificationRequest entity   ─┐
T003 VerificationRequestResponse  ─┤
T004 AiServiceException           ─┼─ all parallel
T005 ClaudeVerificationResponse   ─┤
T006 application.yml              ─┤
T007 docker-compose.yml           ─┘
```

### Phase 4 (after Phase 3 complete):
```
T014 ClaudeVerificationServiceTest ─┐
T015 PortfolioServiceTest updates  ─┼─ all parallel
T016 PortfolioControllerTest fixes ─┘
```

---

## Implementation Strategy

### MVP (US1 + US2 only — instant AI decisions + fallback)

1. Complete Phase 1 (Foundation)
2. Complete Phase 2 (US1 + US2)
3. **STOP & VALIDATE**: `./mvnw test` passes; manual `POST /verify` returns APPROVED/REJECTED; fallback returns PENDING with invalid key
4. US3 and tests can follow

### Incremental Delivery

1. Foundation → entity/config ready
2. US1+US2 → AI verification live (MVP — removes admin account dependency)
3. US3 → admin override available for corrections
4. Tests → JaCoCo ≥ 70% confirmed

---

## Notes

- T009 (mapper) MUST be implemented before T011 (service method) — mapper is called by `requestVerification`
- T010 (field injection) MUST precede T011 — `ClaudeVerificationService` must be in scope
- `@Transactional` on `requestVerification` is mandatory — method now saves two entities atomically
- No new endpoints — this is a behaviour change to `POST /verify` and an augmentation of `PATCH /verification/{id}`
- Existing `PortfolioControllerTest` tests will fail until T016 is complete — do not run JaCoCo check before T016
