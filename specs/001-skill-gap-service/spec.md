# Feature Specification: Skill Gap Service

**Feature Branch**: `001-skill-gap-service`

**Created**: 2026-06-25

**Status**: Draft

## User Scenarios & Testing

### User Story 1 - CV Analysis (Priority: P1)

A student uploads their CV as a PDF or DOCX file and specifies a target job role. The system
extracts the CV text, sends it to the Claude API with a structured prompt, and returns a ranked
list of skill gaps with concrete learning recommendations.

**Why this priority**: Core value proposition of the service. Nothing else in the service is
useful without this working first.

**Independent Test**: Upload a PDF CV with `targetRole=Software Engineer` → receive a 201 response
containing `reportId`, `targetRole`, and a non-empty `gaps` array with `skillName`,
`importanceRank`, `description`, and `recommendations`.

**Acceptance Scenarios**:

1. **Given** an authenticated student with a valid JWT, **When** they POST a valid PDF to
   `/skill-gap/analyse` with `targetRole=Backend Developer`, **Then** the system returns 201 with
   a report containing at least one skill gap ranked by importance.

2. **Given** an authenticated student, **When** they upload a DOCX file, **Then** the system
   extracts text and returns the same response shape as for PDF.

3. **Given** an authenticated student, **When** the Claude API is unavailable, **Then** the
   system returns 503 with `{ "error": "AI service unavailable, try again later" }` and the
   cv_upload record is saved with `status=FAILED`.

4. **Given** an authenticated student, **When** they upload a file larger than 5MB, **Then**
   the system returns 413 with a clear error message.

5. **Given** an authenticated student, **When** they upload a file with an unsupported type
   (e.g., `.txt`), **Then** the system returns 422 with a clear error message.

---

### User Story 2 - Report Retrieval (Priority: P2)

A student retrieves a previously generated gap report by its ID, or lists all their past reports,
to review their skill gaps over time.

**Why this priority**: Depends on User Story 1 producing reports. Delivers persistent value — a
student can return to past analyses without re-uploading.

**Independent Test**: Given a reportId from a prior analyse call, `GET /skill-gap/reports/{id}`
returns 200 with the full report. `GET /skill-gap/reports` returns an array of all reports for
the authenticated user.

**Acceptance Scenarios**:

1. **Given** a student who has run an analysis, **When** they GET `/skill-gap/reports/{reportId}`,
   **Then** the system returns 200 with the full report matching the POST /analyse response shape.

2. **Given** a student who has run multiple analyses, **When** they GET `/skill-gap/reports`,
   **Then** the system returns 200 with a list of all their reports ordered by most recent first.

3. **Given** an authenticated student, **When** they GET `/skill-gap/reports/{nonExistentId}`,
   **Then** the system returns 404 (regardless of whether that ID belongs to another user).

4. **Given** a student with no prior analyses, **When** they GET `/skill-gap/reports`, **Then**
   the system returns 200 with an empty array (not 404).

---

### Edge Cases

- What happens when PDF text extraction produces empty text? Return 422 with "CV appears empty or unreadable".
- How does the system handle a JWT token issued for a different service? Same JWT_SECRET — token is valid across all services.
- What if `targetRole` is blank or missing? Return 400 (Spring `@Validated` on controller catches this).

## Requirements

### Functional Requirements

- **FR-001**: System MUST accept PDF and DOCX files up to 5MB via multipart/form-data upload.
- **FR-002**: System MUST extract plain text from uploaded files using Apache PDFBox (PDF) and Apache POI (DOCX).
- **FR-003**: System MUST call the Claude API (`claude-sonnet-4-6`) with a named prompt constant and validate the response shape before persisting.
- **FR-004**: System MUST persist gap analysis results in the `skill_gap` PostgreSQL schema across four tables.
- **FR-005**: System MUST return gap reports in the documented JSON shape: `{ reportId, targetRole, gaps: [...] }`.
- **FR-006**: System MUST store `cv_upload.status` as PROCESSING → COMPLETED or FAILED.
- **FR-007**: System MUST reject requests with missing or blank `targetRole` with HTTP 400.
- **FR-008**: System MUST return 404 for report IDs not belonging to the requesting user (no ownership leakage).
- **FR-009**: System MUST expose `GET /health` as a public endpoint returning `{ "status": "UP" }`.

### Key Entities

- **CvUpload**: Tracks an uploaded CV file; fields: id, userId, fileName, fileType, storagePath, extractedText, status, createdAt
- **GapReport**: One report per analyse call; fields: id, cvUploadId (FK), userId, targetRole, createdAt
- **SkillGap**: One row per gap in a report; fields: id, reportId (FK), skillName, importanceRank, gapDescription
- **ResourceRecommendation**: One row per recommendation per gap; fields: id, skillGapId (FK), resourceType, title, url

## Success Criteria

- **SC-001**: POST /skill-gap/analyse returns a valid gap report within 30 seconds for a 1-page CV.
- **SC-002**: All three API endpoints are covered by tests (unit + controller slice).
- **SC-003**: JaCoCo line coverage ≥ 70% across the service.
- **SC-004**: Service starts cleanly via `docker-compose up skill-gap-service` with no migration errors.
- **SC-005**: `GET /health` returns 200 within 100ms.

## Assumptions

- The JWT secret is shared across all services; skill-gap-service validates tokens locally without calling auth-service.
- File storage is local to the container at `${FILE_UPLOAD_DIR:/app/uploads}`; no cloud storage for v1.
- The Claude API key is available as `ANTHROPIC_API_KEY` environment variable.
- Tests do not require a running PostgreSQL instance — controller slice tests use `@WebMvcTest` with mocked services.
