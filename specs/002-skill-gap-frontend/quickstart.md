# Quickstart: Skill Gap Frontend Validation

**Feature**: `002-skill-gap-frontend`
**Date**: 2026-06-25

---

## Prerequisites

1. Backend services running (postgres + auth-service + skill-gap-service + nginx):
   ```bash
   docker-compose up postgres auth-service skill-gap-service gateway
   ```
2. `EXPO_PUBLIC_API_URL=http://localhost:8080` set in `frontend/.env.local`
3. A registered student account (use the auth screens or curl to register)
4. A PDF or DOCX CV file on your device (or in the simulator's Files app)

---

## Install New Dependency

```bash
cd frontend
npx expo install expo-document-picker
```

---

## Start the App

```bash
cd frontend
npx expo start --ios     # or --android
```

---

## Validation Scenarios

### Scenario 1: Full Analysis Flow (US1 happy path)

1. Log in as a student
2. Tap the **Skills** tab in the bottom navigation
3. Tap **Browse CV** → device file picker opens
4. Select a PDF (< 5MB)
5. Type `Software Engineer` in the Target Role field
6. Tap **Analyse CV**
7. **Expected**: Loading state appears ("Analysing your CV...")
8. Wait 10–30 seconds
9. **Expected**: Gap Report screen opens, showing "Software Engineer" as the header, with 3–7 ranked skill gaps, each with a description and recommendations

### Scenario 2: Error — File Too Large (US1 error path)

1. Try to pick a PDF larger than 5MB
2. **Expected**: `expo-document-picker` filter by size — OR backend returns 413 which the app displays as "File exceeds the 5MB limit"

### Scenario 3: Error — AI Unavailable (US1 error path)

1. Stop the skill-gap-service container: `docker stop skillbridge-skill-gap`
2. Submit a CV analysis
3. **Expected**: Inline error message "AI analysis failed, please try again" (no crash)

### Scenario 4: Past Reports List (US2)

1. After completing Scenario 1, go back to the Skills tab
2. **Expected**: "Past Analyses" section shows the report with target role and date
3. Tap the report row
4. **Expected**: Gap Report screen opens with the previously generated report

### Scenario 5: Empty State

1. Log in as a NEW student (no prior analyses)
2. Navigate to the Skills tab
3. **Expected**: Empty state shown ("Upload your CV to get started") with no past reports section visible, or a "No past analyses yet" message

### Scenario 6: Recommendation URL

1. View a Gap Report
2. Tap a recommendation that has a URL
3. **Expected**: Device browser opens with the URL

---

## API Verification (curl)

After login, get your access token and verify the API directly:

```bash
# Substitute your token:
TOKEN="eyJ..."

# List reports (should be empty initially):
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/skill-gap/reports

# Upload a CV (substitute your file path):
curl -X POST http://localhost:8080/skill-gap/analyse \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/cv.pdf;type=application/pdf" \
  -F "targetRole=Backend Developer"
```

---

## Expected Response Shape

See `contracts/skill-gap-api.md` for full response shapes. At minimum, the analyse response should contain `reportId`, `targetRole`, and a non-empty `gaps` array.
