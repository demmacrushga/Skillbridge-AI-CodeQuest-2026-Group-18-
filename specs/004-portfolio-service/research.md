# Research: Portfolio Service

## Decision 1 — Verification scope for v1

**Decision**: Include the admin verification endpoint but keep it API-only (no admin UI). Admin approves/rejects via `PATCH /portfolio/verification/{requestId}`.
**Rationale**: The endpoint is simple (one PATCH call), directly documented in `docs/api.md`, and having it in v1 means students can start requesting verification as soon as the service ships. Admin can use curl, Postman, or DbGate to review. A full admin UI is deferred to a later feature.
**Alternatives considered**: (1) Skip verification entirely — rejected, feature is in the spec and students need the verified badge to be credible to recruiters. (2) Auto-verify via URL check — rejected, too many false positives (a GitHub link could be any repo, not necessarily the student's own work).

## Decision 2 — File attachments

**Decision**: `externalUrl` only for v1; no file upload/storage.
**Rationale**: File upload adds S3 / local disk complexity that is not needed for the student's primary use case (linking to GitHub, LinkedIn, Coursera certificates). This keeps the service scope identical to the other services — no disk IO, no multipart handling.
**Alternatives considered**: Reuse skill-gap-service's in-memory file parsing pattern — rejected, portfolio attachments need persistent storage, not just text extraction. Deferred to v2.

## Decision 3 — Share token generation

**Decision**: `SecureRandom` with `Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)` on 32 random bytes → 43-character URL-safe token. Stored in `portfolio_links.share_token` (VARCHAR(64), UNIQUE).
**Rationale**: No external dependency; Java stdlib is sufficient. 32 bytes = 256 bits of entropy — sufficient for a public share link. URL-safe Base64 avoids percent-encoding in the URL.
**Alternatives considered**: UUID — rejected (too guessable for a public-facing token; 122-bit entropy vs 256-bit). NanoID — rejected (extra dependency for no benefit).

## Decision 4 — Share link idempotency

**Decision**: `POST /portfolio/share` is idempotent — if the user already has an active `portfolio_links` row, return the existing token. A student always has at most one active share link.
**Rationale**: Calling "Share Portfolio" twice should not produce two different URLs. The student expects one stable link they can paste anywhere.
**Alternatives considered**: Allow multiple links (revocable per-link) — deferred to v2; YAGNI for a solo-built MVP.

## Decision 5 — Duplicate verification request guard

**Decision**: Before creating a `VerificationRequest`, check if a PENDING request already exists for that `portfolioItemId`. If yes, return 409 Conflict.
**Rationale**: Without this guard, repeated taps on "Request Verification" in the app create duplicate rows, cluttering the admin review queue.
**Implementation**: `verificationRequestRepository.existsByPortfolioItemIdAndStatus(itemId, "PENDING")`.

## Decision 6 — Admin role enforcement

**Decision**: Check `principal.role().equals("ADMIN")` in the service method for the review endpoint, throw `AccessDeniedException` on failure (maps to 403 in `GlobalExceptionHandler`).
**Rationale**: The existing services do not use `@PreAuthorize` annotations; keeping the pattern consistent avoids introducing Spring Security method-security config. A service-level check is equally safe and fits the established codebase style.
**Alternatives considered**: `@PreAuthorize("hasRole('ADMIN')")` on the controller method — deferred; requires enabling method security in `SecurityConfig`, which is a cross-cutting change that should be made deliberately across all services.

## Decision 7 — No caching

**Decision**: No `@Cacheable` / Caffeine in portfolio-service.
**Rationale**: Portfolio items are user-specific and change frequently (add/edit/delete/verify). A cache would need invalidation on every write, adding complexity for marginal gain. Career-service caches Claude AI results (expensive + stable). Portfolio reads are cheap DB queries.

## Decision 8 — Frontend tab placement

**Decision**: Add Portfolio as a 6th tab between Roadmap and Profile: **Home → Skills → Careers → Roadmap → Portfolio → Profile**.
**Rationale**: Portfolio is a higher-frequency action than Profile (students actively build it vs. rarely touching settings). Keeping Profile last is established UX convention. Six tabs is within the acceptable range for mobile bottom nav (iOS HIG recommends max 5, but Android Material allows more; most career/professional apps use 5-6).
**Alternatives considered**: Embed portfolio inside Profile screen — rejected, portfolio is a core student deliverable, not a settings concern. It deserves a top-level navigation entry.

## Decision 9 — `item_type` stored as VARCHAR, not DB enum

**Decision**: `item_type` and `status` columns are `VARCHAR(20)`, not PostgreSQL `ENUM` types.
**Rationale**: Consistent with `cv_uploads.status` in skill-gap-service. VARCHAR avoids Flyway migration complexity when adding new item types in the future. Java-side validation (Bean Validation `@Pattern` or `@NotNull` + enum mapping) catches invalid values before they hit the DB.

## Decision 10 — `display_order` default and management

**Decision**: `display_order` defaults to `0` for all new items in v1. Reordering is out of scope.
**Rationale**: The DB column exists for future drag-to-reorder functionality. For v1, items are returned sorted by `(displayOrder ASC, createdAt DESC)`, which with all orders at 0 effectively sorts newest-first.
