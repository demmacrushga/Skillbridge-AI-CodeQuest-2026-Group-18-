# Quickstart: Matching Service

End-to-end validation guide. Prereq: repo root, `.env` populated (shared `JWT_SECRET`,
Postgres creds), Docker running.

## 1. Build & start

```bash
docker-compose up --build matching-service postgres
# gateway if you want to go through nginx:
docker-compose up --build gateway
```

Expected: Flyway runs V1–V4 cleanly; `GET http://localhost:8006/matching/health` →
`{"status":"UP"}` (also via gateway: `http://localhost:8080/matching/health`).

## 2. Get tokens

Use existing auth-service to register/login two users: one STUDENT, one RECRUITER
(role chosen at registration). Keep both tokens.

```bash
TOKEN_STUDENT=...
TOKEN_RECRUITER=...
```

## 3. Recruiter posts an opportunity (US1)

```bash
curl -X POST http://localhost:8080/matching/opportunities \
  -H "Authorization: Bearer $TOKEN_RECRUITER" -H "Content-Type: application/json" \
  -d '{
    "title": "Software Engineering Intern",
    "companyName": "Hubtel",
    "description": "Backend team, payment APIs",
    "location": "Accra",
    "opportunityType": "INTERNSHIP",
    "deadline": "2026-12-31",
    "requiredSkills": [
      {"skillName": "Java", "required": true},
      {"skillName": "Spring Boot", "required": true},
      {"skillName": "PostgreSQL", "required": false}
    ]
  }'
```

Expected: 201, `active: true`, `applicantCount: 0`.
Negative checks: same call with `$TOKEN_STUDENT` → 403; blank `title` → 400;
`"opportunityType": "internship"` → 400; `"requiredSkills": []` → 400;
`"deadline": "2020-01-01"` → 400 (today is valid); `"externalUrl": "not-a-url"` → 400.

**External variant**: re-POST the same body plus
`"externalUrl": "https://hubtel.com/careers/se-intern-2026"` → 201 echoes the URL.
Applying to that posting in §6 returns `externalUrl` in the 201 response — the client
opens it; the application is recorded identically.

## 4. Student sets skill profile (US5)

```bash
curl -X PUT http://localhost:8080/matching/profile/skills \
  -H "Authorization: Bearer $TOKEN_STUDENT" -H "Content-Type: application/json" \
  -d '{"skills": ["Java", "Spring Boot"]}'
```

Expected: 200 `{"skills":["Java","Spring Boot"]}`.
`GET /matching/profile/skills` returns the same.

## 5. Student views ranked matches (US2)

```bash
curl http://localhost:8080/matching/opportunities \
  -H "Authorization: Bearer $TOKEN_STUDENT"
```

Expected: 200; the §3 opportunity present with
`matchScore = 100 × (2+2)/(2+2+1) = 80.00`, `rank: 1`, `applied: false`.
Hand-check the score per the formula in `research.md` Decision 1 (SC-007).

Post a second opportunity with a must-have the student lacks (e.g. `{"skillName": "Kotlin",
"required": true}`); re-fetch: first opportunity still ranks above it.

## 6. Student applies (US3) and views applications (US4)

```bash
curl -X POST http://localhost:8080/matching/opportunities/{id}/apply \
  -H "Authorization: Bearer $TOKEN_STUDENT"
```

Expected: 201 with `appliedAt`. Repeat → 409. Re-fetch §5 → `applied: true`.
`GET /matching/applications` → array containing the opportunity, newest first.

Apply with `$TOKEN_RECRUITER` → 403. Apply to a bogus id → 404.

## 7. Recruiter manages postings (US6)

```bash
curl http://localhost:8080/matching/opportunities/mine \
  -H "Authorization: Bearer $TOKEN_RECRUITER"          # → own postings, applicantCount: 1

curl http://localhost:8080/matching/opportunities/{id}/applications \
  -H "Authorization: Bearer $TOKEN_RECRUITER"          # → [{studentId, appliedAt}]

curl -X POST http://localhost:8080/matching/opportunities/{id}/deactivate \
  -H "Authorization: Bearer $TOKEN_RECRUITER"          # → 200, active: false
```

After deactivate: student's `GET /matching/opportunities` no longer lists the posting;
student's `GET /matching/applications` still shows the application (history preserved).
A second recruiter token calling §7 endpoints on this id → 404.

## 8. Mobile QA (manual)

1. Log in as STUDENT in the app → Home → "Opportunities" QuickLink.
2. Tap "Edit skills", save `Java, Spring Boot` → match list shows the §3 posting with a score badge.
3. Expand the card → Apply → button flips to "Applied" (optimistic), toast confirms.
4. Switch to "My Applications" → posting listed with date.
5. Log in as RECRUITER → Home → same QuickLink → manage screen: post a new listing,
   see it in "My Postings", view its applicants, deactivate it → disappears from student matches.
6. Verify the Home screen no longer shows a "Coming Soon" section.

## 9. Coverage gate

```bash
cd backend/matching-service && ./mvnw verify
```

Expected: all tests green; JaCoCo line coverage ≥ 70% (`target/site/jacoco/index.html`).
