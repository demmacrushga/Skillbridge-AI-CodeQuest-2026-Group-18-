# Architecture Decision Records

This document captures every significant technical and product decision made during the design and implementation of SkillBridge AI. Decisions are grouped by feature and ordered chronologically.

Each record follows the format:

> **Decision**: what was chosen  
> **Rationale**: why  
> **Alternatives rejected**: what else was considered and why it lost

---

## Constitution & Project-Level Decisions

### ADR-000 — Solo-builder architecture

**Decision**: All 9 microservices are built and maintained by a single developer.

**Rationale**: University project constraint. Microservice boundaries are respected even in a solo context to reflect real-world practice and keep each service independently understandable.

**Impact**: Simplicity and clear boundaries between services are prioritised over team-level tooling (no service-to-service generated clients, no service mesh). Avoid over-engineering any single service.

---

### ADR-001 — PostgreSQL schema-per-service

**Decision**: Each service owns an isolated PostgreSQL schema (e.g., `auth`, `career`, `skill_gap`, `portfolio`). Cross-schema queries are forbidden.

**Rationale**: Schema isolation is the minimum viable database independence for a shared-host deployment. Full separate databases would require separate connection pools and more complex local setup for a solo developer. Schema isolation still guarantees services cannot accidentally read each other's tables.

**Alternatives rejected**: Shared schema with table-name prefixes — rejected because there is no enforcement mechanism and prefix conventions erode over time.

---

### ADR-002 — JWT validated locally per service

**Decision**: Each service validates JWT tokens independently using the shared secret. No service calls auth-service to validate a token.

**Rationale**: Synchronous token validation would make auth-service a single point of failure on every request. JWT is designed for stateless validation. The shared secret is injected via environment variable; `JwtService` is copied and repackaged into each service.

**Alternatives rejected**: Token introspection endpoint on auth-service — adds latency and a hard runtime dependency between every service and auth-service.

---

### ADR-003 — Named prompt constants for all Claude calls

**Decision**: Every Anthropic Claude API call across every service defines the prompt as a `private static final String PROMPT_NAME = "..."` constant, never as an inline string. Constitution Principle III.

**Rationale**: AI responses are non-deterministic. Named, versioned constants make it possible to trace exactly which prompt produced a given output in logs. The `PROMPT_NAME` is logged alongside response latency on every call.

**Prompt names in use**:
- `CAREER_ROADMAP_V1` — career-service roadmap generation
- `SKILL_GAP_ANALYSIS_V1` — skill-gap-service CV analysis
- `PORTFOLIO_VERIFICATION_V1` — portfolio-service AI item verification

---

### ADR-004 — RestTemplate over WebClient for Claude integration

**Decision**: All Claude API calls use Spring's `RestTemplate` (not reactive `WebClient`).

**Rationale**: Services are blocking (not reactive). `RestTemplate` is simpler, well-understood, and already wired through `RestTemplateConfig`. Timeouts are set via `RestTemplateBuilder`: `connectTimeout: 15s`, `readTimeout: 120s`.

**Alternatives rejected**: Anthropic Java SDK — not used by existing services, adds a dependency; WebClient — unnecessary without a reactive stack.

---

### ADR-005 — Fallback behaviour on Claude API failure

**Decision**: On any `RestClientException` or JSON parse failure, every service catches the `AiServiceException` and falls back gracefully without propagating 5xx to the client.

**Rationale**: Constitution Principle III requires explicit fallback. A 5xx from an AI call breaks the student's flow for a non-critical path. Each service defines what "graceful" means in context:
- career-service: return cached roadmap or a structured error message
- skill-gap-service: mark CV upload as `FAILED`, rethrow `AiServiceException` → 503
- portfolio-service: save VerificationRequest as `PENDING` with `reviewSource = PENDING_FALLBACK`, return 200

---

## Feature 001 — skill-gap-service

### ADR-006 — In-memory CV text extraction (no file storage)

