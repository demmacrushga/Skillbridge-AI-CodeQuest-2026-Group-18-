# Quickstart: Delete Past Analysis

## Prerequisites

- Docker Compose running (`docker-compose up` from repo root)
- A valid JWT token for a test user
- At least one existing gap report for that user (run a CV analysis first if needed)

## Backend validation

### 1. Delete a report (happy path)

```bash
# Step 1: Get the list of reports to find a reportId
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost/skill-gap/reports | jq '.[0].reportId'

# Step 2: Delete that report
curl -i -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost/skill-gap/reports/<reportId>

# Expected: HTTP/1.1 204 No Content (empty body)
```

### 2. Verify cascade deletion

```bash
# After delete, confirm the report is gone
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost/skill-gap/reports/<reportId>

# Expected: 404 { "error": "Report not found: <reportId>", "status": 404 }

# Optionally verify in DB: skill_gaps and resource_recommendations rows for this
# report should also be absent (connect via DbGate at localhost:3000)
```

### 3. Ownership enforcement

```bash
# Attempt to delete a report belonging to a different user
curl -i -X DELETE \
  -H "Authorization: Bearer $OTHER_USER_TOKEN" \
  http://localhost/skill-gap/reports/<reportId>

# Expected: 404 (not 403 — ownership is hidden)
```

### 4. Run the test suite

```bash
cd backend/skill-gap-service
./mvnw test

# Expected: all tests pass, JaCoCo coverage ≥ 70%
```

## Frontend validation

### 5. Delete from list screen (US1)

1. Open the app and navigate to the **Skills** tab.
2. Ensure "Past Analyses" shows at least one row.
3. Tap the delete icon (trash) on any row.
4. Verify a confirmation dialog appears: *"Delete Analysis? This will permanently remove the gap analysis for [targetRole]. This cannot be undone."*
5. Tap **Cancel** → dialog dismisses, row remains.
6. Tap the delete icon again → tap **Delete** → row disappears immediately from the list.
7. Pull to refresh → row is still absent (confirms the backend deleted it).

### 6. Delete from detail screen (US2)

1. Tap any row in "Past Analyses" to open the report detail screen.
2. Tap the trash icon in the header.
3. Tap **Cancel** → verify dialog dismisses, you remain on the detail screen.
4. Tap the trash icon again → tap **Delete**.
5. Verify the app navigates back to the Skills tab.
6. Verify the deleted report is no longer in the list (the list refreshes on focus via `useFocusEffect`).
7. Error case: simulate API failure, confirm the dialog → verify the app stays on the detail screen and shows an inline error message (does NOT navigate).

### 7. Error recovery (network failure simulation)

1. Enable airplane mode (or stop the Docker containers).
2. Tap the delete icon on a report row and confirm.
3. Verify the row reappears (state rollback) and an error message is shown.

## Notes

- No DB migrations need to be run for this feature.
- The `cv_uploads` record for the deleted report is also removed (see data-model.md).
- All new tests live in `SkillGapServiceTest.java` and `SkillGapControllerTest.java` — no new test files are needed.
