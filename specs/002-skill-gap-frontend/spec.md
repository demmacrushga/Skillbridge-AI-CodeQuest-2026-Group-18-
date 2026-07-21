# Feature Specification: Skill Gap Frontend Screens

**Feature Branch**: `002-skill-gap-frontend`

**Created**: 2026-06-25

**Status**: Draft

## Overview

Add two Expo/React Native screens that connect the mobile app to the skill-gap-service (port 8003 via nginx gateway `/skill-gap/`). Students should be able to upload their CV, trigger a gap analysis, and review ranked skill gaps with learning recommendations — all from their phone.

## User Scenarios & Testing

### User Story 1 — CV Upload & Analysis (Priority: P1)

A KNUST student opens the app, navigates to the Skills tab, uploads their CV (PDF or DOCX), enters a target job role, and submits for analysis. The app shows a loading state while Claude processes the CV, then displays the ranked skill gap report on completion.

**Why this priority**: Core value of the skill-gap-service. The app has no entry point for this feature yet.

**Independent Test**: Mount the SkillGapScreen with a mocked `skillGapService`; fire "Browse", select a file, type "Backend Developer", press "Analyse" → see loading spinner → service resolves → gap report appears with ranked gaps and recommendations.

**Acceptance Scenarios**:

1. **Given** an authenticated student on the Skills tab, **When** they tap "Browse CV", pick a PDF file, enter `targetRole = "Software Engineer"`, and tap "Analyse", **Then** the app calls `POST /skill-gap/analyse`, shows a loading indicator, and navigates to the Gap Report screen on success.

2. **Given** a student who has not yet uploaded a CV, **When** they view the Skills tab, **Then** the screen shows an empty state prompt ("Upload your CV to get started") with a prominent upload button.

3. **Given** the Claude API is slow (15–30 seconds), **When** analysis is in progress, **Then** the app displays a pulsing "Analysing your CV…" loading state that does not time out prematurely.

4. **Given** an analysis error (503 from backend), **When** the request fails, **Then** the app shows an inline error message ("AI analysis failed, please try again") without crashing.

5. **Given** a student uploads a file > 5MB or an unsupported type, **When** the backend returns 413 or 422, **Then** the app shows the specific error message returned by the API.

---

### User Story 2 — Gap Report View & History (Priority: P2)

A student reviews their generated gap report — a ranked list of skill gaps each with a description and concrete learning recommendations. They can also access past reports from their history.

**Why this priority**: Without a way to view the report, the analysis has no value. History adds persistence value.

**Independent Test**: Mount the GapReportScreen with a fixture `ReportResponse`; verify gap items render with importance rank badges, descriptions, and tappable recommendation links. Mount SkillGapScreen with prior reports; verify the reports list renders with date, targetRole, and a "View" button per row.

**Acceptance Scenarios**:

1. **Given** a completed analysis, **When** the student views the Gap Report screen, **Then** they see the `targetRole` as the header, a ranked list of skill gaps (sorted by `importanceRank`), and each gap shows its description and recommendations.

2. **Given** multiple recommendations for a skill gap, **When** the student views them, **Then** each recommendation shows an icon for its type (COURSE, BOOK, PROJECT), a title, and a tappable URL that opens in the device browser.

3. **Given** a student with multiple past reports, **When** they view the Skills tab, **Then** a "Past Analyses" section lists each report with its target role and date, and tapping one navigates to the Gap Report screen for that report.

4. **Given** a student with no past reports, **When** they view the Skills tab, **Then** the "Past Analyses" section shows an empty state ("No past analyses yet").

5. **Given** an analysis from a previous session, **When** the student navigates back to it via `GET /skill-gap/reports/{reportId}`, **Then** the Gap Report screen loads and displays the full report including all gaps and recommendations.

---

## Requirements

### Functional Requirements

- **FR-001**: App MUST provide a screen to pick a PDF or DOCX file from device storage using `expo-document-picker`.
- **FR-002**: App MUST include a text input for `targetRole` with validation (non-empty before submit).
- **FR-003**: App MUST call `POST /skill-gap/analyse` as `multipart/form-data` with the file and `targetRole`.
- **FR-004**: App MUST show an in-progress loading state for the duration of the analysis call (which may take 15–30s).
- **FR-005**: App MUST navigate to the Gap Report screen on successful analysis response (201).
- **FR-006**: App MUST display gap report data: `targetRole`, ranked `gaps` array (each with `skillName`, `importanceRank`, `gapDescription`, and `recommendations`).
- **FR-007**: App MUST display each recommendation with its `resourceType`, `title`, and a tappable `url` that opens in the system browser via `Linking.openURL`.
- **FR-008**: App MUST call `GET /skill-gap/reports` on Skills tab mount and show the list of past reports.
- **FR-009**: App MUST handle API errors (4xx/5xx) with inline error messages, not silent failures.
- **FR-010**: The Skills tab MUST be added to the existing bottom tab navigator in `frontend/app/(app)/_layout.tsx`.

### Non-Functional Requirements

- **NFR-001**: Follow existing theme tokens: `colors`, `typography`, `spacing`, `radius` from `@/constants/theme`.
- **NFR-002**: All text must meet AA contrast (already enforced by existing theme).
- **NFR-003**: Loading state for analysis must be user-friendly given 15–30s latency (pulsing animation, descriptive copy).
- **NFR-004**: Must work on both iOS and Android (use platform-agnostic RN components).

### Key Types (new, to be added to `frontend/types/skillGap.ts`)

- **RecommendationResponse**: `{ id: string; type: string; title: string; url: string | null }`
- **SkillGapItem**: `{ id: string; skillName: string; importanceRank: number; description: string; recommendations: RecommendationResponse[] }`
- **GapReport**: `{ reportId: string; targetRole: string; gaps: SkillGapItem[] }`

## Success Criteria

- **SC-001**: Student can complete the full flow (upload → analyse → view report) without leaving the app.
- **SC-002**: Gap Report screen renders correctly for reports with 3–7 skill gaps, each with 3–5 recommendations.
- **SC-003**: Error states are handled for 413, 422, 503 responses from the backend.
- **SC-004**: Past reports list loads on tab mount and navigates correctly to the detail view.
- **SC-005**: App does not crash if the backend is unreachable.

## Assumptions

- `expo-document-picker` is available (add to `package.json` if not installed).
- The nginx gateway routes `/skill-gap/` to `skill-gap-service:8003` (already configured in Phase 5 of the backend implementation).
- JWT access token is available via the existing `AuthContext` (`useAuth().token`).
- The Gap Report screen is a stack screen pushed on top of the Skills tab (not a separate tab).
- Recommendation URLs may be `null` — the UI should handle this gracefully (hide link if null).
