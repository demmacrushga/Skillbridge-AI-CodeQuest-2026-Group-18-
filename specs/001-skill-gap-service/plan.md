# Implementation Plan: skill-gap-service

**Branch**: `feat/skill-gap-service` | **Date**: 2026-06-25
**Spec**: `docs/api.md` (lines 182–241), `docs/database.md` (lines 139–183), `docs/architecture.md`

---

## Summary

Build a Spring Boot 3.x microservice that:
1. Accepts a PDF or DOCX CV upload (max 5MB)
2. Extracts plain text from the file (Apache PDFBox for PDF, Apache POI for DOCX)
3. Calls the Claude API with a structured prompt to produce a ranked gap analysis
4. Persists the result across four tables in an isolated `skill_gap` PostgreSQL schema
5. Exposes three REST endpoints (POST analyse, GET report by ID, GET all user reports)
6. Registers in docker-compose and nginx alongside the existing services

---

## Technical Context

| | |
|---|---|
| **Language** | Java 21, Spring Boot 3.3.6 |
| **Dependencies** | Spring Web, Security, Data JPA, Validation, Flyway, PostgreSQL driver, JJWT 0.12.5, springdoc 2.5.0, Lombok + Apache PDFBox 3.0.3 + Apache POI (poi-ooxml) 5.3.0 |
| **Database** | PostgreSQL 16, isolated schema `skill_gap` |
| **AI** | Anthropic Claude API (claude-sonnet-4-6), same RestTemplate pattern as career-service |
| **Port** | 8003 |
| **No caching** | Each CV is unique — no @Cacheable; drop spring-boot-starter-cache/caffeine from pom |
| **Testing** | JUnit 5 + Mockito (unit), @WebMvcTest (controller slice) |
| **Target Platform** | Docker container, Linux |
| **Project Type** | microservice / web-service |
| **Performance Goals** | Claude API response < 30s p95 (AI-bound); file upload < 1s for 5MB |
| **Constraints** | JWT validated locally (not via auth-service call); file size max 5MB; PDF/DOCX only |
| **Scale/Scope** | Single service, 3 endpoints, 4 DB tables, 1 Claude API integration |

---

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I. Microservice Autonomy | PASS | Own `skill_gap` schema; no cross-DB access |
| II. Mobile-First API | PASS | Structured JSON, uniform error shape, JWT required |
| III. AI Prompt Integrity | PASS | Prompt as static final PROMPT_NAME + SYSTEM_PROMPT; validate response; fallback on AiServiceException |
| IV. Test Coverage | PASS | Unit (service + ClaudeService) + integration (controller slice) tests |
| V. Observability | PASS | CorrelationIdFilter, GET /health, structured JSON logs, prompt latency logging |

---

## Project Structure

```
backend/skill-gap-service/
├── pom.xml
├── Dockerfile
├── src/main/java/com/skillbridge/skillgap/
│   ├── SkillGapServiceApplication.java
│   ├── controller/SkillGapController.java
│   ├── service/
│   │   ├── SkillGapService.java
│   │   ├── SkillGapServiceImpl.java
│   │   ├── ClaudeService.java
│   │   ├── FileParserService.java
│   │   └── dto/  (SkillGapTemplate, RecommendationTemplate records)
│   ├── entity/   (CvUpload, GapReport, SkillGap, ResourceRecommendation)
│   ├── repository/  (4 JPA repos)
│   ├── dto/response/  (ReportResponse, SkillGapResponse, RecommendationResponse)
│   ├── exception/  (GlobalExceptionHandler + 5 custom exceptions)
│   ├── config/   (SecurityConfig, RestTemplateConfig, StartupLogger, CorrelationIdFilter)
│   └── security/ (JwtAuthFilter, JwtService, JwtUserDetails)
└── src/main/resources/
    ├── application.yml
    └── db/migration/ (V1–V4 Flyway files)
```

**Structure Decision**: Option 3 (microservice) — single Spring Boot service with isolated schema.

Also updates:
- `docker-compose.yml` — add skill-gap-service entry + named volume
- `nginx/nginx.conf` — add upstream + location block
- `.env.example` — add FILE_UPLOAD_DIR
- `.github/workflows/` — add service to CI matrix

---

## Key Reuse from career-service

| What to reuse | Source path |
|---|---|
| ClaudeService pattern | backend/career-service/.../service/ClaudeService.java |
| AiServiceException | backend/career-service/.../exception/AiServiceException.java |
| GlobalExceptionHandler | backend/career-service/.../exception/GlobalExceptionHandler.java |
| SecurityConfig | backend/career-service/.../config/SecurityConfig.java |
| RestTemplateConfig | backend/career-service/.../config/RestTemplateConfig.java |
| JwtService, JwtAuthFilter, JwtUserDetails | backend/career-service/.../security/ |
| pom.xml structure | backend/career-service/pom.xml |
| Dockerfile | backend/career-service/Dockerfile |
