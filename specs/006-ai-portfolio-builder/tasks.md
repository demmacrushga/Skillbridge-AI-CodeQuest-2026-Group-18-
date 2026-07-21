# Tasks: AI-Powered Portfolio Builder

**Input**: Design documents from `/specs/006-ai-portfolio-builder/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/extraction.md, quickstart.md

**Tests**: Required — Constitution Principle IV mandates unit + integration tests, JaCoCo ≥ 70%.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/` and `backend/portfolio-service/src/test/java/com/skillbridge/portfolio/`
- **Frontend**: `frontend/app/(app)/`, `frontend/services/`, `frontend/types/`
- Config: `backend/portfolio-service/src/main/resources/application.yml`, `backend/portfolio-service/pom.xml`

---

## Phase 1: Setup (Dependencies & Config)

**Purpose**: Add new Maven dependencies and config keys needed by all user stories

- [X] T001 Add Apache PDFBox 3.0.3, Apache POI 5.3.0, and Jsoup 1.18.1 dependencies to `backend/portfolio-service/pom.xml`
- [X] T002 Add extraction config keys to `backend/portfolio-service/src/main/resources/application.yml` — `anthropic.extraction-max-tokens: 4096`, `portfolio.extraction.max-html-chars: 50000`, `portfolio.extraction.url-connect-timeout-ms: 15000`, `portfolio.extraction.url-read-timeout-ms: 30000`

**Checkpoint**: Dependencies resolved, config in place. Run `./mvnw clean compile` to verify.

---

## Phase 2: Foundational (Shared DTOs, Exceptions, Batch Save)

