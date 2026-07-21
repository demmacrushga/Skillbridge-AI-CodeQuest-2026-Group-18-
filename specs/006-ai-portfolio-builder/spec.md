# Feature Specification: AI-Powered Portfolio Builder

**Feature Branch**: `006-ai-portfolio-builder`

**Created**: 2026-06-29

**Status**: Draft

**Input**: Instead of adding portfolio items one by one, a student uploads a CV (PDF/DOCX) or pastes a website link (GitHub, LinkedIn, personal site). Claude AI extracts all relevant achievements, projects, certifications, and awards. The student reviews the extracted items, edits or excludes as needed, and batch-saves to their portfolio.

## User Scenarios & Testing

### User Story 1 — Build Portfolio from CV Upload (Priority: P1)

A student uploads their CV (PDF or DOCX). Claude parses the document, extracts all portfolio-worthy items (projects, certifications, awards, publications), and returns them as pre-filled portfolio items. The student reviews the list, edits titles/descriptions, unchecks items they want to exclude, and saves the selected items to their portfolio in one action.

**Why this priority**: Solves the cold-start problem. Most students already have a CV but never build a portfolio because manual entry is tedious. This turns a 30-minute chore into a 2-minute review.

**Independent Test**: `POST /portfolio/extract` with a PDF file → 200 with array of extracted items (itemType, title, description, externalUrl, confidence). Student selects items → `POST /portfolio/items/batch` → 201 with saved `PortfolioItemResponse[]`. Items appear in `GET /portfolio/mine`.

**Acceptance Scenarios**:

1. **Given** a student has a CV PDF with 3 projects and 2 certifications listed, **When** they upload it to `POST /portfolio/extract`, **Then** Claude returns ~5 extracted items with correct `itemType` classifications, titles, and descriptions, each with a confidence score.
2. **Given** the extraction returned 5 items, **When** the student unchecks 1 item and taps "Add 4 items", **Then** `POST /portfolio/items/batch` saves 4 items and they appear in the portfolio list.
3. **Given** a student uploads a non-PDF/DOCX file, **Then** 400 Bad Request with "Only PDF and DOCX files are accepted."
4. **Given** a student uploads a file larger than 5MB, **Then** 400 Bad Request with "File exceeds maximum allowed size of 5MB."
5. **Given** a student uploads a CV with no portfolio-worthy content (e.g., a list of courses with no projects), **When** Claude processes it, **Then** 200 with an empty array `[]`. Frontend shows "No items found — try adding manually."
6. **Given** the Claude API is down, **When** a student uploads a CV, **Then** 503 with "AI service unavailable. Please try again or add items manually." No items are saved.
7. **Given** Claude returns malformed JSON, **When** the response is parsed, **Then** 503 with "AI service returned an invalid response." No items are saved.

---

### User Story 2 — Build Portfolio from Website Link (Priority: P2)

A student pastes a URL (GitHub profile, LinkedIn, personal website). The system fetches the page content, Claude extracts portfolio-worthy items, and the student reviews and saves them — same review flow as CV upload.

**Why this priority**: GitHub profiles and personal sites contain structured project data that's easy for Claude to parse. Complements CV upload for students who have a digital presence but not a polished CV.

**Independent Test**: `POST /portfolio/extract-url` with `{ "url": "https://github.com/username" }` → 200 with array of extracted items. Same batch-save flow as US1.

**Acceptance Scenarios**:

1. **Given** a student pastes a valid GitHub profile URL, **When** they submit it, **Then** the system fetches the page, Claude extracts repos/projects, and returns items with `externalUrl` pointing to the repos.
2. **Given** a student pastes an invalid URL (not a valid URL format), **Then** 400 Bad Request with "url must be a valid URL."
3. **Given** a student pastes a URL that returns 404 or is unreachable, **Then** 502 Bad Gateway with "Could not fetch content from the provided URL."
4. **Given** the Claude API is down, **When** a student submits a URL for extraction, **Then** 503 with "AI service unavailable. Please try again or add items manually." No items are saved.
5. **Given** Claude returns malformed JSON, **When** the response is parsed, **Then** 503 with "AI service returned an invalid response." No items are saved.

---

### Edge Cases

- What happens when the CV has no portfolio-worthy content? Claude returns an empty array. Frontend shows "No items found — try adding manually."
- What happens when the website is behind a login wall (e.g., private LinkedIn profile)? Fetched HTML is minimal. Claude may return few or no items. Acceptable — student can still use CV upload.
- What if Claude returns an item with `itemType` not in the allowed set? Service normalises to `OTHER`.
- What if the fetched HTML exceeds 50,000 characters? Truncate to 50,000 chars before sending to Claude. Log WARN.
- What if the same item is extracted twice (duplicate)? No server-side dedup for V1. Student unchecks duplicates during review.
- What if `externalUrl` is null in an extracted item? Valid — some CV achievements have no URL.
- What if the CV PDF is password-protected? PDFBox will throw during parsing. System returns 400 Bad Request with "Could not parse PDF — the file may be password-protected or corrupted."
- What if the URL points to non-HTML content (e.g., a direct PDF download, image, or binary file)? System checks the `Content-Type` of the response. If it's not `text/html`, return 400 Bad Request with "URL must point to an HTML page, not a file download."
- What if Claude returns more than 50 items? Extraction endpoint returns all items. If the student selects all 50+ and batch-saves, `POST /portfolio/items/batch` rejects with 400 "items must contain 1–50 entries." Frontend should warn the student to uncheck some items before saving.
- What if one item in a batch save fails validation (e.g., title > 255 chars)? The entire batch fails with 400. No items are saved (atomic — see FR-019). The student must fix or remove the invalid item and resubmit.

