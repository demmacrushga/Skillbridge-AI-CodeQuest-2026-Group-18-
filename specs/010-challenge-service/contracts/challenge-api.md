# API Contract: Challenge Service

**Base**: `/challenge` via gateway (port 8080) | **Service port**: 8007
**Auth**: JWT Bearer on all endpoints except `/challenge/health`
**Errors**: uniform `{ "error": string, "status": number }` (Constitution II)

---

## 1. Post Challenge (RECRUITER)

```
POST /challenge
Authorization: Bearer <token>   (RECRUITER role required)
```

**Request**
```json
{
  "title": "Build a Fraud Detection API",
  "description": "Design and implement an API that flags fraudulent mobile-money transactions...",
  "submissionFormat": "GitHub repository link with a README explaining your approach",
  "deadline": "2026-08-15T23:59:00Z"
}
```

**Response 201** — `ChallengeResponse`
```json
{
  "id": "uuid",
  "title": "Build a Fraud Detection API",
  "description": "Design and implement an API that flags fraudulent mobile-money transactions...",
  "submissionFormat": "GitHub repository link with a README explaining your approach",
  "deadline": "2026-08-15T23:59:00Z",
  "active": true,
  "createdAt": "2026-07-18T10:00:00Z",
  "submissionCount": 0
}
```

**Errors**: 400 (blank title/description/submissionFormat, missing or past deadline),
401, 403 (non-RECRUITER)

---

## 2. Browse Active Challenges (authenticated)

```
GET /challenge
Authorization: Bearer <token>
```

Active, non-expired challenges ordered `createdAt` DESC. Returns the full eligible set —
no pagination in v1 (volume bounded by SC-002, 500 active challenges). Each entry carries
a `submitted` flag (true when the calling STUDENT already submitted; always false for
RECRUITER callers) to drive the Submit button state.

**Response 200**
```json
{
  "challenges": [
    {
      "id": "uuid",
      "title": "Build a Fraud Detection API",
      "description": "Design and implement an API that...",
      "submissionFormat": "GitHub repository link with a README...",
      "deadline": "2026-08-15T23:59:00Z",
      "createdAt": "2026-07-18T10:00:00Z",
      "submitted": false
    }
  ]
}
```

Empty list → `{ "challenges": [] }`.

**Errors**: 401

---

## 3. Submit Solution (STUDENT)

```
POST /challenge/{challengeId}/submissions
Authorization: Bearer <token>   (STUDENT role required)
```

**Request**
```json
{ "submissionUrl": "https://github.com/username/fraud-detection-api" }
```

**Response 201** — `SubmissionResponse`
```json
{
  "id": "uuid",
  "challengeId": "uuid",
  "submissionUrl": "https://github.com/username/fraud-detection-api",
  "score": null,
  "submittedAt": "2026-07-18T10:05:00Z"
}
```

One submission per student per challenge. No edits in v1.

**Errors**: 400 (blank/malformed `submissionUrl`), 401, 403 (non-STUDENT),
404 (unknown/inactive/expired challenge), 409 (already submitted)

---

## 4. View My Submissions (STUDENT)

```
GET /challenge/my-submissions
Authorization: Bearer <token>   (STUDENT role required)
```

Own submissions across all challenges — including expired/deactivated ones (history
preserved) — ordered `submittedAt` DESC.

**Response 200**
```json
[
  {
    "id": "uuid",
    "submissionUrl": "https://github.com/username/fraud-detection-api",
    "score": 85.50,
    "submittedAt": "2026-07-18T10:05:00Z",
    "challenge": {
      "id": "uuid",
      "title": "Build a Fraud Detection API",
      "description": "...",
      "submissionFormat": "...",
      "deadline": "2026-08-15T23:59:00Z",
      "active": true,
      "createdAt": "2026-07-18T10:00:00Z",
      "submissionCount": null
    }
  }
]
```

`score` is null until the recruiter evaluates. Empty history → `[]`.

**Errors**: 401, 403 (non-STUDENT)

---

## 5. Get Leaderboard (authenticated)

```
GET /challenge/{challengeId}/leaderboard
Authorization: Bearer <token>
```

Scored submissions only (`score IS NOT NULL`), ordered `score` DESC, tie-broken by
`submittedAt` ASC, 1-based `rank`. Recomputed on every request — score revisions are
visible immediately. Viewable for expired/deactivated challenges.

**Response 200**
```json
{
  "challengeId": "uuid",
  "entries": [
    { "rank": 1, "studentId": "uuid", "score": 94.50 },
    { "rank": 2, "studentId": "uuid", "score": 89.00 }
  ]
}
```

No scored submissions yet → `{ "challengeId": "uuid", "entries": [] }`.
Entries carry `studentId` only (research Decision 6) — clients render an anonymized label.

**Errors**: 401, 404 (unknown challenge)

---

## 6. List My Challenges (RECRUITER)

```
GET /challenge/mine
Authorization: Bearer <token>   (RECRUITER role required)
```

Own challenges (including inactive), ordered `createdAt` DESC, each with a live
`submissionCount`.

**Response 200** — array of `ChallengeResponse`
```json
[
  {
    "id": "uuid",
    "title": "Build a Fraud Detection API",
    "description": "...",
    "submissionFormat": "...",
    "deadline": "2026-08-15T23:59:00Z",
    "active": true,
    "createdAt": "2026-07-18T10:00:00Z",
    "submissionCount": 3
  }
]
```

**Errors**: 401, 403 (non-RECRUITER)

---

## 7. Review Submissions (RECRUITER, owner)

```
GET /challenge/{challengeId}/submissions
Authorization: Bearer <token>   (RECRUITER role required, must own challenge)
```

All submissions to an own challenge, ordered `submittedAt` DESC.

**Response 200** — array of `SubmissionReviewResponse`
```json
[
  {
    "id": "uuid",
    "studentId": "uuid",
    "submissionUrl": "https://github.com/username/fraud-detection-api",
    "score": null,
    "submittedAt": "2026-07-18T10:05:00Z"
  }
]
```

No submissions → `[]`.

**Errors**: 401, 403 (non-RECRUITER), 404 (unknown or not-owned challenge)

---

## 8. Score Submission (RECRUITER, owner)

```
POST /challenge/{challengeId}/submissions/{submissionId}/score
Authorization: Bearer <token>   (RECRUITER role required, must own challenge)
```

**Request**
```json
{ "score": 85.50 }
```

Assigns or revises the score (upsert, research Decision 1). Inclusive range 0.00–100.00.
Available after the deadline and after deactivation — evaluation happens after the
submission window closes.

**Response 200** — `SubmissionReviewResponse` with the updated score.

**Errors**: 400 (missing/out-of-range score), 401, 403 (non-RECRUITER),
404 (unknown/not-owned challenge, or submission not belonging to the challenge)

---

## 9. Deactivate Challenge (RECRUITER, owner)

```
POST /challenge/{challengeId}/deactivate
Authorization: Bearer <token>   (RECRUITER role required, must own challenge)
```

Sets `active: false`. The challenge disappears from the browse list and rejects new
submissions (404); existing submissions and scores are preserved, and the leaderboard
remains viewable. Idempotent — deactivating twice returns 200.

**Response 200** — `ChallengeResponse` with `active: false`.

**Errors**: 401, 403 (non-RECRUITER), 404 (unknown or not-owned challenge)

---

## 10. Health (public)

```
GET /challenge/health
```

**Response 200** — `{ "status": "UP" }`
