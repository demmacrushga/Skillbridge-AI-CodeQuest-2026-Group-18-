<!--
SYNC IMPACT REPORT
==================
Version change: [unpopulated template] → 1.0.0
Modified principles: n/a (first population from blank template)
Added sections:
  - Core Principles (5 principles)
  - Technology Constraints
  - Development Workflow
  - Governance
Removed sections: none
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ no changes required (Constitution Check section already generic)
  - .specify/templates/spec-template.md ✅ no changes required (requirements/success criteria format compatible)
  - .specify/templates/tasks-template.md ✅ no changes required (phase structure compatible)
Follow-up TODOs: none — all placeholders resolved
-->

# SkillBridge AI Constitution

## Core Principles

### I. Microservice Autonomy

Each backend service (auth-service, career-service, and all future services) MUST be independently
deployable with its own isolated PostgreSQL schema. No service may read from or write directly to
another service's database tables. All cross-service communication MUST go through documented REST
API contracts.

**Rationale**: Autonomous services allow independent scaling, failure isolation, and incremental
delivery. Shared DB access creates hidden coupling that breaks deployment independence.

### II. Mobile-First API Contract

Every REST endpoint MUST return structured JSON conforming to the API contracts documented in
`docs/api.md`. Error responses MUST use a uniform shape: `{ "error": string, "status": number }`.
JWT Bearer authentication MUST be required on all non-public endpoints. Tokens are issued by
auth-service and MUST be validated on every protected request.

**Rationale**: The Expo/React Native frontend is the primary consumer. Consistent contracts prevent
frontend breakage when backend services evolve independently.

### III. AI Prompt Integrity (NON-NEGOTIABLE)

All Anthropic Claude API calls MUST:
- Define prompts as named constants in a dedicated prompts file, never inline strings.
- Validate AI responses for expected shape before returning to callers.
- Define explicit fallback behaviour for when the Claude API is unavailable or returns an error.
- Log the prompt template name and response latency at INFO level on every call.

Ad-hoc or unvalidated AI calls MUST NOT be merged.

**Rationale**: AI responses are non-deterministic. Unvalidated responses surfaced to students
create a poor and potentially misleading experience. Named prompts enable version-controlled
iteration without scattered changes.

### IV. Test Coverage by Layer

Every service feature MUST include:
- Unit tests for business logic (service classes, utility functions).
- Integration tests for all API endpoints, covering the happy path and primary error cases.

No feature PR may be merged with failing tests. End-to-end tests covering critical journeys
(register → login → roadmap generation → career score update) SHOULD be maintained.

**Rationale**: A microservices platform fails in compound ways. Layer-based tests catch regressions
at the right granularity without over-testing implementation details.

### V. Observability & Security Baseline

Every service MUST:
- Emit structured JSON logs to stdout (compatible with Docker log drivers).
- Propagate a `X-Correlation-ID` header across all service-to-service calls and include it in
  every log line.
- Expose a `GET /health` endpoint returning `200 OK` when healthy.

Security MUST NOT be compromised:
- Passwords MUST be bcrypt-hashed with cost factor ≥ 12.
- No PII (names, emails, passwords) MUST appear in log output.
- Refresh tokens MUST be rotated on every use.

**Rationale**: Correlation IDs make distributed debugging tractable. Security standards protect
students whose academic and career data is held by the platform.

## Technology Constraints

The following technology choices are fixed for the life of the v1 platform. Deviating from this
stack requires a constitution amendment with a written migration plan.

| Layer | Technology | Constraint |
|---|---|---|
| Mobile Frontend | Expo + React Native + TypeScript | Expo SDK 51+ |
| Backend Services | Spring Boot (Java) | 3.x; one service per bounded context |
| Database | PostgreSQL 16 | One schema per service; no shared tables |
| AI Inference | Anthropic Claude API | claude-sonnet-4-6 or later |
| Authentication | JWT + OAuth 2.0 via Spring Security | Issued exclusively by auth-service |
| Containerisation | Docker + Docker Compose | Required for local development |
| CI/CD | GitHub Actions | Lint → Test → Build pipeline on every PR |

**Solo-builder note**: All 9 microservices are built and maintained by a single developer. This
makes simplicity and clear boundaries between services even more critical than in a team setting.
Avoid over-engineering any single service.

## Development Workflow

- All work MUST happen on feature branches branched from `main`.
- Every PR MUST pass a Constitution Check before merge (see plan-template.md gate).
- Local development MUST use Docker Compose; no service-specific port conflicts are permitted.
- Each microservice is versioned independently following MAJOR.MINOR.PATCH:
  - MAJOR: Breaking API changes (field removal, endpoint rename, auth change).
  - MINOR: New endpoints or fields added in a backward-compatible way.
  - PATCH: Bug fixes, performance improvements, internal refactors.
- AI-generated code MUST be reviewed with the same rigour as human-written code.
- Commits MUST be atomic: one logical change per commit, passing tests at every commit.

## Governance

This constitution supersedes all other practices, conventions, and informal agreements. When a
conflict exists between this document and any other guidance, this document wins.

**Amendment procedure**:
1. Open a PR that updates this file with the proposed change.
2. Increment `CONSTITUTION_VERSION` per the semantic versioning rules above.
3. Include a migration plan if the amendment invalidates existing code or processes.
4. Update `LAST_AMENDED_DATE` to the date of merge.

All PRs and code reviews MUST verify compliance with the five Core Principles. Complexity beyond
what the current user story requires MUST be justified in the PR description. Use `CLAUDE.md` and
the `.specify/` directory for runtime development guidance.

**Version**: 1.0.0 | **Ratified**: 2026-06-19 | **Last Amended**: 2026-06-25