## Requirements

### Functional Requirements

- **FR-001**: System MUST accept CV file upload (PDF, DOCX) at `POST /portfolio/extract` and return an array of extracted portfolio items.
- **FR-002**: System MUST accept a website URL at `POST /portfolio/extract-url` and return an array of extracted portfolio items.
- **FR-003**: System MUST parse PDF files using Apache PDFBox and DOCX files using Apache POI to extract text before sending to Claude.
- **FR-004**: System MUST fetch website HTML using RestTemplate, clean it with Jsoup, and extract text content before sending to Claude.
- **FR-005**: Claude prompt MUST be defined as a named constant (`PORTFOLIO_EXTRACTION_V1`), never inline.
- **FR-006**: Claude MUST return a JSON array of items with fields: `itemType`, `title`, `description`, `externalUrl`, `confidence`.
- **FR-007**: System MUST validate Claude's JSON response for expected shape before returning to the caller.
- **FR-008**: System MUST fall back to a 503 response with a human-readable message when the Claude API is unavailable or returns malformed JSON.
- **FR-009**: System MUST log the prompt template name and Claude response latency at INFO level on every extraction call.
- **FR-010**: System MUST provide `POST /portfolio/items/batch` to save multiple portfolio items in a single transactional request.
- **FR-011**: `POST /portfolio/extract` MUST enforce a 5MB file size limit and reject non-PDF/DOCX files with 400.
- **FR-012**: `POST /portfolio/extract-url` MUST validate the URL format and enforce a 15s connect timeout / 30s read timeout on the fetch.
- **FR-013**: System MUST truncate fetched HTML content to 50,000 characters before sending to Claude. Log WARN if truncation occurs.
- **FR-014**: System MUST normalise Claude's `itemType` to one of: `PROJECT`, `CERTIFICATION`, `AWARD`, `PUBLICATION`, `OTHER`. Unknown values map to `OTHER`.
- **FR-015**: Extracted items MUST NOT be persisted by the extraction endpoint. The student must explicitly batch-save selected items.
- **FR-016**: `ANTHROPIC_API_KEY` MUST be injected via environment variable; never hardcoded. Already configured in feature 005.
- **FR-017**: Frontend MUST show a review screen with checkboxes (default checked), edit capability per item, and an "Add N items" button.
- **FR-018**: Frontend MUST show a processing/loading state during extraction (expected 5–15 seconds).
- **FR-019**: `POST /portfolio/items/batch` MUST be atomic — either all items are saved successfully or no items are saved. If any item fails validation, the entire batch is rejected with 400 and no items are persisted.
- **FR-020**: `POST /portfolio/extract` MUST return 400 Bad Request with "Could not parse PDF — the file may be password-protected or corrupted." when PDF parsing fails due to encryption or corruption.
- **FR-021**: `POST /portfolio/extract-url` MUST check the `Content-Type` of the fetched response. If it is not `text/html`, return 400 Bad Request with "URL must point to an HTML page, not a file download."
- **FR-022**: Claude extraction MUST be limited to a maximum of 50 items in the response. If Claude returns more than 50, only the first 50 are returned to the frontend. Log INFO with the truncated count.

### Key Entities

- **ExtractedItemResponse** (not persisted — returned to frontend for review): `{ itemType, title, description, externalUrl, confidence }`
- **BatchCreateRequest**: `{ items: [{ itemType, title, description, externalUrl }] }` — validated the same as individual `PortfolioItemRequest`
- **PortfolioItem** (existing): No schema changes. Batch save creates standard `PortfolioItem` rows.

## Success Criteria

### Measurable Outcomes

- **SC-001**: `POST /portfolio/extract` with a real CV returns 3+ relevant items in ≥90% of calls when Claude API is healthy.
- **SC-002**: `POST /portfolio/extract-url` with a GitHub profile URL returns repo-based items with correct `externalUrl` values.
- **SC-003**: `POST /portfolio/items/batch` saves all items atomically — either all succeed or all fail (transactional).
- **SC-004**: Claude prompt name `PORTFOLIO_EXTRACTION_V1` appears in INFO logs on every extraction call.
- **SC-005**: JaCoCo line coverage remains ≥70% after changes.
- **SC-006**: When Claude API is mocked to fail, endpoint returns 503 (no 500) with a human-readable message.

## Assumptions

- Portfolio-service (feature 004) is fully functional with `POST /portfolio/items` working.
- Feature 005 (AI verification) code is already merged — `ClaudeVerificationService`, `AiServiceException`, `anthropic.*` config, and `ANTHROPIC_API_KEY` in docker-compose all exist.
- `RestTemplate` and `RestTemplateConfig` already present in portfolio-service — reuse for Claude calls and website fetching.
- Claude model: `claude-sonnet-4-6` (same as other services).
- Synchronous extraction — no async queue. Acceptable latency (5–15s for extraction, similar to skill-gap analysis).
- No server-side deduplication for V1 — student handles duplicates during review.
- No persistence of extracted items — extraction is stateless. Student must explicitly batch-save.
- Website fetching works for public pages only. Login-walled pages (private LinkedIn) may return minimal content.
- `expo-document-picker` already used in the skill-gap screen — reuse the same pattern for CV upload in portfolio.
