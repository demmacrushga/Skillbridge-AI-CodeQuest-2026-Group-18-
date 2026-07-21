# Feature Spec: Delete Past Analysis

**Feature ID**: 003  
**Branch**: `feat/delete-analysis`  
**Status**: Planning

## Problem Statement

Users accumulate gap analysis reports over time (each CV upload creates one). There is currently no way to remove reports they no longer want. This creates clutter in the "Past Analyses" list and leaves unwanted data in the system.

## User Stories

### US1 — Delete a report from the history list (P1)

**As a** student,  
**I want** to delete a past analysis from the Skills screen,  
**So that** I can remove analyses that are outdated or irrelevant from my history.

**Acceptance criteria:**
- Each row in "Past Analyses" shows a delete icon/button.
- Tapping the delete icon shows a confirmation dialog: "Delete Analysis? This will permanently remove the gap analysis for [targetRole]. This cannot be undone."
- The delete icon is disabled while its API call is in-flight (prevents double-tap).
- Confirming the dialog removes the report from the list immediately (optimistic update).
- Cancelling the dialog leaves the list unchanged.
- If the API call fails, the report is restored to the list and an error message is shown.
- The backend returns 204 No Content on success.
- A user cannot delete another user's report (ownership enforced on backend).

### US2 — Delete a report from within the report detail screen (P2)

**As a** student viewing a gap report,  
**I want** to delete the report I'm currently viewing,  
**So that** I don't have to go back to the list to remove it.

**Acceptance criteria:**
- The report detail screen (`gap-report/[reportId].tsx`) has a delete button in the header.
- Tapping it shows the same confirmation dialog as US1.
- The delete button is disabled while the API call is in-flight (prevents double-tap).
- Confirming calls the API; on success the app navigates to the Skills tab.
- The Skills tab list refreshes on focus and no longer shows the deleted report.
- If the API call fails, the app stays on the detail screen and shows an inline error.
- Ownership enforced on backend (same endpoint as US1).

## Out of Scope

- Soft delete (a hard delete is sufficient for v1).
- Bulk delete.
- Deleting a report from within its detail view while offline.

## Success Criteria

1. `DELETE /skill-gap/reports/{reportId}` returns 204 for the owning user.
2. `DELETE /skill-gap/reports/{reportId}` returns 404 for a non-existent or other user's report.
3. Deleting a report removes its `skill_gaps` and `resource_recommendations` rows via cascade.
4. Deleting a report also removes the associated `cv_uploads` row.
5. The frontend removes the row from state immediately after confirmation.
6. Unit and integration tests cover the happy path, 404, and forbidden scenarios.
