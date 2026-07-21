# Implementation Plan: AI-Powered Portfolio Verification

**Branch**: `005-ai-powered-portfolio-verification` | **Date**: 2026-06-28
**Spec**: `specs/005-ai-powered-portfolio-verification/spec.md`

## Summary

Add Claude AI auto-verification to portfolio-service. When a student calls `POST /portfolio/items/{id}/verify`, the service calls Claude synchronously with item details, gets `APPROVED` or `REJECTED` decision, persists it, and returns the resolved `VerificationRequestResponse` immediately. If Claude is unavailable, the request is saved as `PENDING` with a fallback note (200, no 5xx). Admin `PATCH /portfolio/verification/{id}` is retained for manual override, now stamped `reviewSource: HUMAN`.

## Technical Context

**Language/Version**: Java 21, Spring Boot 3.3.6

**Primary Dependencies**: RestTemplate (already wired), Jackson ObjectMapper (already wired), `anthropic.api-key` config (add to application.yml + docker-compose)

**Storage**: PostgreSQL 16, schema `portfolio` — V5 migration adds `review_source VARCHAR(20)` to `verification_requests`

**Testing**: JUnit 5, Mockito, `@WebMvcTest`, JaCoCo ≥ 70%

**Target Platform**: Docker container, port 8004

**New files**:
- `service/ClaudeVerificationService.java`
- `service/dto/ClaudeVerificationResponse.java`
- `exception/AiServiceException.java`
- `db/migration/V5__add_review_source_to_verification_requests.sql`

**Modified files**:
- `service/PortfolioServiceImpl.java` — `requestVerification` calls Claude; `reviewVerification` sets `reviewSource=HUMAN`
- `entity/VerificationRequest.java` — add `reviewSource` field
- `dto/response/VerificationRequestResponse.java` — add `reviewSource` field
- `exception/GlobalExceptionHandler.java` — add `AiServiceException` → 503 handler
- `resources/application.yml` — add `anthropic.*` config block
- `docker-compose.yml` — add `ANTHROPIC_API_KEY` to portfolio-service environment
- `test/PortfolioServiceTest.java` — update existing tests + add ClaudeVerificationService tests
- `test/PortfolioControllerTest.java` — fix broken status assertion (201→200); add `reviewSource` assertions

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I. Microservice Autonomy | ✅ | No cross-DB access; Claude call is external |
| II. Mobile-First API Contract | ✅ | Structured JSON; `reviewSource` added to response |
| III. AI Prompt Integrity | ✅ | `PORTFOLIO_VERIFICATION_V1` named constant; response validated; fallback on failure; prompt name + latency logged |
| IV. Test Coverage | ✅ | Unit tests for ClaudeVerificationService (happy path, malformed JSON, HTTP error); updated PortfolioServiceTest |
| V. Observability | ✅ | Prompt name + latency at INFO; no PII in logs |

## Design Decisions

1. **Synchronous AI call** — Claude called in-request, not async. Acceptable latency (~2–8s) for a verification action. See research.md Decision 1.
2. **Fallback = PENDING, not 5xx** — `AiServiceException` caught in `requestVerification`, saved as PENDING with `reviewSource=PENDING_FALLBACK`. HTTP 200 returned. See research.md Decision 3.
3. **`review_source` column** — V5 migration; `DEFAULT 'AI'` for existing rows; three values: `AI`, `HUMAN`, `PENDING_FALLBACK`. See research.md Decision 4.
4. **`max_tokens: 256`** — verification response is tiny. Separate config key `anthropic.verification-max-tokens`. See research.md Decision 7.
5. **`PATCH` override retained** — sets `reviewSource=HUMAN`. ADMIN role check unchanged (service layer). See research.md Decision 6.
6. **Description truncated at 2000 chars** — logged at WARN if truncation occurs. See research.md Decision 8.
7. **`POST /verify` returns 200 not 201** — response is a resolved decision, not a newly created pending record. Contract updated.
8. **No `@Cacheable`** — each item is unique content; caching not applicable.
9. **`AiServiceException` copied from career-service** — same pattern, different package.

## Phased Task List

### Phase 1: Foundation

- [ ] T001 Flyway `V5__add_review_source_to_verification_requests.sql` — `ALTER TABLE portfolio.verification_requests ADD COLUMN IF NOT EXISTS review_source VARCHAR(20) NOT NULL DEFAULT 'AI'`
- [ ] T002 [P] Add `reviewSource` field to `VerificationRequest.java` entity — `private String reviewSource;`
- [ ] T003 [P] Add `reviewSource` field to `VerificationRequestResponse.java` record — new param after `reviewerNote`
- [ ] T004 [P] Create `AiServiceException.java` in `exception/` — copy from career-service, update package
- [ ] T005 [P] Create `service/dto/ClaudeVerificationResponse.java` — `record ClaudeVerificationResponse(String decision, String reason) {}`
- [ ] T006 [P] Update `application.yml` — add `anthropic.api-key`, `anthropic.model: claude-sonnet-4-6`, `anthropic.verification-max-tokens: 256`, `claude.connect-timeout-ms: 15000`, `claude.read-timeout-ms: 120000`
- [ ] T007 [P] Update `docker-compose.yml` — add `ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}` to portfolio-service environment

