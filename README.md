<div align="center">

# SkillBridge AI

### From Student to Professional

**An AI-powered mobile career development platform for university students**

---

![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS-blue?style=flat-square)
![Frontend](https://img.shields.io/badge/Frontend-Expo%20%7C%20React%20Native%20%7C%20TypeScript-61DAFB?style=flat-square)
![Backend](https://img.shields.io/badge/Backend-Spring%20Boot-6DB33F?style=flat-square)
![Database](https://img.shields.io/badge/Database-PostgreSQL-336791?style=flat-square)
![Architecture](https://img.shields.io/badge/Architecture-Microservices-orange?style=flat-square)
![Status](https://img.shields.io/badge/Status-In%20Development-yellow?style=flat-square)

**KNUST — Department of Computer Science**
**College of Science · Faculty of Physical and Computational Sciences**
**Group 18 · Academic Year 2025/2026**

</div>

---

## Table of Contents

- [Overview](#overview)
- [The Problem](#the-problem)
- [Core Features](#core-features)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [API Overview](#api-overview)
- [Environment Variables](#environment-variables)
- [Running with Docker](#running-with-docker)
- [Testing](#testing)
- [Contributing](#contributing)
- [Team](#team)
- [Documentation](#documentation)

---

## Overview

SkillBridge AI is a cross-platform mobile application that guides university students from their first semester through to graduation and employment. Most career tools are transactional — they list jobs or offer one-off interview tips. SkillBridge AI is different: it builds a student's professional readiness continuously, semester by semester, through AI-powered coaching, verified portfolios, internship matching, and a live Career Readiness Score.

The platform serves four stakeholder groups simultaneously:

| Stakeholder | What They Get |
|---|---|
| **Students** | Personalised career roadmaps, skill gap analysis, mock interviews, internship matches, verified portfolios |
| **Universities** | Institution-wide career analytics, cohort readiness dashboards, bulk student onboarding |
| **Alumni** | A structured channel to mentor current students matched by career interest |
| **Recruiters & Companies** | A searchable pool of verified, scored student candidates and a branded challenge pipeline |

---

## The Problem

Students in Ghanaian universities face a compounding set of career challenges that existing tools solve only in isolation:

- No reliable way to identify which skills target employers actually require
- CVs that are thin, generic, and unverified — nothing to show practical work
- Internship opportunities largely surfaced through personal networks
- Interview preparation left entirely to individual initiative with no feedback
- No platform that tracks and verifies a student's development journey over their full degree

SkillBridge AI is built to give every student — regardless of background or personal network — the kind of structured, continuous career guidance that has historically been reserved for those who already know the right people.

---

## Core Features

| # | Feature | Description |
|---|---|---|
| 1 | **AI Career Roadmap** | Generates a personalised, semester-by-semester development plan based on career path, academic level, and current skill profile |
| 2 | **Skill Gap Analysis** | Parses an uploaded CV against target role requirements and returns a ranked list of missing skills with specific recommendations |
| 3 | **Portfolio Builder** | Compiles projects, certifications, and achievements into a professional portfolio; verified items earn a trust badge |
| 4 | **Mock Interviews** | Voice and text interview simulations with AI evaluation of content, structure, and delivery — feedback in under 5 seconds |
| 5 | **Internship Matching** | Ranks available opportunities by skill alignment and Career Readiness Score; students apply directly in-platform |
| 6 | **Industry Challenges** | Companies post real-world problems; students submit solutions ranked on a public leaderboard |
| 7 | **Alumni Mentorship** | Matches students to alumni professionals by career interest; messaging handled in-platform |
| 8 | **Career Readiness Score** | A dynamic 0–100 employability score updated after every milestone, project, certificate, or experience entry |
| 9 | **Recruiter Dashboard** | Companies search, filter, and contact verified student candidates directly |

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Mobile Frontend | Expo + React Native + TypeScript | Expo SDK 51+ |
| Backend Services | Spring Boot (Java) | 3.x |
| Database | PostgreSQL | 16 |
| AI Inference | Anthropic Claude API | claude-sonnet-4-6 |
| Authentication | JWT + OAuth 2.0 (Spring Security) | — |
| Containerisation | Docker + Docker Compose | — |
| CI/CD | GitHub Actions | — |
| API Documentation | Swagger / OpenAPI 3.0 | — |

---

## Repository Structure

This project follows a **monorepo** structure. Both the frontend and all backend services live in one repository, organised into clearly separated directories.

```
skillbridge-ai/
│
├── frontend/                        # Expo + React Native mobile app
│   ├── app/                         # Expo Router screen files
│   │   ├── (auth)/                  # Login, register, onboarding
│   │   ├── (student)/               # Student dashboard, roadmap, portfolio
│   │   ├── (recruiter)/             # Recruiter dashboard, search
│   │   └── (admin)/                 # Admin verification, analytics
│   ├── components/                  # Shared UI components
│   ├── hooks/                       # Custom React hooks
│   ├── services/                    # API client and service modules
│   ├── store/                       # State management
│   ├── types/                       # TypeScript type definitions
│   ├── constants/                   # App-wide constants
│   ├── app.json
│   ├── package.json
│   └── tsconfig.json
│
├── backend/
│   ├── auth-service/                # Registration, login, JWT, RBAC
│   ├── career-service/              # Roadmap generation, milestone tracking
│   ├── skill-gap-service/           # CV parsing, AI gap analysis
│   ├── portfolio-service/           # Portfolio management, verification
│   ├── interview-service/           # Mock interview sessions, AI evaluation
│   ├── matching-service/            # Internship opportunity matching
│   ├── challenge-service/           # Industry challenges, leaderboard
│   ├── mentorship-service/          # Alumni pairing, messaging
│   └── notification-service/        # Push notifications, alerts
│
├── docs/                            # Project documentation
│   ├── architecture.md              # System architecture deep-dive
│   ├── api.md                       # API reference overview
│   ├── database.md                  # Database schema and design
│   ├── contributing.md              # Contribution guidelines
│   └── setup.md                     # Detailed environment setup
│
├── docker-compose.yml               # Full local development environment
├── docker-compose.prod.yml          # Production compose override
├── .github/
│   └── workflows/
│       ├── ci.yml                   # CI — lint, test, build on every PR
│       └── cd.yml                   # CD — deploy on merge to main
├── .env.example                     # Environment variable template
└── README.md
```

---

## Getting Started

### Prerequisites

Make sure you have the following installed before continuing:

- **Node.js** 20+
- **Java** 21+
- **Docker** and **Docker Compose**
- **PostgreSQL** 16 (or use the Docker Compose setup — recommended)
- **Expo CLI** — `npm install -g expo-cli`
- An **Anthropic API key** (get one at [console.anthropic.com](https://console.anthropic.com))

### 1. Clone the repository

```bash
git clone https://github.com/demmacrushga/Skillbridge-AI-CodeQuest-2026-Group-18-.git
cd Skillbridge-AI-CodeQuest-2026-Group-18-
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in all required values. See [Environment Variables](#environment-variables) for details.

### 3. Start the full backend with Docker Compose

This starts all nine microservices and a PostgreSQL instance in one command:

```bash
docker-compose up --build
```

Services will be available at the ports listed in the [Architecture](#architecture) section.

### 4. Start the frontend

```bash
cd frontend
npm install
npx expo start
```

Scan the QR code with the Expo Go app on your phone, or press `a` for Android emulator / `i` for iOS simulator.

---

## Architecture

SkillBridge AI uses a **microservices architecture**. Each service is independently deployable, owns its own PostgreSQL schema, and exposes a REST API. The frontend communicates with services through a shared API client layer.

```
┌─────────────────────────────────────────────────────────┐
│                  Expo Mobile App (Frontend)              │
│           React Native + TypeScript + Expo Router        │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS / REST
┌──────────────────────▼──────────────────────────────────┐
│                    API Gateway / Nginx                    │
│              Request routing + rate limiting              │
└──┬───┬────┬────┬────┬────┬────┬────┬────────────────────┘
   │   │    │    │    │    │    │    │
   ▼   ▼    ▼    ▼    ▼    ▼    ▼    ▼
 auth career gap port intv match chal ment  notif
  :8001 :8002 :8003 :8004 :8005 :8006 :8007 :8008 :8009

Each service ──► Own PostgreSQL schema
career-service / skill-gap-service / interview-service ──► Anthropic Claude API
```

### Service Port Map

| Service | Port | Responsibility |
|---|---|---|
| auth-service | 8001 | Registration, login, JWT issuance, RBAC |
| career-service | 8002 | AI roadmap generation, milestone tracking |
| skill-gap-service | 8003 | CV parsing, AI gap analysis, resource linking |
| portfolio-service | 8004 | Portfolio CRUD, verification workflow |
| interview-service | 8005 | Session management, AI evaluation |
| matching-service | 8006 | Opportunity ingestion, ranking algorithm |
| challenge-service | 8007 | Challenge posting, submissions, leaderboard |
| mentorship-service | 8008 | Alumni-student pairing, messaging |
| notification-service | 8009 | Push notifications, in-app alerts |

For a deeper walkthrough of the architecture, data flow, and service communication patterns, see [`docs/architecture.md`](docs/architecture.md).

---

## API Overview

All services expose RESTful APIs documented with Swagger/OpenAPI 3.0. When running locally, Swagger UI is available at:

```
http://localhost:{PORT}/swagger-ui/index.html
```

For example, the auth service docs are at `http://localhost:8001/swagger-ui/index.html`.

### Key Endpoints at a Glance

```
POST   /auth/register                 Register a new user
POST   /auth/login                    Authenticate and receive JWT
GET    /career/roadmap/{userId}       Fetch a student's career roadmap
POST   /career/roadmap/generate       Generate AI roadmap on onboarding
POST   /skill-gap/analyse             Upload CV and return gap report
GET    /portfolio/{userId}            Fetch a student's portfolio
POST   /portfolio/items               Submit a new portfolio item
POST   /interview/sessions            Start a mock interview session
POST   /interview/sessions/{id}/answer  Submit an answer, receive AI feedback
GET    /matching/opportunities        Fetch ranked internship matches
POST   /challenge                     Post a new industry challenge
GET    /challenge/{id}/leaderboard    Fetch challenge leaderboard
```

Full endpoint reference, request/response schemas, and example payloads are in [`docs/api.md`](docs/api.md).

---

## Environment Variables

Copy `.env.example` to `.env` and populate every field before running the project.

```env
# ── Database ──────────────────────────────────────────────────────────────────
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=skillbridge
POSTGRES_PASSWORD=your_password_here
POSTGRES_DB=skillbridge_db

# ── Auth ──────────────────────────────────────────────────────────────────────
JWT_SECRET=your_jwt_secret_minimum_32_characters
JWT_EXPIRY_HOURS=24
OAUTH_GOOGLE_CLIENT_ID=your_google_oauth_client_id
OAUTH_GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret

# ── AI ────────────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=your_anthropic_api_key

# ── Notifications ─────────────────────────────────────────────────────────────
EXPO_ACCESS_TOKEN=your_expo_push_notification_token

# ── Service Ports ─────────────────────────────────────────────────────────────
AUTH_SERVICE_PORT=8001
CAREER_SERVICE_PORT=8002
SKILL_GAP_SERVICE_PORT=8003
PORTFOLIO_SERVICE_PORT=8004
INTERVIEW_SERVICE_PORT=8005
MATCHING_SERVICE_PORT=8006
CHALLENGE_SERVICE_PORT=8007
MENTORSHIP_SERVICE_PORT=8008
NOTIFICATION_SERVICE_PORT=8009
```

> **Never commit your `.env` file.** It is listed in `.gitignore` by default.

---

## Running with Docker

### Start everything

```bash
docker-compose up --build
```

### Start a specific service

```bash
docker-compose up auth-service postgres
```

### Stop all services

```bash
docker-compose down
```

### Rebuild a single service after code changes

```bash
docker-compose up --build career-service
```

### View logs for a service

```bash
docker-compose logs -f skill-gap-service
```

---

## Testing

Every service has its own test suite. The CI pipeline runs all tests automatically on every pull request.

### Run all backend tests

```bash
# From the repo root
cd backend/auth-service && ./mvnw test
cd backend/career-service && ./mvnw test
# ... repeat for each service
```

### Run frontend tests

```bash
cd frontend
npm test
```

### Run integration tests

```bash
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

### Coverage

Each service targets a minimum of **70% line coverage**. Coverage reports are generated in `target/site/jacoco/` for each Spring Boot service after running `./mvnw verify`.

---

## Contributing

All five members of Group 18 are full-stack developers. There are no specialised roles — every member is responsible for frontend, backend, and DevOps work on their assigned modules.

### Workflow

1. Pull the latest from `main`
   ```bash
   git checkout main && git pull
   ```

2. Create a branch for your feature or fix
   ```bash
   git checkout -b feat/career-roadmap-generation
   ```
   Branch naming: `feat/`, `fix/`, `docs/`, `test/`, `chore/`

3. Make your changes. Write tests for any new logic.

4. Run tests locally before pushing
   ```bash
   ./mvnw test        # backend
   npm test           # frontend
   ```

5. Push and open a pull request against `main`
   ```bash
   git push origin feat/career-roadmap-generation
   ```

6. Request a review from at least one other group member before merging.

For full contribution guidelines including commit message conventions and code style, see [`docs/contributing.md`](docs/contributing.md).

---

## Team

**Group 18 — Department of Computer Science, KNUST**
Academic Year 2025/2026

| Name | Index Number | Primary Module |
|---|---|---|
| Akomeah Hilda Okyem | 6133524 | auth-service + frontend auth screens |
| Frimpong Roselyn Kyerewa | 6159424 | career-service + skill-gap-service |
| Mintah Louisa Afua | 6168824 | portfolio-service + interview-service |
| Ampong Lordina Animah | 6139224 | matching-service + challenge-service |
| Dziwornu Edith | 6156224 | mentorship-service + notification-service |

> Every member is responsible for the full stack of their assigned service — frontend screens, Spring Boot backend, PostgreSQL schema, Docker config, and API documentation.

---

## Documentation

All project documentation lives in the `docs/` folder:

| Document | Description |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | System architecture, service communication, data flow diagrams |
| [`docs/api.md`](docs/api.md) | Full API reference with request/response examples |
| [`docs/database.md`](docs/database.md) | Database schema, ER diagram, and design decisions |
| [`docs/setup.md`](docs/setup.md) | Detailed local development setup for each service |
| [`docs/contributing.md`](docs/contributing.md) | Branching strategy, commit conventions, PR process |

---

<div align="center">

**SkillBridge AI** · Group 18 · KNUST Department of Computer Science · 2025/2026

*Built to give every student the career guidance they deserve.*

</div>