**Decision**: Extract plain text from uploaded PDF/DOCX in memory using Apache PDFBox 3.0.3 and Apache POI 5.3.0. Do not persist the file bytes; discard them after extraction.

**Rationale**: File storage (S3, local disk volume) adds infrastructure complexity with no student-facing value. The only information needed from the CV is its plain text for the Claude prompt. Extracting in-memory keeps the service stateless and containerisable without a volume.

**Alternatives rejected**: Store file on disk / S3 and re-parse on demand — rejected; the raw file is not needed after analysis. Storing extracted text only (no file) is sufficient.

---

### ADR-007 — CV status as VARCHAR (not DB enum)

**Decision**: `cv_uploads.status` is `VARCHAR(20)`, not a PostgreSQL `ENUM` type. Values: `PROCESSING`, `COMPLETED`, `FAILED`.

**Rationale**: VARCHAR avoids Flyway migration complexity when adding new statuses (e.g., an async `QUEUED` state in a future version). Java-side validation catches invalid values.

**Alternatives rejected**: PostgreSQL `ENUM` — requires an `ALTER TYPE` migration to add values, which is a DDL-level change that can fail without a table lock on large deployments.

---

### ADR-008 — JOIN FETCH to avoid N+1 on report list

**Decision**: `findByUserIdWithGaps` on `GapReportRepository` uses `LEFT JOIN FETCH` to load all `SkillGap` entities (and their `ResourceRecommendation` children) in a single SQL query.

**Rationale**: Without `JOIN FETCH`, Hibernate issues one SELECT per gap row (N+1 problem). Gap reports with 5–8 gaps would trigger 5–8 extra queries per report, and a list of 10 reports could produce 80+ queries. `JOIN FETCH` collapses this to one query.

---

### ADR-009 — `findByIdAndUserId` pattern for ownership

**Decision**: All single-resource lookups use `findByIdAndUserId(id, userId)`. If empty, throw a 404 (`ReportNotFoundException`). Never separately fetch and check ownership.

**Rationale**: A 404 for both "not found" and "wrong user" prevents information disclosure — a student cannot determine whether a report ID exists for another student. Combining the ID and userId constraint in the query is idiomatic and requires no extra code.

**Alternatives rejected**: Fetch by ID, then check `userId == principal.userId()` in service → return 403 — rejected because 403 leaks the existence of the resource.

---

### ADR-010 — 5MB file size limit, PDF/DOCX only

**Decision**: Maximum CV size is 5MB. Accepted MIME types: `application/pdf` and `application/vnd.openxmlformats-officedocument.wordprocessingml.document`. Nginx is configured with `client_max_body_size 6M` (buffer for multipart overhead).

**Rationale**: 5MB is well above the practical size of any CV. Limiting accepted types prevents binary files being fed to the text extractor.

---

## Feature 002 — Skill Gap Frontend

### ADR-011 — expo-document-picker for file selection

**Decision**: Use `expo-document-picker` v13 for CV selection on the mobile frontend.

**Rationale**: Native integration with iOS Files and Android Storage Access Framework. Managed Expo SDK compatible. Returns `{ uri, name, mimeType, size }` directly.

**Alternatives rejected**: `react-native-document-picker` — requires bare workflow; `expo-image-picker` — images and videos only.

---

### ADR-012 — Do not set Content-Type header on multipart upload

**Decision**: When using `fetch` with `FormData` in React Native, the `Content-Type: multipart/form-data` header is intentionally omitted.

**Rationale**: React Native's `fetch` implementation sets the multipart boundary automatically when a `FormData` body is used. Manually setting `Content-Type` without the correct boundary breaks the request.

---

### ADR-013 — Pulse animation for long Claude requests (15–30 s)

**Decision**: Show a pulsing "Analysing your CV…" state using `Animated.loop` during the Claude API call. The loading state replaces the upload form entirely.

**Rationale**: Claude CV analysis takes 15–30 seconds. A loading overlay is insufficient UX — it still shows the form beneath, risking accidental re-submission. Replacing the form with the loading state eliminates re-submission risk and reuses the `usePulse` pattern already in `roadmap.tsx` and `index.tsx`.

