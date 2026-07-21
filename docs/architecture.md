# Architecture

This document describes the technical architecture of SkillBridge AI — how the system is structured, how services communicate, how data flows, and the key design decisions behind each choice.

---

## Table of Contents

- [Architectural Style](#architectural-style)
- [System Overview](#system-overview)
- [Frontend Architecture](#frontend-architecture)
- [Backend Microservices](#backend-microservices)
- [Service Communication](#service-communication)
- [Database Design](#database-design)
- [AI Integration](#ai-integration)
- [Authentication & Authorisation](#authentication--authorisation)
- [Infrastructure & DevOps](#infrastructure--devops)
- [Design Decisions](#design-decisions)

---

## Architectural Style

SkillBridge AI uses a **microservices architecture**. The backend is split into nine independently deployable services, each owning a specific domain of the business logic and its own isolated PostgreSQL schema. Services do not share database tables and do not call each other's databases directly.

The mobile frontend communicates with services through HTTP REST APIs. An Nginx reverse proxy routes requests to the appropriate service based on URL prefix.

This approach was chosen because it:
- Allows each team member to own a service end-to-end without conflicts
- Makes individual services independently scalable as load changes
- Isolates failures — a bug in the notification service does not bring down the interview service
- Reflects real-world backend engineering practice the team will encounter professionally

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    Expo Mobile App (Frontend)                     │
│              React Native · TypeScript · Expo Router              │
└───────────────────────────────┬──────────────────────────────────┘
                                │ HTTPS
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                        Nginx API Gateway                          │
│          URL-based routing · Rate limiting · TLS termination      │
└──┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬─────────────┘
   │      │      │      │      │      │      │      │
   ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼
 :8001  :8002  :8003  :8004  :8005  :8006  :8007  :8008  :8009
 auth  career  gap   port   intv  match   chal   ment   notif

   │      │      │                              │
   └──────┴──────┴──────────────────────────────┘
                         │
                    PostgreSQL
              (separate schema per service)

         career-service ──────────────────────┐
         skill-gap-service ───────────────────┤──► Anthropic Claude API
         interview-service ───────────────────┘

         notification-service ─────────────────► Expo Push Notification API
```

---

## Frontend Architecture

The frontend is built with **Expo** and **React Native** using **TypeScript** throughout. Navigation is handled by **Expo Router**, which uses a file-based routing convention similar to Next.js.

### Directory Structure

```
frontend/
├── app/
│   ├── (auth)/
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── onboarding.tsx
│   ├── (student)/
│   │   ├── dashboard.tsx
│   │   ├── roadmap.tsx
│   │   ├── skill-gap.tsx
│   │   ├── portfolio.tsx
│   │   ├── interviews.tsx
│   │   ├── opportunities.tsx
│   │   ├── challenges.tsx
│   │   └── mentorship.tsx
│   ├── (recruiter)/
│   │   ├── dashboard.tsx
│   │   └── search.tsx
│   └── (admin)/
│       ├── verifications.tsx
│       └── analytics.tsx
├── components/
│   ├── ui/                  # Base UI components (Button, Card, Input...)
│   ├── roadmap/             # Roadmap-specific components
│   ├── portfolio/           # Portfolio card, verification badge
│   └── interview/           # Interview session UI
├── services/
│   ├── api.ts               # Axios instance with JWT interceptor
│   ├── auth.service.ts
│   ├── career.service.ts
│   ├── skill-gap.service.ts
│   ├── portfolio.service.ts
│   ├── interview.service.ts
│   ├── matching.service.ts
│   ├── challenge.service.ts
│   └── mentorship.service.ts
├── store/
│   └── auth.store.ts        # Zustand store for auth state
├── hooks/
│   ├── useAuth.ts
│   ├── useRoadmap.ts
│   └── useCareerScore.ts
└── types/
    ├── user.types.ts
    ├── roadmap.types.ts
    ├── portfolio.types.ts
    └── interview.types.ts
```

### State Management

Global state (authentication, user profile, Career Readiness Score) is managed with **Zustand** — lightweight and TypeScript-friendly. Server state (API data, loading states, caching) is managed with **React Query (TanStack Query)**.

### API Client

All API calls go through a single Axios instance defined in `services/api.ts`. It:
- Attaches the JWT access token to every request via an interceptor
- Automatically refreshes the token on 401 responses
- Provides typed request and response helpers

---

## Backend Microservices

Each service is a standalone **Spring Boot 3.x** application with its own:
- Maven `pom.xml`
- `application.yml` configuration
- PostgreSQL schema (managed by Flyway migrations)
- Swagger/OpenAPI 3.0 documentation
- Dockerfile

### auth-service (Port 8001)

Handles all identity and access concerns. No other service issues tokens — all authentication goes through here.

**Key responsibilities:**
- User registration (student, alumni, recruiter, admin)
- Email verification
- Login with email/password or Google OAuth 2.0
- JWT access token issuance (24-hour expiry) and refresh token rotation
- Role-Based Access Control (RBAC) — enforced via Spring Security at the gateway level

**Data owned:** `users`, `roles`, `refresh_tokens`, `oauth_accounts`

---

### career-service (Port 8002)

Manages the core student career development journey.

**Key responsibilities:**
- Career path selection and storage
- AI roadmap generation (calls Anthropic Claude API)
- Milestone creation, completion tracking, and status updates
- Roadmap progress percentage calculation
- Career Readiness Score contribution aggregation

**Data owned:** `career_paths`, `roadmaps`, `milestones`, `milestone_completions`

---

### skill-gap-service (Port 8003)

Processes uploaded CVs and identifies skill gaps using AI.

**Key responsibilities:**
- CV file upload (PDF/DOCX) and storage
- Text extraction from uploaded files
- Structured AI prompt to Claude API for gap analysis
- Gap report storage and retrieval
- Resource recommendation linking

**Data owned:** `cv_uploads`, `gap_reports`, `skill_gaps`, `resource_recommendations`

---

### portfolio-service (Port 8004)

Manages a student's professional portfolio and the verification of submitted items.

**Key responsibilities:**
- Portfolio item CRUD (projects, certifications, achievements) with `externalUrl` only (no file storage)
- AI-powered verification via Claude: `POST /items/{id}/verify` calls Claude synchronously and returns APPROVED/REJECTED immediately
- Admin manual override: `PATCH /verification/{id}` for corrections; stamps `reviewSource = HUMAN`
- Graceful fallback: Claude unavailable → item saved as PENDING with `reviewSource = PENDING_FALLBACK`
- Shareable portfolio link generation (SecureRandom 256-bit token, idempotent)
- Verified badge assignment on APPROVED

**Data owned:** `portfolio_items`, `verification_requests`, `portfolio_links`

---

### interview-service (Port 8005)

Runs mock interview sessions and evaluates responses using AI.

**Key responsibilities:**
- Session creation with role-specific question generation
- Text and voice response handling (voice is transcribed before evaluation)
- AI evaluation of each answer via Claude API
- Session history and feedback storage
- Session-level summary generation

**Data owned:** `interview_sessions`, `interview_questions`, `interview_answers`, `feedback_reports`

---

### matching-service (Port 8006)

Matches students to internship and job opportunities.

**Key responsibilities:**
- Internship listing ingestion (posted by recruiters)
- Skill-alignment scoring between student profile and opportunity requirements
- Ranked match list generation per student
- Application tracking (student clicks apply)

**Data owned:** `opportunities`, `opportunity_skills`, `student_matches`, `applications`

---

### challenge-service (Port 8007)

Manages company-posted industry challenges and student submissions.

**Key responsibilities:**
- Challenge posting and management by companies
- Student submission handling
- Scoring and ranking logic
- Real-time leaderboard updates

**Data owned:** `challenges`, `challenge_submissions`, `leaderboard_entries`

---

### mentorship-service (Port 8008)

Handles alumni-student matching and in-platform communication.

**Key responsibilities:**
- Alumni profile management and interest tagging
- Student-to-alumni matching by career interest and sector
- Mentorship request sending and acceptance
- In-platform message thread management

**Data owned:** `alumni_profiles`, `mentorship_pairs`, `mentorship_requests`, `messages`

---

### notification-service (Port 8009)

Delivers push notifications and in-app alerts across all user types.

**Key responsibilities:**
- Expo Push Notification API integration
- In-app notification storage and read-state tracking
- Event subscriptions (listens for triggers from other services)
- Notification preference management per user

**Data owned:** `notifications`, `notification_preferences`, `push_tokens`

---

## Service Communication

Services are **loosely coupled**. The primary communication pattern is:

1. **Synchronous REST** — the frontend calls a service directly for real-time interactions (login, fetch roadmap, submit interview answer).
2. **Event-driven (optional for v1)** — services that need to notify each other (e.g., career-service notifying notification-service when a milestone is completed) do so via direct HTTP calls in the prototype. A message broker (e.g., RabbitMQ or Kafka) is planned for v2.

Services never query each other's databases. If service A needs data owned by service B, it calls service B's API.

---

## Database Design

Each service owns an isolated **PostgreSQL schema**. All schema changes are managed by **Flyway** migration scripts stored in `src/main/resources/db/migration/` within each service.

Migration file naming convention:
```
V1__create_users_table.sql
V2__add_oauth_accounts_table.sql
V3__add_refresh_tokens_table.sql
```

See [`docs/database.md`](database.md) for the full schema reference and ER diagram for each service.

---

## AI Integration

Four services call the **Anthropic Claude API** (`claude-sonnet-4-6`):

| Service | Prompt Constant | What It Uses Claude For |
|---|---|---|
| career-service | `CAREER_ROADMAP_V1` | Generates the semester-by-semester roadmap from career path + academic level |
| skill-gap-service | `SKILL_GAP_ANALYSIS_V1` | Analyses extracted CV text against role requirements; produces ranked gap report |
| portfolio-service | `PORTFOLIO_VERIFICATION_V1` | Synchronously assesses a portfolio item and returns APPROVED/REJECTED with a reason |
| interview-service | *(planned)* | Evaluates student interview answers and generates structured feedback |

### Prompt Strategy

Each service sends a carefully structured system prompt that constrains Claude's output to a consistent JSON schema. The response is parsed and validated before being stored or returned to the frontend.

Example (career-service):
```
System: You are a career development advisor. Given a student's career path and 
academic level, return a JSON object with the following structure: 
{ "roadmap": [ { "semester": 1, "milestones": [ ... ] } ] }. 
Return only valid JSON with no preamble.

User: Career path: Software Engineer. Academic level: Level 200. 
Current skills: Python, basic HTML.
```

### Caching

Common roadmap templates (same career path + same academic level combination) are cached in-memory for 24 hours to reduce API call volume and improve response times.

---

## Authentication & Authorisation

All protected endpoints require a valid **JWT Bearer token** in the `Authorization` header:
```
Authorization: Bearer <token>
```

Tokens are issued by `auth-service` and validated by each service independently using the shared JWT secret. Role claims embedded in the token are used to enforce RBAC at the controller level via Spring Security annotations (`@PreAuthorize`).

### Roles

| Role | Access |
|---|---|
| `STUDENT` | Career roadmap, skill gap, portfolio, interviews, matching, challenges, mentorship |
| `ALUMNI` | Mentorship module (as mentor), own profile |
| `RECRUITER` | Recruiter dashboard, opportunity posting, challenge posting |
| `ADMIN` | Portfolio verification, user management, analytics dashboard |

---

## Infrastructure & DevOps

### Local Development

The entire local stack (all nine services + PostgreSQL) is defined in `docker-compose.yml`. Running `docker-compose up --build` starts everything with a single command.

### CI/CD Pipeline

GitHub Actions workflows run on every push and pull request:

**`ci.yml`** — runs on every PR:
1. Lint check (Checkstyle for Java, ESLint for TypeScript)
2. Unit tests for every Spring Boot service (`./mvnw test`)
3. Frontend tests (`npm test`)
4. Build verification (Docker build for each service)
5. PRs that fail any step are blocked from merging

**`cd.yml`** — runs on merge to `main`:
1. Build and tag Docker images
2. Push images to container registry
3. Deploy to staging environment

### Environment Configuration

All configuration is externalised via environment variables. No secrets are hardcoded. The `.env.example` file documents every required variable. The `.env` file is listed in `.gitignore` and must never be committed.

---

## Design Decisions

| Decision | Rationale |
|---|---|
| **Monorepo** | Simplifies cross-service refactoring, keeps CI in one place, and gives accurate contribution tracking for a solo builder |
| **Spring Boot for backend** | Strong ecosystem for REST APIs, Spring Security, JPA, and Flyway; familiar stack for the team |
| **PostgreSQL over NoSQL** | Career development data is highly relational (users → roadmaps → milestones → scores); ACID compliance critical for score consistency |
| **Schema-per-service isolation** | Minimum viable database independence for shared-host PostgreSQL; enforces service boundaries without full DB separation |
| **JWT validated locally per service** | Auth-service is not a hard runtime dependency on every request; stateless validation scales without a session store |
| **Expo over bare React Native** | Simplifies builds, OTA updates, and device API access; appropriate for a prototype |
| **Zustand over Redux** | Lighter API, easier TypeScript integration, sufficient for the app's state complexity |
| **Flyway for migrations** | Versioned, sequential schema changes that apply automatically on startup — prevents drift across environments |
| **JWT with refresh rotation** | Stateless auth scales without a session store; rotation limits the damage window of a stolen refresh token |
| **Anthropic Claude API** | Consistent, high-quality structured JSON output suitable for parsing roadmaps, gap reports, and verification decisions programmatically |
| **In-memory CV text extraction** | PDFBox / Apache POI extract text from uploads in memory; raw file bytes are discarded after extraction. No disk or S3 needed in skill-gap-service |
| **Synchronous Claude calls** | Services call Claude in-request (not async queues). 2–120 s latency is acceptable for user-initiated actions (roadmap generation, CV analysis, portfolio verification). Async deferred to v2 |
| **Graceful AI fallback** | Every Claude-calling service defines an explicit fallback: career-service returns a structured error, skill-gap-service marks upload as FAILED (503), portfolio-service saves as PENDING (200). Constitution Principle III |
| **Named prompt constants** | All Claude prompts are `private static final String PROMPT_NAME = "..."`. Logged alongside response latency. Enables prompt version tracing in production logs |