**Purpose**: Shared components needed by BOTH US1 (CV upload) and US2 (URL extraction) — DTOs, exception classes, batch save endpoint, and the Claude extraction service

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Create `ExtractedItemTemplate` record in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/service/dto/ExtractedItemTemplate.java` — fields: `String itemType, String title, String description, String externalUrl, double confidence`
- [X] T004 [P] Create `ExtractedItemResponse` record in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/dto/response/ExtractedItemResponse.java` — fields: `String itemType, String title, String description, String externalUrl, double confidence`
- [X] T005 [P] Create `ExtractUrlRequest` record in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/dto/request/ExtractUrlRequest.java` — `@NotBlank @URL String url`
- [X] T006 [P] Create `BatchCreateItemsRequest` record in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/dto/request/BatchCreateItemsRequest.java` — `@NotNull @Size(min=1,max=50) @Valid List<PortfolioItemRequest> items`
- [X] T007 [P] Create `FileSizeExceededException` in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/exception/FileSizeExceededException.java`
- [X] T008 [P] Create `UnsupportedFileTypeException` in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/exception/UnsupportedFileTypeException.java`
- [X] T009 [P] Create `FileParsingException` in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/exception/FileParsingException.java`
- [X] T010 [P] Create `WebsiteFetchException` in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/exception/WebsiteFetchException.java`
- [X] T011 Update `GlobalExceptionHandler` in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/exception/GlobalExceptionHandler.java` — add handlers for `FileSizeExceededException` → 400, `UnsupportedFileTypeException` → 400, `FileParsingException` → 400, `WebsiteFetchException` → 502, `AiServiceException` → 503 (FR-008, FR-020)
- [X] T012 Create `ClaudeExtractionService` in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/service/ClaudeExtractionService.java` — prompt constant `PORTFOLIO_EXTRACTION_V1`, system prompt instructing Claude to return JSON array of items with `itemType, title, description, externalUrl, confidence`, `List<ExtractedItemTemplate> extract(String content)` method, `@Value("${anthropic.extraction-max-tokens}") int maxTokens`, strip markdown fences, throw `AiServiceException` on `RestClientException` or `JsonProcessingException`, log `prompt=PORTFOLIO_EXTRACTION_V1, latencyMs=..., itemCount=...` at INFO (FR-005, FR-006, FR-007, FR-009, FR-022)
- [X] T013 Add `batchCreateItems` method to `PortfolioService` interface in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/service/PortfolioService.java` — `List<PortfolioItemResponse> batchCreateItems(BatchCreateItemsRequest request, UUID userId)`
- [X] T014 Implement `batchCreateItems` in `PortfolioServiceImpl` at `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/service/PortfolioServiceImpl.java` — `@Transactional`, iterate items, create `PortfolioItem` per item, save all, return `PortfolioItemResponse[]`. If any item fails validation, entire batch fails (FR-010, FR-019)
- [X] T015 Add `POST /portfolio/items/batch` endpoint to `PortfolioController` at `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/controller/PortfolioController.java` — `@PostMapping("/items/batch")`, accepts `@Valid @RequestBody BatchCreateItemsRequest`, returns `ResponseEntity<List<PortfolioItemResponse>>` with 201 Created (FR-010)
- [X] T016 [P] Write unit tests for `ClaudeExtractionService` in `backend/portfolio-service/src/test/java/com/skillbridge/portfolio/service/ClaudeExtractionServiceTest.java` — mock `RestTemplate.postForObject`, test: happy path returns items, malformed JSON throws `AiServiceException`, HTTP error throws `AiServiceException`, empty array returned when Claude returns `[]`, 50+ items truncated to 50 (FR-022), markdown fences stripped
- [X] T017 [P] Write unit tests for `batchCreateItems` in `backend/portfolio-service/src/test/java/com/skillbridge/portfolio/service/PortfolioServiceImplTest.java` — test: happy path saves all items, empty list rejected, 51 items rejected, atomicity (one invalid item fails entire batch — FR-019), all items get correct `userId`
- [X] T018 [P] Write controller tests for batch endpoint in `backend/portfolio-service/src/test/java/com/skillbridge/portfolio/controller/PortfolioControllerTest.java` — test: `POST /portfolio/items/batch` returns 201 with saved items, invalid item returns 400, empty items returns 400, 51 items returns 400

**Checkpoint**: Foundation ready — batch save works, Claude extraction service works, all shared DTOs and exceptions in place. User story implementation can now begin.

---

## Phase 3: User Story 1 — Build Portfolio from CV Upload (Priority: P1) 🎯 MVP

**Goal**: Student uploads a CV (PDF/DOCX), Claude extracts portfolio items, student reviews and batch-saves

**Independent Test**: `POST /portfolio/extract` with a PDF → 200 with extracted items array. `POST /portfolio/items/batch` with selected items → 201. Items appear in `GET /portfolio/mine`.

### Tests for User Story 1

- [X] T019 [P] [US1] Write unit tests for `FileParserService` in `backend/portfolio-service/src/test/java/com/skillbridge/portfolio/service/FileParserServiceTest.java` — test: valid PDF extracts text, valid DOCX extracts text, file > 5MB throws `FileSizeExceededException`, non-PDF/DOCX throws `UnsupportedFileTypeException`, empty/corrupted PDF throws `FileParsingException`, password-protected PDF throws `FileParsingException` (FR-020)

### Implementation for User Story 1

- [X] T020 [US1] Create `FileParserService` in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/service/FileParserService.java` — `String extractText(MultipartFile file)`, validate size ≤ 5MB (FR-011), validate MIME type PDF/DOCX only (FR-011), PDF via `Loader.loadPDF()` + `PDFTextStripper`, DOCX via `XWPFDocument` + `XWPFWordExtractor`, throw `FileParsingException` on empty result or encrypted PDF (FR-020). Copy pattern from `skill-gap-service/FileParserService.java`
- [X] T021 [US1] Add `extractFromCV` method to `PortfolioService` interface in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/service/PortfolioService.java` — `List<ExtractedItemResponse> extractFromCV(MultipartFile file, UUID userId)`
- [X] T022 [US1] Implement `extractFromCV` in `PortfolioServiceImpl` at `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/service/PortfolioServiceImpl.java` — call `fileParserService.extractText(file)`, call `claudeExtractionService.extract(text)`, normalise `itemType` to allowed set (FR-014), cap at 50 items (FR-022), map to `ExtractedItemResponse[]`, do NOT persist (FR-015)
- [X] T023 [US1] Add `POST /portfolio/extract` endpoint to `PortfolioController` at `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/controller/PortfolioController.java` — `@PostMapping(value="/extract", consumes=MULTIPART_FORM_DATA_VALUE)`, accepts `@RequestPart("file") MultipartFile file`, returns `ResponseEntity<List<ExtractedItemResponse>>` with 200 OK (FR-001)
- [X] T024 [US1] Write controller tests for CV extract endpoint in `backend/portfolio-service/src/test/java/com/skillbridge/portfolio/controller/PortfolioControllerTest.java` — test: valid PDF returns 200 with items, empty CV returns 200 with `[]`, non-PDF returns 400, oversized file returns 400, Claude down returns 503, malformed Claude JSON returns 503
- [X] T025 [P] [US1] Add `ExtractedItem` and `BatchCreatePayload` types to `frontend/types/portfolio.ts` — `ExtractedItem { itemType, title, description, externalUrl, confidence }`, `BatchCreatePayload { items: PortfolioItemRequest[] }`
- [X] T026 [P] [US1] Add `extractFromCV`, `extractFromUrl`, `batchCreateItems` functions to `frontend/services/portfolio.ts` — `extractFromCV` sends multipart FormData, `extractFromUrl` sends JSON, `batchCreateItems` sends JSON array
- [X] T027 [US1] Create portfolio review screen at `frontend/app/(app)/portfolio-review.tsx` — receive extracted items via route params, render list with checkboxes (default checked), edit button per item (opens inline edit for title/description/url), confidence indicator (amber dot if < 0.7), "Add N items" button calling `batchCreateItems`, navigate back to portfolio on success (FR-017)
- [X] T028 [US1] Add "Build with AI" button and extraction method modal to `frontend/app/(app)/portfolio.tsx` — "Build with AI" button next to existing "+" FAB in header, tapping opens bottom-sheet modal with "Upload CV" and "Paste Website Link" options. "Upload CV" uses `expo-document-picker` (PDF/DOCX), calls `extractFromCV`, shows processing animation (FR-018), navigates to `portfolio-review` on success. Show error alert on 503/400 (FR-017, FR-018)

**Checkpoint**: User Story 1 fully functional — student can upload CV, review extracted items, batch save. Test independently with a real PDF.

---

## Phase 4: User Story 2 — Build Portfolio from Website Link (Priority: P2)

**Goal**: Student pastes a URL, system fetches HTML, Claude extracts items, same review and batch-save flow as US1

**Independent Test**: `POST /portfolio/extract-url` with `{ "url": "https://github.com/username" }` → 200 with extracted items. Same batch-save flow as US1.

### Tests for User Story 2

- [X] T029 [P] [US2] Write unit tests for `WebsiteFetchService` in `backend/portfolio-service/src/test/java/com/skillbridge/portfolio/service/WebsiteFetchServiceTest.java` — mock `RestTemplate.exchange`, test: valid HTML returns cleaned text, 404 throws `WebsiteFetchException`, timeout throws `WebsiteFetchException`, non-HTML Content-Type throws `WebsiteFetchException` (FR-021), HTML > 50,000 chars truncated (FR-013), script/style tags stripped by Jsoup

### Implementation for User Story 2

- [X] T030 [US2] Create `WebsiteFetchService` in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/service/WebsiteFetchService.java` — `String fetchAndClean(String url)`, fetch HTML via `RestTemplate` with configurable timeouts (FR-012), check `Content-Type` is `text/html` (FR-021), clean HTML with `Jsoup.clean()` + `Jsoup.parse(html).text()`, truncate to 50,000 chars (FR-013), log WARN if truncated, throw `WebsiteFetchException` on HTTP errors/timeouts/non-HTML
- [X] T031 [US2] Add `extractFromUrl` method to `PortfolioService` interface in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/service/PortfolioService.java` — `List<ExtractedItemResponse> extractFromUrl(ExtractUrlRequest request, UUID userId)`
- [X] T032 [US2] Implement `extractFromUrl` in `PortfolioServiceImpl` at `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/service/PortfolioServiceImpl.java` — call `websiteFetchService.fetchAndClean(request.url())`, call `claudeExtractionService.extract(text)`, normalise `itemType` (FR-014), cap at 50 items (FR-022), map to `ExtractedItemResponse[]`, do NOT persist (FR-015)
- [X] T033 [US2] Add `POST /portfolio/extract-url` endpoint to `PortfolioController` at `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/controller/PortfolioController.java` — `@PostMapping("/extract-url")`, accepts `@Valid @RequestBody ExtractUrlRequest`, returns `ResponseEntity<List<ExtractedItemResponse>>` with 200 OK (FR-002)
- [X] T034 [US2] Write controller tests for URL extract endpoint in `backend/portfolio-service/src/test/java/com/skillbridge/portfolio/controller/PortfolioControllerTest.java` — test: valid URL returns 200 with items, invalid URL returns 400, unreachable URL returns 502, non-HTML response returns 400 (FR-021), Claude down returns 503
- [X] T035 [US2] Add "Paste Website Link" flow to the extraction modal in `frontend/app/(app)/portfolio.tsx` — URL input field with `keyboardType="url"`, submit button calls `extractFromUrl`, shows processing animation (FR-018), navigates to `portfolio-review` on success, show error alert on 400/502/503

**Checkpoint**: User Story 2 fully functional — student can paste a URL, review extracted items, batch save. Both US1 and US2 work independently.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Coverage, documentation, and end-to-end validation

- [X] T036 [P] Run `./mvnw verify` in `backend/portfolio-service/` — confirm JaCoCo line coverage ≥ 70% (SC-005). Add additional tests if coverage falls below threshold
- [X] T037 [P] Run `npm run typecheck` in `frontend/` — confirm no TypeScript errors in new files
- [X] T038 Run quickstart.md validation scenarios in `specs/006-ai-portfolio-builder/quickstart.md` — execute all curl commands against running portfolio-service, verify expected responses
- [X] T039 [P] Update `docs/api.md` — add `POST /portfolio/extract`, `POST /portfolio/extract-url`, `POST /portfolio/items/batch` endpoint documentation with request/response examples
- [X] T040 Verify nginx routing — confirm `nginx/nginx.conf` routes `/portfolio/extract`, `/portfolio/extract-url`, and `/portfolio/items/batch` to portfolio-service (existing `/portfolio/` location block should cover all three — verify no additional config needed)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion — independent of US2
- **User Story 2 (Phase 4)**: Depends on Phase 2 completion — independent of US1 (can run in parallel with US1)
- **Polish (Phase 5)**: Depends on US1 and US2 completion

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational only. No dependency on US2.
- **User Story 2 (P2)**: Depends on Foundational only. No dependency on US1.
  - US2 reuses the review screen (`portfolio-review.tsx`) and batch save endpoint from US1. If building sequentially (US1 first), US2 frontend work is minimal — just the URL input in the modal. If building in parallel, US2's frontend task (T035) depends on T027 (review screen) from US1.

### Within Each User Story

- Tests written before implementation (TDD)
- Service classes before controller endpoints
- Backend before frontend (frontend needs working API)
- Shared DTOs and exceptions created in Foundational phase

### Parallel Opportunities

- **Phase 1**: T001 and T002 can run in parallel (different files)
- **Phase 2**: T003–T010 all [P] — 8 tasks across different files, fully parallel
- **Phase 2**: T016, T017, T018 all [P] — test tasks across different files
- **Phase 3**: T019 (test) and T025/T026 (frontend types/services) are [P] — no dependency on backend implementation
- **Phase 4**: T029 (test) is [P] — can run while US1 is being implemented
- **US1 and US2** can run fully in parallel after Phase 2 (if team capacity allows)
- **Phase 5**: T036, T037, T039 all [P] — independent validation tasks

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Launch all DTO creation tasks together (8 parallel tasks):
Task T003: "Create ExtractedItemTemplate in service/dto/ExtractedItemTemplate.java"
Task T004: "Create ExtractedItemResponse in dto/response/ExtractedItemResponse.java"
Task T005: "Create ExtractUrlRequest in dto/request/ExtractUrlRequest.java"
Task T006: "Create BatchCreateItemsRequest in dto/request/BatchCreateItemsRequest.java"
Task T007: "Create FileSizeExceededException in exception/FileSizeExceededException.java"
Task T008: "Create UnsupportedFileTypeException in exception/UnsupportedFileTypeException.java"
Task T009: "Create FileParsingException in exception/FileParsingException.java"
Task T010: "Create WebsiteFetchException in exception/WebsiteFetchException.java"
```

## Parallel Example: US1 + US2 Backend

```bash
# After Phase 2, launch US1 and US2 backend services in parallel:
Task T020 [US1]: "Create FileParserService in service/FileParserService.java"
Task T030 [US2]: "Create WebsiteFetchService in service/WebsiteFetchService.java"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T018) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T019–T028)
4. **STOP and VALIDATE**: Upload a real CV PDF, verify extraction + review + batch save works end-to-end
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready, batch save works
2. Add User Story 1 → Upload CV → review → save (MVP!)
3. Add User Story 2 → Paste URL → review → save
4. Polish → coverage, docs, end-to-end validation

### Solo Developer Strategy

1. Complete Phase 1 + Phase 2 sequentially
2. Complete US1 (Phase 3) — this is the highest-value feature
3. Complete US2 (Phase 4) — reuses US1's review screen and batch save, so frontend work is minimal
4. Run Phase 5 validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1 and US2 share the review screen and batch save endpoint — built in US1, reused by US2
- Tests are mandatory (Constitution Principle IV) — write tests before implementation where possible
- No Flyway migrations needed — extraction is stateless, batch save uses existing `portfolio_items` table
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