---

### ADR-014 — Nested Stack inside Skills tab for report detail

**Decision**: Gap report detail lives in `app/(app)/gap-report/[reportId].tsx` with a nested Stack layout, accessed via `router.push('/gap-report/${reportId}')`.

**Rationale**: Expo Router v6 supports nested layouts. A Stack inside the Skills tab allows the detail screen to push on top while keeping the tab bar visible. A shared root-level Stack would complicate the existing tab layout.

---

### ADR-015 — useFocusEffect for list refresh

**Decision**: The Skills tab list screen uses `useFocusEffect` (not `useEffect`) to reload reports when the tab regains focus.

**Rationale**: Expo Router v3 persists tab screens — they are never unmounted when navigating away. `useEffect` does not re-run on re-focus. `useFocusEffect` fires every time the screen becomes active, ensuring the list reflects deletions performed from the detail screen.

---

## Feature 003 — Delete Analysis

### ADR-016 — Optimistic deletion on list, pessimistic on detail

**Decision**: Deleting from the list screen (US1) uses optimistic UI — remove the item immediately, restore on API failure. Deleting from the detail screen (US2) waits for API success before navigating.

**Rationale**: US1 optimistic removal gives instant feedback with a recoverable failure path. US2 cannot be optimistic because navigating before API success would leave the user on the list screen with no way to see the error — they would have to navigate back into a deleted report. Staying on the detail screen until success is the natural error recovery path.

---

### ADR-017 — JPA cascade for child row cleanup

**Decision**: `GapReport → SkillGap → ResourceRecommendation` uses `CascadeType.ALL + orphanRemoval = true`. Deleting a `GapReport` cascades to all child rows automatically. `CvUpload` is deleted explicitly after the `GapReport` delete (no cascade from child → parent).

**Rationale**: JPA `CascadeType` does not support upward cascade from `@ManyToOne`. The `CvUpload` record is metadata-only (no file bytes stored); leaving orphaned rows is wasteful. Explicit delete is two lines of code.

**Alternatives rejected**: Manual `DELETE FROM` SQL queries — more code, same result; adding cascade to `@ManyToOne` — not a JPA-supported direction.

---

### ADR-018 — No new Flyway migration for delete feature

**Decision**: Feature 003 required no database schema changes.

**Rationale**: The delete operation relies solely on JPA cascade relationships already established in Feature 001. No columns, tables, or constraints changed. The existing `V5__drop_storage_path.sql` remained the schema head.

---

## Feature 004 — portfolio-service

### ADR-019 — externalUrl only; no file attachments in v1

**Decision**: Portfolio items reference work via `external_url` (VARCHAR 500). No file upload or storage for portfolio attachments.

**Rationale**: File upload adds persistent storage complexity (S3 or named Docker volume) not needed for the primary use case: linking to GitHub, LinkedIn, Coursera certificates. The skill-gap-service already demonstrates in-memory file processing; portfolio needs storage, not just extraction, which is a v2 scope item.

---

### ADR-020 — Verification request deduplication guard

**Decision**: Before creating a `VerificationRequest`, check `existsByPortfolioItemIdAndStatus(itemId, "PENDING")`. If true, return 409 Conflict.

**Rationale**: Without this guard, repeated taps on "Request Verification" in the mobile app create duplicate rows, cluttering the review queue. The guard is a single repository method call — no extra query overhead.

---

### ADR-021 — Share token: SecureRandom + Base64 (43 chars)

**Decision**: Share tokens are generated as `Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)` on 32 `SecureRandom` bytes → 43-character URL-safe token. Stored in `portfolio_links.share_token` (VARCHAR 64, UNIQUE).

**Rationale**: 32 bytes = 256 bits of entropy — sufficient for a public-facing link. URL-safe Base64 avoids percent-encoding. No external dependency; Java stdlib is sufficient.

