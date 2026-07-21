# Feature Specification: AI-Powered Portfolio Verification

**Feature Branch**: `005-ai-powered-portfolio-verification`

**Created**: 2026-06-28

**Status**: Draft

**Input**: Replace manual admin review with Claude AI auto-verification when student requests portfolio item verification.

## User Scenarios & Testing

### User Story 1 — Auto-Verify on Request (Priority: P1)

A student requests verification of a portfolio item. Instead of waiting for a human admin, Claude AI immediately reviews the item (title, description, itemType, externalUrl) and returns an APPROVED or REJECTED decision with a reason. The verification request is resolved in the same HTTP call.

**Why this priority**: Removes the admin account dependency entirely. Delivers instant value — students know immediately whether their item is credible enough to display as verified.

**Independent Test**: `POST /portfolio/items/{id}/verify` → 200 with `status: APPROVED` or `REJECTED` and a `reviewerNote` from Claude. Item's `verified` flag becomes `true` on APPROVED. `verificationStatus` in `GET /portfolio/mine` updates accordingly.

**Acceptance Scenarios**:

1. **Given** a student has a portfolio item with a clear title, description, and GitHub URL, **When** they POST to `/portfolio/items/{id}/verify`, **Then** Claude reviews it and responds with `APPROVED`, the item's `verified=true`, and `reviewerNote` contains Claude's reasoning.
2. **Given** a portfolio item with a vague title ("My project"), no description, no URL, **When** the student requests verification, **Then** Claude returns `REJECTED` with a `reviewerNote` explaining what's missing.
3. **Given** a student has already verified an item, **When** they request verification again, **Then** 409 Conflict (same as before — already resolved).

---

### User Story 2 — Graceful AI Fallback (Priority: P2)

When the Claude API is unavailable (network error, 5xx, timeout), the system degrades gracefully. The verification request is saved as `PENDING` and the student receives a clear message that review is queued.

**Why this priority**: AI downtime must not break the student experience. A stuck PENDING item is better than a 500 error. Manual admin override remains available as a safety net.

**Independent Test**: With Claude API mocked to return an error, `POST /portfolio/items/{id}/verify` → 200 with `status: PENDING` and `reviewerNote: "Automated review unavailable — your item has been queued for manual review."` No 500 returned to client.

**Acceptance Scenarios**:

1. **Given** the Claude API is down, **When** a student requests verification, **Then** the request is saved as PENDING and the response includes a human-readable fallback note.
2. **Given** an item is PENDING due to fallback, **When** an admin calls `PATCH /portfolio/verification/{id}`, **Then** the item can be manually reviewed (override flow).

---

### User Story 3 — Admin Manual Override (Priority: P3)

Admins retain the ability to manually override any verification decision — approving a Claude-rejected item or rejecting a Claude-approved one. The `PATCH /portfolio/verification/{id}` endpoint stays but is now an override path, not the primary flow.

**Why this priority**: Safety net for edge cases. Low usage expected once AI is live but critical for trust in the system.

**Independent Test**: Admin calls `PATCH /portfolio/verification/{id}` with `decision: APPROVED` on a REJECTED item → 200 with updated status and `reviewSource: HUMAN`.

**Acceptance Scenarios**:

1. **Given** Claude rejected an item, **When** an admin overrides with APPROVED, **Then** `verified=true`, `reviewSource=HUMAN`, and `reviewerNote` reflects admin's note.
2. **Given** a non-admin calls PATCH, **Then** 403 Forbidden (unchanged).

---

### Edge Cases

- What happens when `externalUrl` is null? Claude reviews title + description only.
- What if Claude returns malformed JSON? Treat as AI failure → PENDING fallback.
- What if the item is already APPROVED and student requests again? 409 Conflict.
- What if `description` is very long (>5000 chars)? Truncate to 2000 chars before sending to Claude.

## Requirements

### Functional Requirements

- **FR-001**: System MUST call Claude API synchronously on `POST /portfolio/items/{id}/verify` and return the AI decision (APPROVED/REJECTED) in the same response.
- **FR-002**: Claude prompt MUST be defined as a named constant (`PORTFOLIO_VERIFICATION_V1`), never inline.
- **FR-003**: System MUST validate Claude's JSON response for `decision` and `reason` fields before applying the decision.
- **FR-004**: System MUST fall back to PENDING status with a human-readable note when the Claude API is unavailable.
- **FR-005**: System MUST log the prompt template name and Claude response latency at INFO level on every call.
- **FR-006**: `VerificationRequest` MUST record whether the decision was made by AI or a human (`reviewSource: AI | HUMAN`).
- **FR-007**: `PATCH /portfolio/verification/{id}` MUST remain operational for admin manual override.
- **FR-008**: Claude input MUST truncate `description` to 2000 characters to prevent token overflow.
- **FR-009**: `ANTHROPIC_API_KEY` MUST be injected via environment variable; never hardcoded.
- **FR-010**: Portfolio-service MUST add `ANTHROPIC_API_KEY` to docker-compose.yml environment block.

### Key Entities

- **VerificationRequest**: Gains `reviewSource VARCHAR(20)` column (`AI` or `HUMAN`). All existing fields unchanged.
- **ClaudeVerificationResponse** (internal record): `{ decision: "APPROVED"|"REJECTED", reason: String }` — parsed from Claude's JSON output.

## Success Criteria

### Measurable Outcomes

- **SC-001**: `POST /portfolio/items/{id}/verify` responds with APPROVED or REJECTED (not PENDING) in ≥95% of calls when Claude API is healthy.
- **SC-002**: When Claude API is mocked to fail, endpoint returns 200 with `status: PENDING` (no 5xx).
- **SC-003**: Claude prompt name `PORTFOLIO_VERIFICATION_V1` appears in INFO logs on every verification call.
- **SC-004**: Unit tests for `ClaudeVerificationService` cover happy path, malformed JSON, and HTTP error → all green.
- **SC-005**: JaCoCo line coverage remains ≥70% after changes.

## Assumptions

- Portfolio-service already exists and is fully functional (feature 004 complete).
- `RestTemplate` and `RestTemplateConfig` already present in portfolio-service — reuse for Claude calls.
- Claude model: `claude-sonnet-4-6` (same as other services).
- Synchronous verification (Option A) chosen — no async queue needed.
- `PATCH /portfolio/verification/{id}` endpoint kept for manual override; admin account provisioning remains a separate concern.
- Claude API base URL: same pattern as career-service (`https://api.anthropic.com/v1/messages`).
- `externalUrl` is optional — Claude reviews whatever fields are present.
