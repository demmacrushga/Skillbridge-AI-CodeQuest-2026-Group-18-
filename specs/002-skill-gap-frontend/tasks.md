---
description: "Task list for skill-gap frontend screens implementation"
---

# Tasks: Skill Gap Frontend Screens

**Input**: Design documents from `specs/002-skill-gap-frontend/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**Tests**: Not included (spec does not request TDD; constitution Principle IV deferred to Polish).

**Organization**: Tasks grouped by user story. US1 = CV Upload & Analysis. US2 = Report History & Browsing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks in the same phase)
- **[US1]/[US2]**: Maps to user story from spec.md

---

## Phase 1: Setup (Blocking all screens)

**Purpose**: Install the new dependency and create the shared types + service layer. No screen work can begin until this is done.

- [X] T001 Install `expo-document-picker` — run `cd frontend && npx expo install expo-document-picker` from repo root; verify the package appears in `frontend/package.json` dependencies
- [X] T002 [P] Create `frontend/types/skillGap.ts` — three TypeScript interfaces: `RecommendationResponse { id: string; type: string; title: string; url: string | null }`, `SkillGapItem { id: string; skillName: string; importanceRank: number; description: string; recommendations: RecommendationResponse[] }`, `GapReport { reportId: string; targetRole: string; gaps: SkillGapItem[]; createdAt?: string }` — note `createdAt` is optional (`string | undefined`) because the backend ReportResponse DTO does not currently include it; typing it as optional makes the type forward-compatible if the backend adds it later and prevents TypeScript errors when T008 conditionally renders it
- [X] T003 [P] Create `frontend/services/skillGap.ts` — add import `import { DocumentPickerAsset } from 'expo-document-picker'` at the top (this is the correct type from the installed package); reuse the `request<T>()` fetch pattern from `services/career.ts`; implement three exported functions: (1) `analyseCV(token: string, asset: DocumentPickerAsset, targetRole: string): Promise<GapReport>` — builds `FormData` with `{ uri: asset.uri, name: asset.name, type: asset.mimeType }` and `targetRole`, POSTs to `/skill-gap/analyse` with `Authorization` header only (NO `Content-Type` — let fetch set the multipart boundary); (2) `getReports(token: string): Promise<GapReport[]>` — GET `/skill-gap/reports`; (3) `getReport(token: string, reportId: string): Promise<GapReport>` — GET `/skill-gap/reports/${reportId}`; all three throw `{ status: number; message: string }` on non-ok responses

**Checkpoint**: Types and service layer complete — screen implementation can now begin.

---

## Phase 2: Foundational — Navigation Wiring (Requires Phase 1)

**Purpose**: Wire the expo-router navigation structure before writing screen content. Both user stories depend on the tab and stack being registered.

**⚠️ CRITICAL**: Phase 3 and Phase 4 screens cannot be navigated to until this phase is complete.

- [X] T004 Create `frontend/app/(app)/gap-report/_layout.tsx` — default export a `<Stack screenOptions={{ headerShown: false }} />` component; this registers the `gap-report/` sub-directory as a Stack navigator nested inside the Skills tab so that `gap-report/[reportId].tsx` becomes a push-able route
- [X] T005 Update `frontend/app/(app)/_layout.tsx` — add a 5th `<Tabs.Screen>` entry: `name="skill-gap"`, `title="Skills"`, `tabBarIcon` using the existing `TabIcon` helper with `name="analytics-outline"` and `focusedName="analytics"`; also add a screen entry for `name="gap-report"` with `options={{ href: null, tabBarStyle: { display: 'none' } }}` — `href: null` hides it from the tab bar and `tabBarStyle: { display: 'none' }` ensures the bottom tab bar is hidden when the user navigates into the gap-report Stack (standard mobile UX for detail screens); follow the existing pattern for all other tabs in this file

**Checkpoint**: Skills tab visible in bottom navigation; `router.push('/gap-report/some-id')` resolves without a "no route" error; the tab bar is hidden on the Gap Report detail screen.

---

## Phase 3: User Story 1 — CV Upload & Analysis (Priority: P1) 🎯 MVP

**Goal**: Student can upload a CV, trigger analysis, watch a loading state, and land on a populated Gap Report screen.

**Independent Test**: Log in, open Skills tab, pick a PDF, enter "Software Engineer", tap "Analyse CV" → loading state appears → Gap Report screen opens with at least one ranked skill gap and recommendation after the backend responds.

### Implementation for User Story 1

- [X] T006 [P] [US1] Create `frontend/app/(app)/gap-report/[reportId].tsx` — full detail screen: (1) get `reportId` via `useLocalSearchParams<{ reportId: string }>()`; (2) call `getReport(token, reportId)` on mount; (3) render a custom header row with a `TouchableOpacity` back button (`router.back()`) on the left and `targetRole` + gap count subtitle on the right using `colors`, `typography`, `spacing` from `@/constants/theme`; (4) render a `ScrollView` with one card per `SkillGapItem` sorted ascending by `importanceRank`; each card contains: a rank badge view (`#N` text in a circle using `colors.secondary`), `skillName` in `typography.headlineSm`, `description` in `typography.bodyMd`, a horizontal divider, then one `RecommendationRow` per recommendation; `RecommendationRow` shows the type icon from a local `RESOURCE_TYPE_CONFIG` map (`COURSE` → `school-outline`/`colors.tertiary`, `BOOK` → `book-outline`/`colors.secondary`, `PROJECT` → `code-slash-outline`/`colors.primary`, default → `link-outline`/`colors.onSurfaceVariant`), `title` text, and a link `TouchableOpacity` that calls `Linking.openURL(url)` — hidden (not rendered) when `url` is null; (5) handle loading state with `ActivityIndicator` and error state with an inline error text + retry button
- [X] T007 [P] [US1] Create `frontend/app/(app)/skill-gap.tsx` — upload section only in this task (history section added in T008): (1) `usePulse()` animation hook (copy from `app/(app)/roadmap.tsx`); (2) state: `pickedFile` (DocumentPickerAsset | null), `targetRole` (string), `isAnalysing` (boolean), `analyseError` (string | null); (3) file picker card — `TouchableOpacity` that calls `DocumentPicker.getDocumentAsync(...)` wrapped in a `try/catch`: inside the try, call `getDocumentAsync({ type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], copyToCacheDirectory: true })`, when `result.canceled` do nothing, otherwise set `pickedFile = result.assets[0]`; in the catch, set `analyseError = 'Could not open file picker. Check storage permissions.'`; (4) once picked, show the file name in the picker card; (5) `TextInput` for `targetRole` with `placeholder="e.g. Backend Developer"`; (6) "Analyse CV" `TouchableOpacity` — disabled (reduced opacity) when `!pickedFile || !targetRole.trim()`; on press: guard with `if (!token) return` before calling the service, then set `isAnalysing=true`, clear `analyseError`, call `analyseCV(token, pickedFile, targetRole)`, on success call `router.push(`/gap-report/${report.reportId}`)` and clear `pickedFile`, on error set `analyseError` with the `error.message` string, always set `isAnalysing=false` in a finally block; (7) when `isAnalysing=true`, replace the upload section with a pulsing card (using `usePulse()` Animated opacity) showing "Analysing your CV…" and "This may take 15–30 seconds"; (8) when `analyseError` is set, show an inline error view below the button with `colors.error` text; wrap everything in `SafeAreaView` + `ScrollView` using theme tokens

