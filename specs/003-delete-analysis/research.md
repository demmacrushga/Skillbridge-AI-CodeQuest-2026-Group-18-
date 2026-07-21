# Research: Delete Past Analysis

## Decision 1 — HTTP method and response code

**Decision**: `DELETE /skill-gap/reports/{reportId}` → 204 No Content (empty body).  
**Rationale**: DELETE with 204 is the idiomatic REST pattern for successful deletion. A 200 with a body is also valid but adds no value here since the resource is gone.  
**Alternatives considered**: 200 with `{ "deleted": true }` — rejected, unnecessary payload.

## Decision 2 — Cascade strategy for child rows

**Decision**: Rely on the existing JPA `CascadeType.ALL` + `orphanRemoval = true` chains.  
**Chain**: `GapReport` → `SkillGap` (cascade all) → `ResourceRecommendation` (cascade all).  
**Rationale**: Both cascade relationships were already set when the service was built. Calling `gapReportRepository.delete(report)` deletes all child rows without extra SQL.  
**Alternatives considered**: Manual `DELETE FROM` queries — rejected, more code, same result.

## Decision 3 — CvUpload cleanup

**Decision**: Explicitly delete the `CvUpload` record after deleting the `GapReport`.  
**Rationale**: `GapReport` has a `@ManyToOne` FK to `CvUpload`. JPA cascade does not travel from child → parent. Since we removed file storage, the `cv_uploads` row is only metadata; leaving orphaned rows is wasteful.  
**Implementation**: In `deleteReport()`, save a reference to `cvUpload` before deleting the `GapReport`, then call `cvUploadRepository.delete(cvUpload)`.  
**Alternatives considered**: Leave `cv_uploads` rows — rejected (orphaned data with no use); add `CascadeType.REMOVE` to the `@ManyToOne` — rejected (JPA does not support cascade on `@ManyToOne`; it would also require changing the parent entity's relationship annotation, which is not appropriate here).

## Decision 4 — Ownership enforcement

**Decision**: Use the existing `findByIdAndUserId(reportId, userId)` query. If it returns empty, throw `ReportNotFoundException` (which maps to 404).  
**Rationale**: Returning 404 for both "not found" and "wrong user" is the safe pattern — it does not reveal whether a report ID exists for another user. This pattern is already used by `getReport()`.  
**Alternatives considered**: Return 403 on ownership failure — rejected (leaks report existence to other users).

## Decision 5 — Frontend update strategy

**Decision**: Optimistic removal — remove the report from local state immediately on confirmation, before the API call resolves. If the API call fails, restore the previous state and show an error.  
**Rationale**: Gives instant feedback to the user. The failure case (network error, 404 race) is rare and recoverable.  
**Alternatives considered**: Re-fetch the full list after delete — simpler but adds a network round-trip and a loading flash for a trivial state change.

## Decision 6 — US2 implementation (delete from detail screen)

**Decision**: Add a trash icon to the header of `gap-report/[reportId].tsx`. On confirm, call the API; on success, call `router.navigate('/(app)/skill-gap')`; on failure, stay on the detail screen and show an inline error (do NOT navigate). The list screen uses `useFocusEffect` to re-fetch when it regains focus, so the deleted report will be absent after the navigate-back.  
**Rationale**: Expo-router v3 uses persistent tabs — tab screens are never unmounted when navigating away. `useEffect` on the list screen does NOT re-run on re-focus; only `useFocusEffect` does. Without `useFocusEffect`, the list would show the stale deleted report after US2 navigate-back. Adding `useFocusEffect` to `skill-gap.tsx` (wrapping `loadReports`) solves this cleanly without prop-drilling or shared global state.  
**Error recovery**: US2 does NOT navigate before the API call resolves. This differs from US1's optimistic pattern — it is intentional. If we navigated first and the delete failed, the user would be on the list screen with no obvious way to see the error. Keeping the user on the detail screen until success is simpler and covers the error path naturally.  
**Alternative rejected**: Pass a deletion callback as a route param — overly complex for a tab navigation pattern. Re-mount on navigate — incorrect, expo-router v3 tabs persist.

## Decision 7 — No new Flyway migration

**Decision**: No DB schema migration is needed.  
**Rationale**: The delete operation relies solely on cascade deletes that are already wired in JPA. No columns, tables, or constraints change. The existing `V5__drop_storage_path.sql` is the current schema head.
