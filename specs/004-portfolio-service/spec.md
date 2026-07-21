# Feature Spec: Portfolio Service

**Feature ID**: 004
**Branch**: `feat/portfolio-service`
**Status**: Planning

## Problem Statement

Students have no way to showcase their work to recruiters on the platform. They can identify skill gaps and see career paths, but there is no place to record their projects, certifications, and achievements — and no way to share that evidence with employers. Portfolio-service closes this gap.

## User Stories

### US1 — Manage portfolio items (P1)

**As a** student,
**I want** to add, edit, and delete items (projects, certifications, achievements) to my portfolio,
**So that** I can build a record of my work on the platform.

**Acceptance criteria:**
- Student can create an item with: `itemType` (PROJECT | CERTIFICATE | ACHIEVEMENT), `title`, optional `description`, optional `externalUrl`.
- Student can update the title, description, and URL of any of their own items.
- Student can delete any of their own items.
- Items are returned in `displayOrder` ascending, then `createdAt` descending.
- A freshly created item has `verified: false`.
- The service returns 404 if a student tries to edit or delete an item they don't own.

### US2 — View portfolio (P1)

**As a** recruiter or visitor,
**I want** to view a student's portfolio at `/portfolio/{userId}`,
**So that** I can assess the student's background.

**Acceptance criteria:**
- `GET /portfolio/{userId}` requires no authentication.
- Only items with `verified: true` are returned on public views.
- A student viewing their own portfolio via `GET /portfolio/mine` (authenticated) sees all their items including unverified ones.
- Both endpoints return items in the same display order.

### US3 — Request and review item verification (P2)

**As a** student,
**I want** to submit a portfolio item for verification,
**So that** a verified badge appears on it when recruiters view my profile.

**Acceptance criteria:**
- `POST /portfolio/items/{itemId}/verify` creates a `VerificationRequest` with `status: PENDING`.
- A student cannot submit the same item twice while a PENDING request exists (returns 409).
- An ADMIN user can call `PATCH /portfolio/verification/{requestId}` with `decision: APPROVED | REJECTED` and an optional `reviewerNote`.
- On APPROVED: the linked `portfolio_item.verified` is set to `true`.
- On REJECTED: `verified` remains `false`; the student can resubmit.
- Non-ADMIN users calling the review endpoint receive 403.

### US4 — Generate and access a shareable portfolio link (P3)

**As a** student,
**I want** to generate a shareable URL for my portfolio,
**So that** I can send it to recruiters outside the platform.

**Acceptance criteria:**
- `POST /portfolio/share` generates a unique URL-safe token and returns the full share URL.
- Calling the endpoint again returns the same active link (idempotent; one active link per user).
- `GET /portfolio/share/{token}` requires no auth and returns all verified items.
- If the token does not exist or is inactive, returns 404.

### US5 — Frontend portfolio screen (P3)

**As a** student using the mobile app,
**I want** a Portfolio tab where I can see and manage my portfolio items,
**So that** I can view my profile as a recruiter would and add new items.

**Acceptance criteria:**
- A Portfolio tab exists in the app (6th tab, between Roadmap and Profile: Home → Skills → Careers → Roadmap → Portfolio → Profile).
- The screen shows the student's own items (including unverified) with a verified badge on approved items.
- A FAB or button opens an add-item sheet (itemType selector, title, description, externalUrl).
- Student can delete an item from the list (confirmation dialog, same pattern as delete-analysis).
- A "Request Verification" button appears on unverified items.
- A "Share Portfolio" button generates and copies/shows the share URL.

## Out of Scope (v1)

- File attachments — items use `externalUrl` only (GitHub, certificate PDF links, etc.)
- Admin dashboard UI — admin uses the API directly; no mobile admin screen
- Push notification on verification decision — notification-service not yet built
- Portfolio analytics (views, recruiter clicks)

## Success Criteria

1. `POST /portfolio/items` → 201 with the new item.
2. `GET /portfolio/{userId}` → 200, only verified items visible without auth.
3. `GET /portfolio/mine` → 200, all items visible to owner.
4. `POST /portfolio/items/{itemId}/verify` → 201 VerificationRequest (PENDING).
5. `PATCH /portfolio/verification/{requestId}` APPROVED → item `verified: true`, non-admin → 403.
6. `POST /portfolio/share` → 200 with share URL (idempotent).
7. `GET /portfolio/share/{token}` → 200 public view, no auth.
8. All tests pass, JaCoCo ≥ 70%.
9. Portfolio tab renders in the mobile app with list, add, delete, verify, and share actions.
