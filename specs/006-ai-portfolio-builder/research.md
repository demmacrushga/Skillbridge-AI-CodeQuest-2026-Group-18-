# Research: AI-Powered Portfolio Builder

## Decision 1: Extraction Endpoint — Separate from Item Creation

**Decision**: Extraction (`POST /portfolio/extract` and `POST /portfolio/extract-url`) is stateless. No items are persisted during extraction. Student reviews extracted items then explicitly batch-saves via `POST /portfolio/items/batch`.

**Rationale**: Trust and control. Students should see what goes into their portfolio before it's saved. Auto-saving AI-extracted data without review risks inaccurate entries appearing in a professional portfolio. Stateless extraction also means retries are safe — no duplicate items from re-running extraction.

**Alternatives considered**:
- Auto-save extracted items immediately — risks inaccurate/unwanted items in portfolio; student has to delete unwanted ones after.
- Save with a "DRAFT" status — adds schema complexity (new status column, draft→published transition). Overkill for V1.

---

## Decision 2: CV Parsing — Reuse skill-gap-service Pattern

**Decision**: Copy the `FileParserService` pattern from skill-gap-service into portfolio-service. Use Apache PDFBox 3.0.3 for PDF parsing and Apache POI 5.3.0 for DOCX parsing. Same 5MB file size limit and same MIME type validation (PDF + DOCX only).

**Rationale**: Constitution I (Microservice Autonomy) forbids calling skill-gap-service from portfolio-service for parsing — that would create a coupling between services for an internal concern. The parsing logic is small (~70 lines) and the dependencies (PDFBox, POI) are well-established. Copying the pattern keeps portfolio-service self-contained. The skill-gap-service already uses these exact library versions, so dependency compatibility is proven.

**Alternatives considered**:
- Cross-service call to skill-gap-service `/parse` endpoint — violates Constitution I autonomy; adds network dependency and latency.
- Apache Tika (universal parser) — heavier dependency, more than needed for just PDF + DOCX.
- Send raw file bytes to Claude directly — Claude doesn't parse PDFs/DOCXs reliably; text extraction is needed first.

---

## Decision 3: Website Fetching — Jsoup for HTML Cleaning

**Decision**: Add Jsoup 1.18.1 as a new dependency. Fetch HTML via `RestTemplate`, then use `Jsoup.clean()` with a safelist to strip scripts/styles/nav, and `Jsoup.parse(html).text()` to extract plain text. Truncate to 50,000 characters before sending to Claude.

**Rationale**: Raw HTML is noisy — `<script>`, `<style>`, `<nav>`, and boilerplate markup would confuse Claude and waste tokens. Jsoup is the standard Java HTML parser, lightweight (single JAR), and handles malformed HTML gracefully. 50,000 chars is ~12,000 tokens — well within Claude's context window while leaving room for the response.

**Alternatives considered**:
- Send raw HTML to Claude — wastes tokens on markup; Claude may focus on tags instead of content.
- Regular expression stripping — fragile, breaks on malformed HTML.
- Apache Tika HTML parser — overkill; Jsoup is simpler and purpose-built for HTML.
- Don't truncate — risk exceeding Claude context window on large pages; no benefit to sending 200KB of text.

---

## Decision 4: Claude Prompt Structure — JSON Array Response

**Decision**: Claude returns a JSON array of extracted items: `[{ "itemType": "...", "title": "...", "description": "...", "externalUrl": "..." | null, "confidence": 0.0-1.0 }]`. System prompt is `PORTFOLIO_EXTRACTION_V1` named constant.

**Rationale**: Array response maps naturally to "multiple items extracted from a CV/website". Each item has the same shape as `PortfolioItemRequest` (itemType, title, description, externalUrl) plus a `confidence` score that the frontend can use to highlight low-confidence items for review. Constitution III requires named prompt constant and response validation.

**System prompt instructions to Claude**:
- Act as a portfolio builder for a student career platform.
- Given CV text or website content, extract all portfolio-worthy items.
- Classify each item as PROJECT, CERTIFICATION, AWARD, PUBLICATION, or OTHER.
- Return ONLY a valid JSON array. No preamble, no markdown, no code fences.
- If no portfolio-worthy items found, return `[]`.
- `confidence` is 0.0–1.0 based on how clearly the item is described.

**Alternatives considered**:
- Single item at a time (multiple Claude calls) — slow, expensive, unnecessary. A CV contains multiple items in one document.
- Free-text response parsed with regex — fragile, non-validatable.
- XML response — JSON is native to the stack (Jackson ObjectMapper already wired).

---

## Decision 5: max_tokens for Extraction — 4096

**Decision**: `max_tokens: 4096` for extraction calls (not 256 like verification). Separate config key: `anthropic.extraction-max-tokens: 4096`.