**Alternatives rejected**: UUID (122-bit entropy, too guessable for a public token); NanoID (extra dependency for no benefit).

---

### ADR-022 — `POST /share` is idempotent

**Decision**: A student always has at most one active share link. Calling `POST /portfolio/share` twice returns the same token.

**Rationale**: The student expects one stable link they can paste anywhere. Two different URLs for the same portfolio would confuse them. Idempotency is implemented by checking for an existing `portfolio_links` row before creating.

**Alternatives rejected**: Allow multiple revocable links — deferred to v2 (YAGNI).

---

### ADR-023 — item_type stored as VARCHAR, not DB enum

**Decision**: `portfolio_items.item_type` and `verification_requests.status` are `VARCHAR(20)`.

**Rationale**: Consistent with `cv_uploads.status` pattern from skill-gap-service. VARCHAR avoids `ALTER TYPE` migrations when new item types are added.

---

### ADR-024 — display_order defaults to 0; reordering deferred

**Decision**: All new portfolio items have `display_order = 0`. Items are returned sorted `(display_order ASC, created_at DESC)`.

**Rationale**: The column exists for future drag-to-reorder functionality. With all orders at 0, the effective sort is newest-first. No reorder UI is implemented in v1 (YAGNI).

---

### ADR-025 — Portfolio as a top-level tab (position 5 of 6)

**Decision**: Portfolio is added as a dedicated tab between Roadmap and Profile: Home → Skills → Careers → Roadmap → **Portfolio** → Profile.

**Rationale**: Portfolio is a core student deliverable — they actively build and share it. It deserves top-level navigation, not a nested settings screen. Profile last is standard mobile UX convention.

**Alternatives rejected**: Embed portfolio inside Profile — rejected (portfolio is not a settings concern).

---

### ADR-026 — Service-level role check, not @PreAuthorize

**Decision**: Admin-only endpoints check `principal.role().equals("ADMIN")` in the service method and throw `AccessDeniedException` (→ 403). Spring Security method-level `@PreAuthorize` is not used.

**Rationale**: Existing services don't use `@PreAuthorize`. Keeping the pattern consistent avoids introducing method-security configuration across all services as a cross-cutting change.

---

## Feature 005 — AI-Powered Portfolio Verification

### ADR-027 — Synchronous AI verification on `POST /verify`

**Decision**: Claude is called synchronously within the `POST /items/{id}/verify` request. The response is returned immediately (APPROVED, REJECTED, or PENDING fallback). The endpoint returns **200** (not 201).

**Rationale**: Async verification (queue + polling) requires a scheduler, a status polling endpoint, and frontend polling logic — unjustified complexity for a solo-builder. Synchronous calls complete in 2–8 seconds, acceptable for a user-initiated verification action. Students get an immediate verdict. 200 (not 201) is returned because the primary outcome is the AI decision, not just resource creation.

**Alternatives rejected**: Spring `@Async` with polling endpoint — adds complexity; WebSocket push — requires infrastructure; 201 response — semantically incorrect when the primary value is the decision, not the request record.

---

### ADR-028 — Claude prompt returns `{ "decision": "...", "reason": "..." }`

**Decision**: `PORTFOLIO_VERIFICATION_V1` system prompt instructs Claude to return only valid JSON: `{ "decision": "APPROVED" | "REJECTED", "reason": "..." }`. No preamble, no markdown. `reason` is stored in `reviewer_note`.

**Input sent to Claude**:
```
Item type: {itemType}
Title: {title}
Description: {description truncated to 2000 chars}
External URL: {externalUrl or "none"}
```

**Rationale**: Single-object JSON is simpler to validate than an array. `decision` is enum-like (easy to assert). Truncation to 2000 characters prevents accidental prompt injection and token overflow from long student-authored descriptions.

**Alternatives rejected**: Free-text response parsed with regex — fragile; array response — unnecessary for single-item review.

---

### ADR-029 — review_source column to distinguish AI vs human decisions

**Decision**: Added `review_source VARCHAR(20) NOT NULL DEFAULT 'AI'` to `verification_requests` via Flyway V5.