### Phase 2: ClaudeVerificationService

- [ ] T008 Create `service/ClaudeVerificationService.java`:
  - Constant: `PORTFOLIO_VERIFICATION_V1`
  - System prompt: return ONLY `{ "decision": "APPROVED"|"REJECTED", "reason": "..." }` as valid JSON
  - `verify(PortfolioItem item)` method:
    - Build user message: itemType, title, description (truncated to 2000 chars, WARN if truncated), externalUrl
    - POST to `https://api.anthropic.com/v1/messages` with `x-api-key`, `anthropic-version: 2023-06-01`, model, `max_tokens: 256`
    - Extract `content[0].text` from response
    - Strip markdown fences if present
    - Parse JSON → `ClaudeVerificationResponse`
    - Log: `prompt={}, latencyMs={}` at INFO
    - Throw `AiServiceException` on `RestClientException` or `JsonProcessingException`

### Phase 3: Service + Controller Updates

- [ ] T009 Update `toVerificationResponse()` mapper in `PortfolioServiceImpl` — add `reviewSource` as final param to `VerificationRequestResponse` constructor (must be done before T010/T011 which call this mapper)
- [ ] T010 Update `PortfolioServiceImpl.requestVerification()`:
  - Add `private final ClaudeVerificationService claudeVerificationService;` field (Lombok picks it up via `@RequiredArgsConstructor`)
  - Add `@Transactional` — method now saves VerificationRequest AND potentially `item.verified=true` atomically
  - After ownership check + duplicate check:
    - Call `claudeVerificationService.verify(item)`
    - On success: set `status = decision.decision()`, `reviewerNote = decision.reason()`, `reviewSource = "AI"`, `reviewedAt = now()`; if APPROVED set `item.verified = true` then `portfolioItemRepository.save(item)`
    - On `AiServiceException`: set `status = "PENDING"`, `reviewerNote = "Automated review unavailable — your item has been queued for manual review."`, `reviewSource = "PENDING_FALLBACK"`, `reviewedAt = null`
  - Return saved `VerificationRequestResponse` (including `reviewSource`)
- [ ] T011 Update `PortfolioServiceImpl.reviewVerification()` — set `reviewSource = "HUMAN"` on manual decisions
- [ ] T012 [P] Update `GlobalExceptionHandler.java` — add `AiServiceException` → 503 handler (for cases where it propagates past service layer — defensive)

### Phase 4: Tests

- [ ] T013 [P] Create `ClaudeVerificationServiceTest.java`:
  - Mock `RestTemplate.postForObject`
  - `verify_validItem_returnsApproved` — mock returns valid Claude JSON
  - `verify_rejectedItem_returnsRejected` — mock returns REJECTED JSON
  - `verify_malformedJson_throwsAiServiceException`
  - `verify_httpError_throwsAiServiceException`
  - `verify_longDescription_truncatesTo2000Chars`
- [ ] T014 [P] Update `PortfolioServiceTest.java`:
  - Add `@Mock ClaudeVerificationService claudeVerificationService`
  - Update `requestVerification_happyPath_returnsPendingRequest` → now returns APPROVED
  - Add `requestVerification_claudeApproves_setsItemVerifiedTrue`
  - Add `requestVerification_claudeRejects_itemRemainsUnverified`
  - Add `requestVerification_claudeUnavailable_returnsPending`
  - Update `reviewVerification_approved_setsItemVerifiedTrue` — assert `reviewSource=HUMAN`
  - Update `reviewVerification_rejected_itemRemainsUnverified` — assert `reviewSource=HUMAN`
- [ ] T015 [P] Update `PortfolioControllerTest.java`:
  - `requestVerification_happyPath_returns201` → rename to `requestVerification_happyPath_returns200`, update `status().isCreated()` → `status().isOk()`, assert `$.reviewSource` = `AI`
  - `reviewVerification_adminApproves_returns200` — update mock response to include `reviewSource: HUMAN`
  - Add `requestVerification_claudeUnavailable_returns200WithPending` — mock service returns PENDING with `reviewSource: PENDING_FALLBACK`, assert 200 and `$.status = PENDING`

## Verification

1. `./mvnw test` — all tests pass, JaCoCo ≥ 70%
2. `docker-compose up --build portfolio-service` — health passes
3. `POST /portfolio/items/{id}/verify` with real Claude key → APPROVED or REJECTED with `reviewerNote`
4. Logs show `prompt=PORTFOLIO_VERIFICATION_V1, latencyMs=...`
5. `POST /verify` with `ANTHROPIC_API_KEY=invalid` → 200 with `status: PENDING`, `reviewSource: PENDING_FALLBACK`
6. `PATCH /portfolio/verification/{id}` with admin token → `reviewSource: HUMAN`
