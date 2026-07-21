# Implementation Plan: AI-Powered Portfolio Builder

**Branch**: `006-ai-portfolio-builder` | **Date**: 2026-06-29 | **Spec**: `specs/006-ai-portfolio-builder/spec.md`

## Summary

Add AI-powered portfolio building to portfolio-service. Instead of manually adding items one by one, a student uploads a CV (PDF/DOCX) or pastes a website URL. Claude extracts all portfolio-worthy items (projects, certifications, awards, publications). The student reviews the extracted items on a dedicated screen, edits or excludes as needed, and batch-saves to their portfolio in one transactional request. Three new endpoints: `POST /portfolio/extract` (CV upload), `POST /portfolio/extract-url` (website link), `POST /portfolio/items/batch` (batch save). Extraction is stateless — no persistence until the student explicitly confirms. On Claude failure, 503 with a human-readable message (no 500 crash).

## Technical Context

**Language/Version**: Java 21, Spring Boot 3.3.6

**Primary Dependencies**:
- RestTemplate (already wired) — Claude API calls + website HTML fetching
- Jackson ObjectMapper (already wired) — JSON parsing
- Apache PDFBox 3.0.3 (new) — PDF text extraction (same version as skill-gap-service)
- Apache POI 5.3.0 (new) — DOCX text extraction (same version as skill-gap-service)
- Jsoup 1.18.1 (new) — HTML cleaning for website fetching
- `anthropic.api-key` config (already in application.yml from feature 005)
- `expo-document-picker` (already in frontend) — CV file picker

**Storage**: PostgreSQL 16, schema `portfolio` — **no schema changes**. Extraction is stateless. Batch save creates standard `PortfolioItem` rows in the existing `portfolio_items` table.

**Testing**: JUnit 5, Mockito, `@WebMvcTest`, JaCoCo ≥ 70%

**Target Platform**: Docker container, port 8004 (via nginx on 8080)

**Performance Goals**: Extraction response in 5–15 seconds (synchronous Claude call, same pattern as skill-gap analysis)

**Constraints**: 5MB file size limit for CV upload; 50,000 char truncation for fetched website HTML; 15s connect / 30s read timeout for website fetch; 120s read timeout for Claude API (already configured)

**Scale/Scope**: 3 new backend endpoints, 3 new service classes, 1 new frontend screen, 2 new frontend service functions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Microservice Autonomy | ✅ | No cross-service calls. CV parsing copied into portfolio-service (not proxied to skill-gap-service). Website fetching is self-contained. |
| II. Mobile-First API Contract | ✅ | Structured JSON responses; uniform error shape `{ status, error, message }`; JWT on all new endpoints. |
| III. AI Prompt Integrity | ✅ | `PORTFOLIO_EXTRACTION_V1` named constant; JSON array response validated; 503 fallback on Claude failure; prompt name + latency logged at INFO. |
| IV. Test Coverage | ✅ | Unit tests for FileParserService, WebsiteFetchService, ClaudeExtractionService, PortfolioExtractionService (batch save). Controller tests for all 3 new endpoints. JaCoCo ≥ 70%. |
| V. Observability & Security | ✅ | Prompt name + latency + itemCount at INFO; no PII in logs; X-Correlation-ID propagated; `/health` unchanged; JWT auth on all new endpoints. |

**No violations. No complexity tracking needed.**

## Project Structure

### Documentation (this feature)

```text
specs/006-ai-portfolio-builder/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── extraction.md    # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks command — NOT created by this plan)
```

### Source Code (repository root)

```text
backend/portfolio-service/
├── src/main/java/com/skillbridge/portfolio/
│   ├── controller/
│   │   └── PortfolioController.java          # MODIFIED — add 3 new endpoints
│   ├── service/
│   │   ├── PortfolioService.java             # MODIFIED — add extractCV, extractUrl, batchCreate
│   │   ├── PortfolioServiceImpl.java         # MODIFIED — implement new methods
│   │   ├── FileParserService.java            # NEW — PDF/DOCX text extraction
│   │   ├── WebsiteFetchService.java          # NEW — HTML fetch + Jsoup cleaning
│   │   ├── ClaudeExtractionService.java      # NEW — Claude API call for extraction
│   │   └── dto/
│   │       └── ExtractedItemTemplate.java    # NEW — internal record for Claude response
│   ├── dto/
│   │   ├── request/
│   │   │   ├── ExtractUrlRequest.java        # NEW
│   │   │   └── BatchCreateItemsRequest.java  # NEW
│   │   └── response/
│   │       └── ExtractedItemResponse.java    # NEW
│   ├── exception/
│   │   ├── AiServiceException.java           # EXISTS (from feature 005)
│   │   ├── FileSizeExceededException.java    # NEW
│   │   ├── UnsupportedFileTypeException.java # NEW
│   │   ├── FileParsingException.java         # NEW
│   │   ├── WebsiteFetchException.java        # NEW
│   │   └── GlobalExceptionHandler.java       # MODIFIED — add new exception handlers
│   └── resources/
│       └── application.yml                   # MODIFIED — add extraction config
├── pom.xml                                   # MODIFIED — add PDFBox, POI, Jsoup
└── src/test/java/com/skillbridge/portfolio/
    ├── service/
    │   ├── FileParserServiceTest.java        # NEW
    │   ├── WebsiteFetchServiceTest.java      # NEW
    │   ├── ClaudeExtractionServiceTest.java  # NEW
    │   └── PortfolioServiceImplTest.java     # MODIFIED — add batch create + extraction tests
    └── controller/
        └── PortfolioControllerTest.java      # MODIFIED — add 3 new endpoint tests

frontend/
├── app/(app)/
│   ├── portfolio.tsx                         # MODIFIED — add "Build with AI" button + modal
│   └── portfolio-review.tsx                  # NEW — review screen for extracted items
├── services/
│   └── portfolio.ts                          # MODIFIED — add extractFromCV, extractFromUrl, batchCreateItems
└── types/
    └── portfolio.ts                          # MODIFIED — add ExtractedItem, BatchCreatePayload types
```

**Structure Decision**: Mobile + API monorepo. Backend changes in `backend/portfolio-service/` (existing service, additive). Frontend changes in `frontend/app/(app)/` (new screen) and `frontend/services/` + `frontend/types/` (new API functions and types). No new services or directories.

## Complexity Tracking

No Constitution Check violations. Table intentionally empty.
