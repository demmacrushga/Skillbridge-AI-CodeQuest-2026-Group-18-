# Research: AI-Powered Portfolio Verification

## Decision 1: Synchronous vs Async AI Review

**Decision**: Synchronous — call Claude in the `POST /items/{id}/verify` request, return result immediately.

**Rationale**: Async (queue + polling) adds complexity (scheduler, status polling endpoint) not justified for a solo-builder at this stage. Synchronous Claude calls complete in 2–8s, acceptable for a verification action (not a hot path). The career-service already uses synchronous Claude calls (120s read timeout configured). Students get an immediate answer.

**Alternatives considered**:
- Async queue (Spring `@Async` or Kafka) — overkill; requires polling or websocket.
- Webhook callback — requires client-side infrastructure.

---

## Decision 2: Claude Prompt Structure

**Decision**: Single JSON-object response — Claude returns `{ "decision": "APPROVED" | "REJECTED", "reason": "..." }`.

**Rationale**: Simpler to validate than an array. `decision` is an enum-like field (easy to assert). `reason` is free text stored in `reviewer_note`. Constitution III requires named prompt constant: `PORTFOLIO_VERIFICATION_V1`.

**Prompt inputs** sent to Claude:
```
Item type: {itemType}
Title: {title}
Description: {description truncated to 2000 chars}
External URL: {externalUrl or "none"}
```

**System prompt** instructs Claude to act as a portfolio reviewer — assess whether the item is real, specific, and demonstrable. Return ONLY valid JSON: `{ "decision": "APPROVED"|"REJECTED", "reason": "..." }`.

**Alternatives considered**:
- Free-text response parsed with regex — fragile.
- Array response — unnecessary for single-item review.

---

## Decision 3: Fallback on Claude API Failure

**Decision**: On any `RestClientException` or JSON parse failure → save VerificationRequest as `PENDING`, `reviewerNote = "Automated review unavailable — your item has been queued for manual review."`, return 200 (not 5xx) to client.

**Rationale**: Constitution III requires explicit fallback. Returning 5xx on AI failure breaks the student flow. PENDING is a valid terminal-enough state — admin override (`PATCH`) remains available. Consistent with skill-gap-service pattern where AI failure triggers a status update rather than an error propagation.

**Alternatives considered**:
- Return 503 to client — breaks frontend flow, poor UX.
- Retry with exponential backoff — adds latency; better handled at infrastructure level (API gateway retries).

---

## Decision 4: review_source Column

**Decision**: Add `review_source VARCHAR(20) DEFAULT 'AI'` to `verification_requests` table (Flyway V5).

**Rationale**: Distinguishes AI-automated decisions from human admin overrides. Needed for auditability. `AI` = Claude reviewed, `HUMAN` = admin used PATCH override, `PENDING` = fallback (Claude unavailable). Does not break existing data (DEFAULT value handles existing rows).

**Alternatives considered**:
- Use `reviewed_by IS NULL` to infer AI — loses distinction between "AI reviewed" and "not yet reviewed".
- Boolean `ai_reviewed` — less descriptive than a source enum string.

---

## Decision 5: Reuse RestTemplate Pattern

**Decision**: Copy `ClaudeService` pattern from `career-service` — same `RestTemplate` bean, same headers (`x-api-key`, `anthropic-version`), same JSON extraction path (`content[0].text`). Add `anthropic.*` config block to `application.yml`, add `ANTHROPIC_API_KEY` to portfolio-service docker-compose environment.

**Rationale**: No new dependencies needed — `RestTemplate` and `ObjectMapper` already wired. Pattern is proven and constitution-compliant (prompt constant, validation, fallback, latency logging). Avoids introducing a new HTTP client library.

**Alternatives considered**:
- Anthropic Java SDK — not used by existing services, adds a dependency.
- WebClient (reactive) — unnecessary; service is not reactive.

---

## Decision 6: Keep PATCH Override Endpoint

**Decision**: Retain `PATCH /portfolio/verification/{id}` for admin manual override. Set `reviewSource = HUMAN` on manual decisions. Admin can override both PENDING and AI-decided items.

**Rationale**: Safety net. US3 value without additional complexity — just set `reviewSource` field in the existing handler. Removing it would leave no correction path when Claude makes an error.

**Alternatives considered**:
- Remove PATCH entirely — loses correction capability.
- New dedicated `POST /verification/{id}/override` — unnecessary; PATCH semantics already correct.

---

## Decision 7: Max Tokens for Verification

**Decision**: `max_tokens: 256` for verification Claude calls (not 4096 like career-service).

**Rationale**: Response is a tiny JSON object. 256 tokens is more than enough for `{ "decision": "...", "reason": "..." }`. Reduces API cost and latency. Separate `@Value` config key: `anthropic.verification-max-tokens: 256`.

---

## Decision 8: Input Truncation

**Decision**: Truncate `description` to 2000 characters before sending to Claude. Log a WARN if truncation occurs.

**Rationale**: Prevents accidental prompt injection or token overflow. Portfolio descriptions are student-authored free text — length is unbounded. 2000 chars is enough for meaningful review.
