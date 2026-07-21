# Quickstart: Challenge Service

End-to-end validation guide. Prereq: repo root, `.env` populated (shared `JWT_SECRET`,
Postgres creds), Docker running.

## 1. Build & start

```bash
docker-compose up --build challenge-service postgres
# gateway if you want to go through nginx:
docker-compose up --build gateway
```

Expected: Flyway runs V1–V3 cleanly; `GET http://localhost:8007/challenge/health` →
`{"status":"UP"}` (also via gateway: `http://localhost:8080/challenge/health`).

## 2. Get tokens

Use existing auth-service to register/login two users: one STUDENT, one RECRUITER
(role chosen at registration). Keep both tokens.

```bash
TOKEN_STUDENT=...
TOKEN_RECRUITER=...
```

## 3. Recruiter posts a challenge (US1)

```bash
curl -X POST http://localhost:8080/challenge \
  -H "Authorization: Bearer $TOKEN_RECRUITER" -H "Content-Type: application/json" \
  -d '{
    "title": "Build a Fraud Detection API",
    "description": "Design and implement an API that flags fraudulent mobile-money transactions",
    "submissionFormat": "GitHub repository link with a README explaining your approach",
    "deadline": "2026-12-31T23:59:00Z"
  }'
```

Expected: 201, `active: true`, `submissionCount: 0`.
Negative checks: same call with `$TOKEN_STUDENT` → 403; blank `title` → 400;
blank `submissionFormat` → 400; missing `deadline` → 400; past `deadline` → 400.

## 4. Student browses challenges (US2)

```bash
curl http://localhost:8080/challenge \
  -H "Authorization: Bearer $TOKEN_STUDENT"
```

Expected: 200; the §3 challenge present, newest first, `submitted: false`.
No auth header → 401.

## 5. Student submits a solution (US3)

```bash
curl -X POST http://localhost:8080/challenge/{id}/submissions \
  -H "Authorization: Bearer $TOKEN_STUDENT" -H "Content-Type: application/json" \
  -d '{"submissionUrl": "https://github.com/student/fraud-detection-api"}'
```

Expected: 201 with `submittedAt`, `score: null`. Repeat → 409. Re-fetch §4 →
`submitted: true`. Malformed URL (`"not-a-url"`) → 400. Bogus challenge id → 404.
With `$TOKEN_RECRUITER` → 403.

Register/Use a second STUDENT and submit too (needed for the leaderboard tie-break in §7).

```bash
TOKEN_STUDENT2=...
# submit with TOKEN_STUDENT2 — note it is submitted AFTER the first student's
```

## 6. Student views own submissions (US4)

```bash
curl http://localhost:8080/challenge/my-submissions \
  -H "Authorization: Bearer $TOKEN_STUDENT"
```

Expected: 200 array, newest first, entry contains challenge summary + `score: null`.

## 7. Recruiter scores; leaderboard ranks (US5, US6)

```bash
curl http://localhost:8080/challenge/{id}/submissions \
  -H "Authorization: Bearer $TOKEN_RECRUITER"          # → both submissions, score: null

curl -X POST http://localhost:8080/challenge/{id}/submissions/{sub1}/score \
  -H "Authorization: Bearer $TOKEN_RECRUITER" -H "Content-Type: application/json" \
  -d '{"score": 85.50}'

curl -X POST http://localhost:8080/challenge/{id}/submissions/{sub2}/score \
  -H "Authorization: Bearer $TOKEN_RECRUITER" -H "Content-Type: application/json" \
  -d '{"score": 85.50}'
```

```bash
curl http://localhost:8080/challenge/{id}/leaderboard \
  -H "Authorization: Bearer $TOKEN_STUDENT"
```

Expected: two entries, both `85.50` — **the first student's submission ranks 1** (equal
scores → earlier `submittedAt` wins, FR-009). Hand-check the ordering rule (SC-007).

Negative checks: score `101` → 400; score `-1` → 400; score `85.555` (> 2 decimal
places) → 400; score with `$TOKEN_STUDENT` → 403; a second recruiter token scoring or
listing submissions for this challenge → 404. Re-score `{sub2}` with `95.00` →
leaderboard re-fetch shows student 2 at rank 1 (upsert takes effect immediately,
research Decision 1).

## 8. Recruiter manages challenges (US7)

```bash
curl http://localhost:8080/challenge/mine \
  -H "Authorization: Bearer $TOKEN_RECRUITER"          # → own challenges, submissionCount: 2

curl -X POST http://localhost:8080/challenge/{id}/deactivate \
  -H "Authorization: Bearer $TOKEN_RECRUITER"          # → 200, active: false
```

After deactivate: `GET /challenge` no longer lists it; new submissions → 404;
`GET /challenge/my-submissions` still shows prior submissions (history preserved);
`GET /challenge/{id}/leaderboard` still returns the ranked entries. Second deactivate →
200 (idempotent). A second recruiter token calling §7–§8 endpoints on this id → 404.
Scoring a submission on the now-deactivated challenge still returns 200 (evaluation
happens after the window closes — FR-007).

## 9. Mobile QA (manual)

1. Log in as STUDENT in the app → Home → "Challenges" QuickLink.
2. Challenge list shows the §3 challenge; expand → detail + submissionFormat visible.
3. Submit a GitHub URL → button flips to "Submitted" (optimistic), toast confirms.
4. "My Submissions" section lists the entry with "Score pending".
5. Log in as RECRUITER → same QuickLink → manage screen: post a new challenge, see it in
   "My Challenges" with submission count, open submissions, assign scores, deactivate →
   disappears from the student browse list.

## 10. Coverage gate

```bash
cd backend/challenge-service && ./mvnw verify
```

Expected: all tests green; JaCoCo line coverage ≥ 70% (`target/site/jacoco/index.html`).