**Checkpoint**: US1 complete — student can upload CV, see loading state, and land on a populated Gap Report screen with ranked gaps and recommendation links.

---

## Phase 4: User Story 2 — Report History & Browsing (Priority: P2)

**Goal**: Student can view their past analyses from the Skills tab and navigate to any prior report.

**Independent Test**: With an existing report in the backend, reload the Skills tab → "Past Analyses" section appears with the report's target role and date; tap "View →" → Gap Report screen loads that report via GET `/skill-gap/reports/{reportId}`.

### Implementation for User Story 2

- [X] T008 [US2] Update `frontend/app/(app)/skill-gap.tsx` — add the history section below the upload section: (1) new state: `reports` (GapReport[]), `isLoadingHistory` (boolean), `historyError` (string | null); (2) `useEffect` on mount that guards with `if (!token) return` then calls `getReports(token)`, sets `reports` on success, sets `historyError` on failure; also add a `handleRefresh` callback (wrapped in `useCallback`) that re-calls `getReports` and pass it to `RefreshControl` on the `ScrollView` so the user can pull-to-refresh the history list; (3) below the upload/loading section, render a section header "Past Analyses"; (4) when `isLoadingHistory=true`, show an `ActivityIndicator`; (5) when `reports.length === 0` and not loading, show an empty state card with text "No past analyses yet"; (6) map `reports` to `ReportRow` components — each shows `targetRole` in `typography.labelMd`, `report.createdAt ? new Date(report.createdAt).toLocaleDateString() : ''` for the date (renders an empty string when the field is absent, since `createdAt` is typed as optional on `GapReport`), gap count ("N gaps"), and a "View →" `TouchableOpacity` that calls `router.push(`/gap-report/${report.reportId}`)`; use `colors`, `typography`, `spacing`, `radius` from `@/constants/theme`

