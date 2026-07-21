---
description: "Task list for Delete Past Analysis feature"
---

# Tasks: Delete Past Analysis

**Input**: Design documents from `/specs/003-delete-analysis/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Organization**: Tasks grouped by foundational backend (blocks both stories) → US1 (list screen) → US2 (detail screen) → polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase
- **[Story]**: US1 = delete from list screen (P1), US2 = delete from detail screen (P2)

---

## Phase 1: Foundational — Backend Service + Endpoint

**Purpose**: Implement the shared `DELETE /skill-gap/reports/{reportId}` endpoint. Both US1 and US2 call the same endpoint, so this phase must complete before any frontend work.

**⚠️ CRITICAL**: No frontend task can begin until T001–T003 are complete.

- [X] T001 Add `void deleteReport(UUID reportId, UUID userId)` to the service interface in `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/service/SkillGapService.java`
- [X] T002 Implement `deleteReport` in `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/service/SkillGapServiceImpl.java` — annotate `@Transactional`; call `gapReportRepository.findByIdAndUserId(reportId, userId).orElseThrow(() -> new ReportNotFoundException(reportId))`; save `CvUpload cvUpload = report.getCvUpload()`; call `gapReportRepository.delete(report)` (cascades to skill_gaps and resource_recommendations); then call `cvUploadRepository.delete(cvUpload)`
- [X] T003 Add `@DeleteMapping("/reports/{reportId}")` handler to `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/controller/SkillGapController.java` — inject `@PathVariable UUID reportId` and `@AuthenticationPrincipal JwtUserDetails principal`; call `skillGapService.deleteReport(reportId, principal.userId())`; return `ResponseEntity.noContent().build()` (204 No Content)
- [X] T004 [P] Add `deleteReport` unit tests to `backend/skill-gap-service/src/test/java/com/skillbridge/skillgap/service/SkillGapServiceTest.java` — 3 tests: (1) happy path: mock `findByIdAndUserId` returns report, verify `gapReportRepository.delete(report)` and `cvUploadRepository.delete(cvUpload)` are both called; (2) report not found: mock `findByIdAndUserId` returns `Optional.empty()`, assert `ReportNotFoundException` is thrown; (3) wrong userId: mock `findByIdAndUserId(reportId, wrongUserId)` returns `Optional.empty()`, assert `ReportNotFoundException` is thrown (same result as not found — ownership is hidden)
- [X] T005 [P] Add DELETE endpoint tests to `backend/skill-gap-service/src/test/java/com/skillbridge/skillgap/controller/SkillGapControllerTest.java` — 2 tests: (1) `DELETE /skill-gap/reports/{uuid}` with valid principal → mock service does nothing → expect HTTP 204 with empty body; (2) `DELETE /skill-gap/reports/{uuid}` → mock service throws `ReportNotFoundException` → expect HTTP 404 with `{ "error": "...", "status": 404 }`

**Checkpoint**: Run `cd backend/skill-gap-service && ./mvnw test` — all tests must pass before moving to frontend.

---

## Phase 2: User Story 1 — Delete from List Screen (Priority: P1) 🎯 MVP

**Goal**: Users can delete any report from the "Past Analyses" list on the Skills tab.

**Independent Test**: Open Skills tab → tap trash icon on any row → confirm dialog → row disappears immediately. Pull to refresh confirms the backend deleted it (row still absent).

### Implementation for User Story 1

- [X] T006 [US1] Add `deleteReport` function to `frontend/services/skillGap.ts` — use direct `fetch` (NOT the `request<T>` helper, which calls `res.json()` and would fail on a 204 empty body): `const res = await fetch(\`${BASE_URL}/skill-gap/reports/${reportId}\`, { method: 'DELETE', headers: { Authorization: \`Bearer ${token}\` } })`; if `!res.ok` throw `{ status: res.status, message: body.error ?? 'Delete failed' }`; return type is `Promise<void>`
- [X] T007 [US1] Update `frontend/app/(app)/skill-gap.tsx`:
  - Add `useFocusEffect` to the import from `expo-router` (already imports `router`)
  - Add `Alert` to the React Native imports
  - Add `import { deleteReport } from '@/services/skillGap'`
  - Add `const [deletingId, setDeletingId] = useState<string | null>(null)` state
  - Replace the `useEffect(() => { loadReports(); }, [loadReports])` with `useFocusEffect(useCallback(() => { loadReports(); }, [loadReports]))` — this ensures the list refreshes every time the Skills tab gains focus (required for US2 post-delete refresh)
  - Add `handleDelete` async function: (1) call `Alert.alert('Delete Analysis', \`This will permanently remove the gap analysis for "${report.targetRole}". This cannot be undone.\`, [{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:async()=>{...}}])`; inside onPress: (2) `setDeletingId(report.reportId)`; (3) `setReports(prev => prev.filter(r => r.reportId !== report.reportId))` (optimistic remove); (4) call `await deleteReport(token!, report.reportId)` in try/catch; (5) on catch: restore with `setReports(prev => [...prev, report].sort(...))` and set `historyError` to error message; (6) `setDeletingId(null)` in finally
  - Update `ReportRow` component: add `onDelete: () => void` and `isDeleting: boolean` props; add trash icon `<TouchableOpacity onPress={onDelete} disabled={isDeleting}><Ionicons name="trash-outline" size={16} color={isDeleting ? colors.outline : colors.error} /></TouchableOpacity>` to the right side; add `deleteBtn` and `deleteBtnDisabled` styles
  - Update `ReportRow` usage in the list: pass `onDelete={() => handleDelete(report)}` and `isDeleting={deletingId === report.reportId}`

**Checkpoint**: US1 fully functional — trash icon appears on each row, confirmation dialog works, optimistic removal works, pull-to-refresh confirms the delete persisted.

---

## Phase 3: User Story 2 — Delete from Detail Screen (Priority: P2)

**Goal**: Users can delete the report they are currently viewing from the detail screen header.

**Independent Test**: Open any report → tap trash icon in header → confirm → app navigates back to Skills tab → report is absent from the list. Error case: simulate API failure → app stays on detail screen, shows error message.

### Implementation for User Story 2

- [X] T008 [US2] Update `frontend/app/(app)/gap-report/[reportId].tsx`:
  - Add `Alert` to the React Native imports
  - Add `import { deleteReport } from '@/services/skillGap'` (T006 must be complete)
  - Add `const [isDeleting, setIsDeleting] = useState(false)` state
  - Add `handleDelete` async function: (1) `Alert.alert('Delete Analysis', ...)` with Cancel + Delete buttons; inside Delete onPress: (2) `setIsDeleting(true)`; (3) call `await deleteReport(token!, reportId)` in try/catch; (4) on success: `router.navigate('/(app)/skill-gap')` — the `useFocusEffect` on the list screen (added in T007) will refresh the list; (5) on catch: `setError(e.message ?? 'Failed to delete report')` and `setIsDeleting(false)` (do NOT navigate on failure — user stays on detail screen)
  - Add trash icon `TouchableOpacity` to the header row in the JSX, to the right of the existing `headerText` view: `<TouchableOpacity onPress={handleDelete} disabled={isDeleting || isLoading} style={styles.deleteBtn} activeOpacity={0.7}><Ionicons name="trash-outline" size={20} color={isDeleting ? colors.outline : colors.error} /></TouchableOpacity>`
  - Add `deleteBtn` style: `{ padding: spacing.xs }`

**Checkpoint**: US1 and US2 both work — deleting from list or from detail both removes the report; detail-screen error shows inline error without navigating.

---

## Phase 4: Polish & Verification

**Purpose**: Confirm test coverage and run the full quickstart validation.

- [X] T009 Run `cd backend/skill-gap-service && ./mvnw test` from repo root — all tests must pass and JaCoCo line coverage must be ≥ 70%; if coverage drops, add targeted tests to the weakest class (check the JaCoCo HTML report at `target/site/jacoco/index.html`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Backend)**: No dependencies — start immediately
- **Phase 2 (US1)**: Depends on T001–T003 complete (service + endpoint must exist); T006 and T007 are sequential (T007 imports from T006)
- **Phase 3 (US2)**: Depends on T006 complete (shares the `deleteReport` service function); T008 is independent of T007
- **Phase 4 (Polish)**: Depends on T004 and T005 complete

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 1 backend only; no dependency on US2
- **US2 (P2)**: Depends on T006 (deleteReport function from US1); independent of T007 (different file)

### Within Each Phase

- T001 → T002 → T003 (sequential: interface → impl → controller)
- T004 [P] and T005 [P] can run simultaneously after T003
- T006 → T007 (T007 imports deleteReport from T006)
- T008 depends on T006; can be worked on after T006 (parallel with T007 if needed)

---

## Parallel Opportunities

```
Phase 1 (sequential): T001 → T002 → T003
                                         ├── T004 [P] (service tests)
                                         └── T005 [P] (controller tests)

Phase 2: T006 → T007 (US1 sequential — T007 imports from T006)

Phase 3: T008 (US2 — depends on T006, independent of T007)
         ↳ Can start T008 immediately after T006 (in parallel with T007 if needed)

Phase 4: T009 (after T004 + T005)
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: T001 → T002 → T003
2. Run tests: T004 + T005
3. Complete US1: T006 → T007
4. **STOP and VALIDATE**: Use quickstart.md scenarios 1–5 + 7 (skip scenario 6 which is US2)

### Full Delivery

1. MVP scope above
2. Complete US2: T008
3. Full quickstart.md validation: all 7 scenarios

---

## Notes

- No Flyway migration needed — existing JPA cascades handle all child row deletion
- The `deleteReport` frontend function uses direct `fetch` (not `request<T>`) because 204 has no response body to parse
- `useFocusEffect` on the list screen (added in T007) is what makes US2 post-delete refresh work — without it, the deleted report would remain visible after navigating back
- `@Transactional` on `deleteReport` ensures the two-step delete (GapReport then CvUpload) is atomic — a failure between the two leaves no orphaned rows