**Values**:
- `AI` — decision made by Claude (`PORTFOLIO_VERIFICATION_V1`)
- `HUMAN` — decision made by admin via `PATCH /verification/{id}`
- `PENDING_FALLBACK` — Claude was unavailable; item queued for manual review

**Rationale**: Auditability. Without this column, there is no way to distinguish "Claude approved this" from "admin approved this." The DEFAULT value handles existing rows without a data migration.

**Alternatives rejected**: Use `reviewed_by IS NULL` to infer AI — loses distinction between AI-reviewed and not-yet-reviewed; boolean `ai_reviewed` — less descriptive.

---

### ADR-030 — Fallback to PENDING on Claude failure; never return 5xx

**Decision**: On `AiServiceException`, save the `VerificationRequest` as `status = PENDING`, `reviewSource = PENDING_FALLBACK`. Return HTTP 200. Admin override (`PATCH`) remains available.

**Rationale**: Constitution Principle III requires explicit fallback. Returning 5xx on Claude failure breaks the student flow. PENDING is a valid state — the admin can still manually review. Consistent with the decision that AI failures should degrade gracefully rather than surface errors to students.

---

### ADR-031 — max_tokens: 256 for verification (vs 4096 for roadmap)

**Decision**: `anthropic.verification-max-tokens: 256` (configured separately from other Claude calls).

**Rationale**: The verification response is a tiny JSON object (`~50 tokens`). 256 is generous headroom. Using 4096 for all calls would waste API budget and marginally increase latency.

---

### ADR-032 — Retain PATCH admin override endpoint

**Decision**: `PATCH /portfolio/verification/{id}` is retained for admin manual corrections. It now stamps `reviewSource = HUMAN`.

**Rationale**: Safety net for Claude errors. An admin can override any AI decision — APPROVED, REJECTED, or PENDING fallback. Removing it would leave no correction path.

---

## Cross-Cutting Decisions

### ADR-033 — No caching on portfolio or skill-gap reads

**Decision**: No `@Cacheable` / Caffeine on portfolio-service. Skill-gap-service has no caching either.

**Rationale**: Portfolio items are user-specific and change frequently (CRUD + verify). A cache would need invalidation on every write. Career-service caches roadmaps because they are expensive (Claude-generated) and stable (same career path + level produces the same output). Portfolio reads are cheap DB queries; caching adds complexity for no gain.

---

### ADR-034 — Flyway `baseline-on-migrate` on all services

**Decision**: All services set `spring.flyway.baseline-on-migrate: true`.

**Rationale**: Allows Flyway to initialise correctly when the schema already exists (e.g., running against a PostgreSQL instance that was seeded manually during development). Prevents "missing baseline" failures on first startup.

---

### ADR-035 — @WebMvcTest + @AutoConfigureMockMvc(addFilters = false) for controller tests

**Decision**: All controller slice tests use `@WebMvcTest(XController.class)` + `@AutoConfigureMockMvc(addFilters = false)` + `@MockBean JwtService jwtService`. Authentication is set up with `SecurityContextHolder` in `@BeforeEach` and cleared in `@AfterEach`.

**Rationale**: Using `excludeAutoConfiguration = {SecurityAutoConfiguration.class, ...}` still scans `SecurityConfig`, which wires `JwtAuthFilter`, which requires `JwtService` as a bean — causing `APPLICATION FAILED TO START`. The `addFilters = false` approach disables the filter chain entirely, while `@MockBean JwtService` satisfies the security config's dependency graph.

---

### ADR-036 — doThrow pattern for void mock methods

**Decision**: When mocking void-return service methods in tests, always use `doThrow(...).when(mock).method()` — never `when(mock.method()).thenThrow(...)`.

**Rationale**: `when(mock.method())` requires evaluating the method call expression to pass to Mockito. For `void` methods, this is a compile error ("'void' type not allowed here"). `doThrow` sets up the stub before the mock call, bypassing this constraint.