**Rationale**: Extraction returns a JSON array that may contain 5–15 items, each with a title and description. 256 tokens (used for verification's single-object response) is far too small. 4096 matches career-service's skill-gap analysis, which has similar output volume. Separate `@Value` key so verification and extraction can be tuned independently.

---

## Decision 6: Batch Save — Single Transactional Endpoint

**Decision**: Add `POST /portfolio/items/batch` that accepts `{ "items": [{ itemType, title, description, externalUrl }] }`. Service iterates, creates `PortfolioItem` for each, saves all in a single `@Transactional` method. Returns `201 Created` with `PortfolioItemResponse[]`.

**Rationale**: Atomicity — either all items save or none do. A student confirming 5 items shouldn't end up with 3 saved and 2 failed. Spring's `@Transactional` on the service method handles this cleanly. Reuses existing `PortfolioItemRequest` validation per item (same `@NotBlank`, `@Size`, `@URL` constraints).

**Alternatives considered**:
- Frontend calls `POST /portfolio/items` N times — non-atomic; partial failures leave inconsistent state; N network round-trips.
- Async batch queue — overkill for 5–15 items; adds complexity.

---

## Decision 7: itemType Normalisation

**Decision**: After Claude returns items, the service normalises `itemType` to the allowed set: `PROJECT`, `CERTIFICATION`, `AWARD`, `PUBLICATION`, `OTHER`. Any value not in the set (including null, empty, or unexpected strings) maps to `OTHER`. Case-insensitive comparison (Claude might return "Project" or "project").

**Rationale**: Claude is non-deterministic — it might return "INTERNSHIP" or "EXPERIENCE" which aren't in the frontend's `ITEM_TYPES` list. Normalising at the service layer ensures the response is always valid without rejecting Claude's output. `OTHER` is a safe catch-all that the frontend already supports.

**Alternatives considered**:
- Reject items with unknown itemType — loses valid achievements because of a classification mismatch.
- Add more itemType values — scope creep; the existing 5 types cover the vast majority of cases.

---

## Decision 8: Fallback on Claude Failure — 503 (Not PENDING)

**Decision**: Unlike verification (feature 005, which falls back to PENDING), extraction has no meaningful fallback state. If Claude is unavailable, return `503 Service Unavailable` with `{ "status": 503, "error": "Service Unavailable", "message": "AI service unavailable. Please try again or add items manually." }`. No items are saved.

**Rationale**: Verification (005) has a valid intermediate state (PENDING — admin can review later). Extraction has no such state — there's nothing to save if Claude didn't return items. A 503 with a clear message lets the student either retry or fall back to manual entry via the existing "Add Item" modal. Constitution III requires explicit fallback behaviour — 503 with human-readable message is that behaviour.

**Alternatives considered**:
- Return 200 with empty array — misleading; student thinks extraction worked but found nothing, when really the AI was down.
- Queue for retry — overkill; no persistence layer for extraction requests.

---

## Decision 9: Confidence Score — Frontend Display Only

**Decision**: Claude returns a `confidence` field (0.0–1.0) per extracted item. The service passes it through to the frontend in `ExtractedItemResponse`. The frontend uses it to highlight low-confidence items (< 0.7) with a subtle indicator (e.g., amber dot or "Review" label). The confidence score is NOT persisted — it's dropped before batch save.

**Rationale**: Helps the student focus their review on items Claude is less sure about. A confidence of 0.5 on a vaguely-described CV entry means "double-check this one". Dropping it at save time keeps the `PortfolioItem` schema clean — confidence is an extraction-time signal, not a portfolio property.

**Alternatives considered**:
- Don't ask Claude for confidence — student has to review every item equally; less efficient.
- Persist confidence as a column — adds schema complexity for a transient signal; no clear downstream use.

---

## Decision 10: Reuse Existing Auth, Config, and Exception Patterns

**Decision**:
- Reuse `JwtAuthFilter`, `SecurityConfig`, `@AuthenticationPrincipal JwtUserDetails` — same as existing portfolio endpoints.
- Reuse `AiServiceException` (already in portfolio-service from feature 005) for Claude failures.
- Reuse `RestTemplate` bean (already wired in `RestTemplateConfig`) for both Claude calls and website fetching.
- Add `anthropic.extraction-max-tokens: 4096` to `application.yml` (alongside existing `anthropic.verification-max-tokens: 256`).
- Add `portfolio.extraction.max-html-chars: 50000` and `portfolio.extraction.url-connect-timeout-ms: 15000`, `portfolio.extraction.url-read-timeout-ms: 30000` to `application.yml`.
- No new docker-compose changes needed — `ANTHROPIC_API_KEY` already configured for portfolio-service in feature 005.

**Rationale**: Constitution V (Observability & Security Baseline) and Constitution I (Microservice Autonomy) are satisfied by reusing existing patterns. No new infrastructure, no cross-service calls, no new auth flows.

---

## Decision 11: Frontend Flow — Modal-Based Extraction Entry

**Decision**: Add a "Build with AI" button alongside the existing "+" FAB in the portfolio header. Tapping it opens a bottom-sheet modal with two options: "Upload CV" and "Paste Website Link". CV upload uses `expo-document-picker` (same as skill-gap screen). URL input is a `TextInput`. After submission, show a processing state (animated, like skill-gap's pulse). On success, navigate to a review screen (new route `(app)/portfolio-review`) showing extracted items with checkboxes, edit buttons, and an "Add N items" button. On batch save, navigate back to portfolio list.

**Rationale**: The "Build with AI" button is additive — it doesn't replace manual entry (the "+" FAB stays). The modal keeps the choice compact. A dedicated review screen (rather than a modal) gives enough space for 5–15 items with edit controls. Reusing `expo-document-picker` from the skill-gap screen means no new frontend dependencies.

**Alternatives considered**:
- Replace the "+" FAB entirely with "Build with AI" — removes manual entry; some students may prefer adding one specific item.
- Inline extraction in the portfolio list — clutters the main screen; review needs its own space.
- Tab-based flow — overkill; this is a one-time setup action, not a daily feature.