**Checkpoint**: US1 and US2 both independently functional. Student can upload, view results, and browse all past analyses.

---

## Phase 5: Polish & Cross-Cutting Concerns (All [P])

**Purpose**: Home screen integration and environment setup.

- [X] T009 [P] Update `frontend/app/(app)/index.tsx` — locate the `ComingSoonCard` with title matching "Skill" or "Gap Analysis" (check the existing `comingSoonCards` array or equivalent); replace it with a `QuickLink` component (already defined in the same file) pointing to `/(app)/skill-gap` with icon `analytics-outline` and label `"Skills"` using `colors.secondary`; follow the existing `QuickLink` usage pattern in the file
- [X] T010 [P] Verify `frontend/.env.example` exists and contains `EXPO_PUBLIC_API_URL=http://localhost:8080`; if the file does not exist, create it with that line and a comment `# Gateway URL for local development`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T002 and T003 can run in parallel
- **Phase 2 (Foundational)**: Depends on Phase 1 completion — BLOCKS Phase 3 and Phase 4
- **Phase 3 (US1)**: Depends on Phase 2; T006 and T007 can run in parallel (different files)
- **Phase 4 (US2)**: Depends on Phase 3 (T008 updates skill-gap.tsx started in T007)
- **Phase 5 (Polish)**: Depends on Phase 4; T009 and T010 run in parallel

### User Story Dependencies

- **US1 (P1)**: Independently testable after Phase 3
- **US2 (P2)**: Extends `skill-gap.tsx` from US1; depends on T007 being complete

### Within Phase 3

```
T002 types/skillGap.ts  ──┐
T003 services/skillGap.ts─┤
T004 gap-report/_layout ──┤─→ T006 gap-report/[reportId].tsx  (parallel)
T005 _layout.tsx update ──┘─→ T007 skill-gap.tsx upload section (parallel)
```

### Parallel Opportunities

```bash
# Phase 1 — run together:
T002 types/skillGap.ts  &  T003 services/skillGap.ts

# Phase 3 — run together after Phase 2:
T006 gap-report/[reportId].tsx  &  T007 skill-gap.tsx

# Phase 5 — run together:
T009 index.tsx update  &  T010 .env.example
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Navigation Wiring (T004–T005)
3. Complete Phase 3: User Story 1 (T006–T007)
4. **STOP and VALIDATE**: Upload a CV → loading state → Gap Report screen → ranked gaps with links
5. Optionally demo: `npx expo start --ios`

### Incremental Delivery

1. Setup + Foundational → Skills tab appears, navigation resolves
2. US1 (Phase 3) → CV upload → analysis → Gap Report screen → **MVP**
3. US2 (Phase 4) → Past Analyses list, browse history
4. Polish (Phase 5) → Home screen quick link wired up

---

## Notes

- [P] = different files, no dependencies — safe to implement concurrently
- [US1]/[US2] = user story ownership for traceability
- **Do NOT set `Content-Type: multipart/form-data`** in `analyseCV` — React Native's fetch sets the multipart boundary automatically; setting it manually breaks the request (see research.md §2)
- **`copyToCacheDirectory: true`** is required in `DocumentPicker.getDocumentAsync` for Android file URI access (see research.md §1)
- T008 updates the same file as T007 — these MUST run sequentially; complete T007 fully before starting T008
- `GapReport.createdAt` is typed as `string | undefined` (optional) — the backend ReportResponse does not include it today; the optional type prevents TypeScript errors and makes T008's date rendering safe (`report.createdAt ? ... : ''`)
- Constitution Principle IV (test coverage) is acknowledged — component tests can be added post-MVP following the same `@testing-library/react-native` patterns used in the rest of the frontend
