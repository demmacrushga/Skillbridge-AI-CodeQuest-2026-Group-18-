# API Reference

All SkillBridge AI backend services expose RESTful APIs. This document provides a concise reference for every service's key endpoints, request formats, and response shapes.

Full interactive documentation is available via Swagger UI at `http://localhost:{PORT}/swagger-ui/index.html` when running locally.

---

## Authentication

All protected endpoints require a valid JWT Bearer token:

```
Authorization: Bearer <access_token>
```

Tokens are issued by `auth-service` and are valid for 24 hours. Use the refresh endpoint to get a new access token without logging in again.

---

## auth-service — Port 8001

### Register

```
POST /auth/register
```

```json
{
  "email": "student@knust.edu.gh",
  "password": "SecurePass123!",
  "firstName": "Abena",
  "lastName": "Mensah",
  "role": "STUDENT"
}
```

**Response 201**
```json
{
  "id": "uuid",
  "email": "student@knust.edu.gh",
  "firstName": "Abena",
  "lastName": "Mensah",
  "role": "STUDENT",
  "emailVerified": false
}
```

---

### Login

```
POST /auth/login
```

```json
{
  "email": "student@knust.edu.gh",
  "password": "SecurePass123!"
}
```

**Response 200**
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "expiresIn": 86400,
  "user": {
    "id": "uuid",
    "email": "student@knust.edu.gh",
    "role": "STUDENT"
  }
}
```

---

### Refresh Token

```
POST /auth/refresh
```

```json
{ "refreshToken": "eyJhbGci..." }
```

**Response 200** — returns new `accessToken` and rotated `refreshToken`.

---

### Get Current User

```
GET /auth/me
Authorization: Bearer <token>
```

**Response 200** — returns full user profile.

---

## career-service — Port 8002

### Generate Roadmap

```
POST /career/roadmap/generate
Authorization: Bearer <token>
```

```json
{
  "careerPath": "Software Engineer",
  "academicLevel": "Level 200",
  "currentSkills": ["Python", "HTML", "CSS"]
}
```

**Response 201**
```json
{
  "roadmapId": "uuid",
  "careerPath": "Software Engineer",
  "progressPercent": 0,
  "milestones": [
    {
      "id": "uuid",
      "semester": 1,
      "title": "Learn Data Structures and Algorithms",
      "description": "...",
      "type": "SKILL",
      "order": 1,
      "completed": false
    }
  ]
}
```

---

### Get Roadmap

```
GET /career/roadmap/{userId}
Authorization: Bearer <token>
```

**Response 200** — returns roadmap with all milestones and their completion status.

---

### Complete a Milestone

```
PATCH /career/milestones/{milestoneId}/complete
Authorization: Bearer <token>
```

```json
{ "evidenceNote": "Completed HackerRank data structures track" }
```

**Response 200** — returns updated milestone and new `progressPercent`.

---

### Get Career Paths

```
GET /career/paths
```

No auth required. Returns the list of available career paths (Software Engineer, Data Analyst, Accountant, etc.).

---

## skill-gap-service — Port 8003

### Upload CV and Analyse

```
POST /skill-gap/analyse
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

| Field | Type | Description |
|---|---|---|
| file | File | PDF or DOCX, max 5MB |
| targetRole | String | e.g. "Software Engineer" |

**Response 201**
```json
{
  "reportId": "uuid",
  "targetRole": "Software Engineer",
  "gaps": [
    {
      "id": "uuid",
      "skillName": "System Design",
      "importanceRank": 1,
      "description": "System design is essential for senior roles...",
      "recommendations": [
        {
          "type": "COURSE",
          "title": "Grokking the System Design Interview",
          "url": "https://..."
        }
      ]
    }
  ]
}
```

---

### Get Report

```
GET /skill-gap/reports/{reportId}
Authorization: Bearer <token>
```

**Response 200** — returns full report with all gaps and recommendations.

---

### Get All Reports for User

```
GET /skill-gap/reports
Authorization: Bearer <token>
```

**Response 200** — returns list of all reports for the authenticated student.

---

### Delete Report

```
DELETE /skill-gap/reports/{reportId}
Authorization: Bearer <token>
```

**Response 204** — no body. Cascades to all `skill_gaps` and `resource_recommendations` rows. Also removes the parent `cv_upload` record (metadata-only; no file stored).

---

## portfolio-service — Port 8004

### Add Portfolio Item

```
POST /portfolio/items
Authorization: Bearer <token>
```

```json
{
  "itemType": "PROJECT",
  "title": "Student Result Management System",
  "description": "A web app built with React and Node.js...",
  "externalUrl": "https://github.com/username/project"
}
```

**Response 201** — returns created item with `verified: false`, `verificationStatus: "NONE"`.

---

### Get My Portfolio

```
GET /portfolio/mine
Authorization: Bearer <token>
```

**Response 200** — returns all items for the authenticated student with `verificationStatus` for each item (`NONE`, `PENDING`, `APPROVED`, `REJECTED`).

---

### Get Public Portfolio

```
GET /portfolio/{userId}
```

No auth required. Returns only `verified: true` items.

---

### Update Portfolio Item

```
PUT /portfolio/items/{itemId}
Authorization: Bearer <token>
```

**Response 200** — returns updated item.

---

### Delete Portfolio Item

```
DELETE /portfolio/items/{itemId}
Authorization: Bearer <token>
```

**Response 204** — no body.

---

### Request AI Verification

```
POST /portfolio/items/{itemId}/verify
Authorization: Bearer <token>
```

No body required. Calls Claude AI synchronously to assess the item. Returns the AI decision immediately.

**Response 200**
```json
{
  "id": "uuid",
  "portfolioItemId": "uuid",
  "status": "APPROVED",
  "reviewerNote": "Clear project with a public repository and detailed description.",
  "reviewSource": "AI",
  "requestedAt": "2026-06-28T14:00:00Z",
  "reviewedAt": "2026-06-28T14:00:03Z"
}
```

`status` values: `APPROVED`, `REJECTED`, `PENDING` (fallback when Claude is unavailable).  
`reviewSource` values: `AI`, `HUMAN`, `PENDING_FALLBACK`.

**409 Conflict** — if a pending verification request already exists for this item.

---

### Admin — Override Verification

```
PATCH /portfolio/verification/{requestId}
Authorization: Bearer <token>   (ADMIN role required)
```

```json
{
  "decision": "APPROVED",
  "reviewerNote": "GitHub repo confirms this is the student's own work."
}
```

**Response 200** — `reviewSource` will be `"HUMAN"`.

---

### Generate Share Link

```
POST /portfolio/share
Authorization: Bearer <token>
```

**Response 200**
```json
{
  "shareUrl": "https://skillbridge.ai/portfolio/share/abc123xyz"
}
```

---

### Batch Create Items

```
POST /portfolio/items/batch
Authorization: Bearer <token>
```

```json
{
  "items": [
    { "itemType": "PROJECT", "title": "E-commerce API", "description": "Spring Boot REST API", "externalUrl": "https://github.com/user/repo" },
    { "itemType": "CERTIFICATION", "title": "AWS CCP", "description": "Cloud certification", "externalUrl": null }
  ]
}
```

**Response 201** — returns array of created `PortfolioItemResponse` objects. Atomic: all items saved or none.

**400 Bad Request** — if `items` is empty, null, or contains more than 50 entries.

---

### Extract Portfolio Items from CV

```
POST /portfolio/extract
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Upload a CV (PDF or DOCX, max 5MB). Claude AI extracts portfolio-worthy items.

**Response 200**
```json
[
  { "itemType": "PROJECT", "title": "E-commerce API", "description": "Spring Boot REST API", "externalUrl": "https://github.com/user/repo", "confidence": 0.9 },
  { "itemType": "CERTIFICATION", "title": "AWS CCP", "description": "Cloud certification", "externalUrl": null, "confidence": 0.85 }
]
```

Returns empty array `[]` if no portfolio-worthy items found. Items are NOT persisted — student must batch-save selected items via `POST /portfolio/items/batch`.

**400 Bad Request** — file too large, unsupported type, or password-protected PDF.  
**503 Service Unavailable** — Claude API unavailable.

---

### Extract Portfolio Items from Website URL

```
POST /portfolio/extract-url
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{ "url": "https://github.com/username" }
```

Fetches the page, Claude extracts portfolio-worthy items. Same response shape as CV extraction.

**400 Bad Request** — invalid URL or non-HTML content type.  
**502 Bad Gateway** — URL unreachable or returned non-200.  
**503 Service Unavailable** — Claude API unavailable.

---

## mock-interview-service — Port 8005

AI-powered mock interviews. A student picks a target role and difficulty; Claude generates 3–7 questions. The student answers one at a time and Claude scores each answer (0–10) with feedback. On completion Claude produces an overall score (0–100) and summary. Base path `/mock-interview`, isolated schema `mock_interview`.

### Health

```
GET /mock-interview/health
```

Public — no auth required.

**Response 200**
```json
{ "status": "UP" }
```

---

### Start Session

```
POST /mock-interview/sessions
Authorization: Bearer <token>
```

```json
{
  "targetRole": "Backend Developer",
  "difficulty": "ENTRY"
}
```

| Field | Type | Description |
|---|---|---|
| targetRole | String | Required, non-blank, max 200 chars |
| difficulty | String | Required, one of `ENTRY` \| `MID` \| `SENIOR` (case-sensitive) |

**Response 201** — session with 3–7 generated questions.
```json
{
  "id": "uuid",
  "targetRole": "Backend Developer",
  "difficulty": "ENTRY",
  "status": "IN_PROGRESS",
  "overallScore": null,
  "overallFeedback": null,
  "createdAt": "2026-07-08T10:00:00Z",
  "completedAt": null,
  "questions": [
    {
      "id": "uuid",
      "questionText": "Explain the difference between REST and GraphQL.",
      "category": "TECHNICAL",
      "orderIndex": 1,
      "userAnswer": null,
      "score": null,
      "feedback": null,
      "answeredAt": null
    }
  ]
}
```

**Errors**: 400 (blank role / invalid or wrong-case difficulty), 401, 503 (Claude unavailable or returned zero questions)

---

### List Sessions

```
GET /mock-interview/sessions
Authorization: Bearer <token>
```

Returns the caller's sessions, newest first. No `questions` array in summaries.

**Response 200**
```json
[
  {
    "id": "uuid",
    "targetRole": "Backend Developer",
    "difficulty": "ENTRY",
    "status": "COMPLETED",
    "overallScore": 72,
    "createdAt": "2026-07-08T10:00:00Z"
  }
]
```

**Errors**: 401

---

### Get Session

```
GET /mock-interview/sessions/{sessionId}
Authorization: Bearer <token>
```

Full session including all questions, answers, scores, and feedback. This is the resume mechanism — the client resumes at the question with the lowest `orderIndex` whose `userAnswer` is `null`.

**Response 200** — same shape as POST /sessions response.

**Errors**: 401, 404 (not found or not owned by caller)

---

### Submit Answer

```
POST /mock-interview/sessions/{sessionId}/questions/{questionId}/answer
Authorization: Bearer <token>
```

```json
{ "answer": "I would use REST for simple CRUD operations because..." }
```

| Field | Type | Description |
|---|---|---|
| answer | String | Required, non-blank, max 5000 chars |

**Response 200** — Claude evaluates the answer (0–10) with feedback.
```json
{
  "id": "uuid",
  "questionText": "Explain the difference between REST and GraphQL.",
  "category": "TECHNICAL",
  "orderIndex": 1,
  "userAnswer": "I would use REST for simple CRUD operations because...",
  "score": 7,
  "feedback": "Good grasp of REST fundamentals. Missing: GraphQL's type system and query flexibility.",
  "answeredAt": "2026-07-08T10:05:00Z"
}
```

**Errors**: 400 (blank answer), 401, 404 (session/question not found or not owned), 409 (question already answered, or session already completed), 503 (Claude unavailable)

---

### Transcribe Voice Answer (US6)

```
POST /mock-interview/sessions/{sessionId}/questions/{questionId}/transcribe
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Accepts an audio recording of a spoken answer. Audio is forwarded in-memory to a self-hosted faster-whisper service; the transcript text is returned to the client. **Audio is never persisted** — the client must then submit the (possibly edited) transcript text via the existing [Submit Answer](#submit-answer) endpoint to drive Claude evaluation.

This is a non-reasoning speech-to-text utility endpoint added by the voice amendment (FR-014/015). It reuses the ownership and immutability guards of `/answer` so a voice user cannot bypass them.

| Part | Type | Description |
|---|---|---|
| `audio` | file | Required. Audio/mpeg, audio/m4a, or audio/wav. Max 25 MB. |

**Response 200**
```json
{ "transcript": "I would use REST for simple CRUD operations because..." }
```

The client populates the same `TextInput` used for typed answers so the user can edit any mis-transcribed words (technical terms especially) before tapping **Submit Answer**.

**Errors**: 400 (missing part / oversize / wrong mimetype), 401, 404 (session/question not found or not owned), 409 (question already answered, or session already completed), 422 (no speech detected — `{"error":"No speech detected","status":422}` when Whisper returns empty/whitespace-only), 503 (Whisper unavailable)

---

### Complete Session

```
POST /mock-interview/sessions/{sessionId}/complete
Authorization: Bearer <token>
```

No request body. Requires all questions to be answered. Claude generates the overall score (0–100) and summary, and marks the session `COMPLETED`.

**Response 200**
```json
{
  "id": "uuid",
  "targetRole": "Backend Developer",
  "difficulty": "ENTRY",
  "status": "COMPLETED",
  "overallScore": 68,
  "overallFeedback": "You demonstrated solid REST understanding... Focus on system design for your next practice.",
  "createdAt": "2026-07-08T10:00:00Z",
  "completedAt": "2026-07-08T10:20:00Z",
  "questions": []
}
```

**Errors**: 401, 404, 409 (already completed), 422 (not all questions answered), 503 (Claude unavailable)

---

### Delete Session

```
DELETE /mock-interview/sessions/{sessionId}
Authorization: Bearer <token>
```

**Response 204** — no body. Questions cascade-delete.

**Errors**: 401, 404 (not found or not owned)

---

## matching-service — Port 8006

Full contract with all fields: `specs/009-matching-service/contracts/matching-api.md`.

### Post Opportunity (Recruiter)

```
POST /matching/opportunities
Authorization: Bearer <token>   (RECRUITER role required)
```

```json
{
  "title": "Software Engineering Intern",
  "companyName": "Hubtel",
  "description": "...",
  "location": "Accra",
  "opportunityType": "INTERNSHIP",
  "deadline": "2026-08-31",
  "externalUrl": "https://hubtel.com/careers/se-intern-2026",
  "requiredSkills": [
    { "skillName": "Java", "required": true },
    { "skillName": "Spring Boot", "required": true },
    { "skillName": "PostgreSQL", "required": false }
  ]
}
```

**Response 201** — the created opportunity. `externalUrl` is optional: when present the listing is externally hosted; applying still records the application and returns the URL for the client to open.

**Errors**: 400 (validation — blank title/description, invalid type, empty skills, past deadline, malformed externalUrl), 401, 403 (non-RECRUITER)

---

### Get Ranked Matches

```
GET /matching/opportunities
Authorization: Bearer <token>
```

Active, non-expired opportunities scored against the caller's stored skill profile
(must-have skills weigh 2× nice-to-have; `score = 100 × matched weight / total weight`),
ordered `matchScore` DESC.

**Response 200**
```json
{
  "matches": [
    {
      "opportunity": {
        "id": "uuid",
        "title": "Software Engineering Intern",
        "companyName": "Hubtel",
        "location": "Accra",
        "opportunityType": "INTERNSHIP",
        "deadline": "2026-08-31",
        "externalUrl": null,
        "active": true,
        "createdAt": "2026-07-18T10:00:00Z",
        "description": "...",
        "requiredSkills": [ { "skillName": "Java", "required": true } ],
        "applicantCount": null
      },
      "matchScore": 80.00,
      "rank": 1,
      "applied": false
    }
  ]
}
```

**Errors**: 401

---

### Apply to Opportunity (Student)

```
POST /matching/opportunities/{opportunityId}/apply
Authorization: Bearer <token>   (STUDENT role required)
```

No body required. Records the application (also for external postings — click-tracking).

**Response 201**
```json
{ "id": "uuid", "opportunityId": "uuid", "appliedAt": "2026-07-18T10:05:00Z", "externalUrl": null }
```

**Errors**: 401, 403 (non-STUDENT), 404 (unknown/inactive/expired), 409 (already applied)

---

### Get My Applications (Student)

```
GET /matching/applications
Authorization: Bearer <token>   (STUDENT role required)
```

**Response 200** — `[{ id, appliedAt, opportunity }]` ordered newest-first.

**Errors**: 401, 403 (non-STUDENT)

---

### Get / Replace My Skill Profile (Student)

```
GET /matching/profile/skills
PUT /matching/profile/skills
Authorization: Bearer <token>   (STUDENT role required)
```

PUT body: `{ "skills": ["Java", "Spring Boot"] }` (0–50 entries; full replacement;
duplicates collapse case-insensitively).

**Response 200** — `{ "skills": ["Java", "Spring Boot"] }`

**Errors**: 400 (>50 skills, blank/oversized entry), 401, 403 (non-STUDENT)

---

### Get My Postings (Recruiter)

```
GET /matching/opportunities/mine
Authorization: Bearer <token>   (RECRUITER role required)
```

**Response 200** — own postings newest-first (includes inactive), with live `applicantCount`.

**Errors**: 401, 403 (non-RECRUITER)

---

### Deactivate Own Posting (Recruiter)

```
POST /matching/opportunities/{opportunityId}/deactivate
Authorization: Bearer <token>   (RECRUITER role required, must own the posting)
```

**Response 200** — the posting with `active: false`. Idempotent.

**Errors**: 401, 403 (non-RECRUITER), 404 (unknown or not owned)

---

### Get Applicants for Own Posting (Recruiter)

```
GET /matching/opportunities/{opportunityId}/applications
Authorization: Bearer <token>   (RECRUITER role required, must own the posting)
```

**Response 200** — `[{ studentId, appliedAt }]` newest-first. Student identity is the
UUID only (no PII).

**Errors**: 401, 403 (non-RECRUITER), 404 (unknown or not owned)

---

### Health (public)

```
GET /matching/health
```

**Response 200** — `{ "status": "UP" }`

---

## challenge-service — Port 8007

Full contract with all fields: `specs/010-challenge-service/contracts/challenge-api.md`.

### Post Challenge (Recruiter)

```
POST /challenge
Authorization: Bearer <token>   (RECRUITER role required)
```

```json
{
  "title": "Build a Fraud Detection API",
  "description": "Design and implement an API that flags fraudulent mobile-money transactions",
  "submissionFormat": "GitHub repository link with a README explaining your approach",
  "deadline": "2026-08-15T23:59:00Z"
}
```

**Response 201** — the created challenge (`active: true`, `submissionCount: 0`).

**Errors**: 400 (blank title/description/submissionFormat, missing or past deadline), 401, 403 (non-RECRUITER)

---

### Browse Active Challenges

```
GET /challenge
Authorization: Bearer <token>
```

Active, non-expired challenges ordered `createdAt` DESC. Each entry carries a `submitted` flag (true when the calling STUDENT already submitted; always false for RECRUITER callers).

**Response 200** — `{ "challenges": [ ... ] }`

**Errors**: 401

---

### Submit Solution (Student)

```
POST /challenge/{challengeId}/submissions
Authorization: Bearer <token>   (STUDENT role required)
```

```json
{ "submissionUrl": "https://github.com/username/fraud-detection-api" }
```

**Response 201** — the recorded submission with `score: null`. One submission per student per challenge; no edits in v1.

**Errors**: 400 (blank/malformed URL), 401, 403 (non-STUDENT), 404 (unknown/inactive/expired challenge), 409 (already submitted)

---

### Get My Submissions (Student)

```
GET /challenge/my-submissions
Authorization: Bearer <token>   (STUDENT role required)
```

Own submissions across all challenges (including expired/deactivated — history preserved), ordered `submittedAt` DESC, each with the challenge summary and current `score` (null until scored).

**Errors**: 401, 403 (non-STUDENT)

---

### Get Leaderboard

```
GET /challenge/{challengeId}/leaderboard
Authorization: Bearer <token>
```

Scored submissions only, ordered `score` DESC, tie-broken by `submittedAt` ASC, 1-based `rank`. Viewable for expired/deactivated challenges. Entries carry `studentId` only (no names — see spec Assumptions).

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

**Errors**: 401, 404 (unknown challenge)

---

### Get My Challenges (Recruiter)

```
GET /challenge/mine
Authorization: Bearer <token>   (RECRUITER role required)
```

Own challenges (including inactive), ordered `createdAt` DESC, each with a live `submissionCount`.

**Errors**: 401, 403 (non-RECRUITER)

---

### Review Submissions (Recruiter, owner)

```
GET /challenge/{challengeId}/submissions
Authorization: Bearer <token>   (RECRUITER role required, must own challenge)
```

All submissions to an own challenge (studentId, submissionUrl, score, submittedAt), ordered `submittedAt` DESC.

**Errors**: 401, 403 (non-RECRUITER), 404 (unknown or not-owned challenge)

---

### Score Submission (Recruiter, owner)

```
POST /challenge/{challengeId}/submissions/{submissionId}/score
Authorization: Bearer <token>   (RECRUITER role required, must own challenge)
```

```json
{ "score": 85.50 }
```

Assigns or revises the score (upsert). Inclusive range 0.00–100.00, at most 2 decimal places. Available after the deadline and after deactivation — evaluation happens after the submission window closes.

**Errors**: 400 (missing/out-of-range/over-precision score), 401, 403 (non-RECRUITER), 404 (unknown/not-owned challenge, or submission not in challenge)

---

### Deactivate Challenge (Recruiter, owner)

```
POST /challenge/{challengeId}/deactivate
Authorization: Bearer <token>   (RECRUITER role required, must own challenge)
```

Sets `active: false`: the challenge leaves the browse list and rejects new submissions; existing submissions and scores are preserved and the leaderboard stays viewable. Idempotent.

**Errors**: 401, 403 (non-RECRUITER), 404 (unknown or not-owned challenge)

---

### Health (public)

```
GET /challenge/health
```

**Response 200** — `{ "status": "UP" }`

---

## mentorship-service — Port 8008

Full contract with all fields: `specs/011-mentorship-service/contracts/mentorship-api.md`.

### Get My Profile (Alumni)

```
GET /mentorship/profile
Authorization: Bearer <token>   (ALUMNI role required)
```

**Response 200** — the caller's stored mentor profile (currentRole, company, industry, careerInterests, bio, available, updatedAt).

**Errors**: 401, 403 (non-ALUMNI), 404 (no profile created yet)

---

### Create/Replace My Profile (Alumni)

```
PUT /mentorship/profile
Authorization: Bearer <token>   (ALUMNI role required)
```

```json
{
  "currentRole": "Senior Backend Engineer",
  "company": "Hubtel",
  "industry": "Fintech",
  "careerInterests": ["backend engineering", "fintech", "mentoring juniors"],
  "bio": "Class of 2019. Happy to help with interview prep and career switching.",
  "available": true
}
```

Full-replace upsert — creates on first call, replaces entirely afterwards. `careerInterests` required (1–20 tags, each ≤ 50 chars, trimmed and case-insensitively deduplicated); `currentRole`/`company` ≤ 150 chars, `industry` ≤ 100, `bio` ≤ 2,000; `available` required.

**Response 200** — the stored, normalized profile.

**Errors**: 400 (validation), 401, 403 (non-ALUMNI)

---

### Search Alumni (Student)

```
GET /mentorship/alumni?interest=fintech&interest=backend%20engineering&industry=Fintech
Authorization: Bearer <token>   (STUDENT role required)
```

Repeatable `interest` params and optional `industry`, both matched case-insensitively (exact match after trim/whitespace-collapse). Returns only `available: true` profiles, ranked by matching-tag count DESC, then `updatedAt` DESC. No filters → all available profiles, `updatedAt` DESC.

**Response 200** — `{ "alumni": [ ... ] }`, each entry with `alumniId`, profile fields, and `matchingTags`. Empty result → `{ "alumni": [] }`.

**Errors**: 401, 403 (non-STUDENT)

---

### Send Mentorship Request (Student)

```
POST /mentorship/requests
Authorization: Bearer <token>   (STUDENT role required)
```

```json
{ "alumniId": "uuid", "message": "Hi! I'm targeting backend roles and would love guidance." }
```

`alumniId` required (the alumnus's userId from search); `message` optional, ≤ 1,000 chars.

**Response 201** — the request with `status: "PENDING"`.

**Errors**: 400 (missing alumniId / oversize message), 401, 403 (non-STUDENT), 404 (alumni profile unknown **or** unavailable — indistinguishable), 409 (a PENDING request or ACTIVE pair with this alumnus already exists)

---

### Cancel Request (Student, sender)

```
POST /mentorship/requests/{requestId}/cancel
Authorization: Bearer <token>   (STUDENT role required, must be the sender)
```

No body. Marks the caller's own PENDING request `CANCELLED` (+ `respondedAt`) — the only student-side exit from PENDING (requests never expire automatically). Cancelling frees the student to re-request the same alumnus immediately.

**Errors**: 401, 403 (non-STUDENT), 404 (unknown request or sent by a different student), 409 (already ACCEPTED/DECLINED/CANCELLED)

---

### Get My Requests (Student)

```
GET /mentorship/requests/mine
Authorization: Bearer <token>   (STUDENT role required)
```

Every request the caller has sent, all statuses, ordered `createdAt` DESC. Empty → `[]`.

**Errors**: 401, 403 (non-STUDENT)

---

### Get Incoming Requests (Alumni)

```
GET /mentorship/requests/incoming
Authorization: Bearer <token>   (ALUMNI role required)
```

Only PENDING requests addressed to the caller, ordered `createdAt` DESC. Empty → `[]`.

**Errors**: 401, 403 (non-ALUMNI)

---

### Accept Request (Alumni, addressee)

```
POST /mentorship/requests/{requestId}/accept
Authorization: Bearer <token>   (ALUMNI role required, must be the addressee)
```

No body. Marks the request `ACCEPTED` (+ `respondedAt`) and creates an ACTIVE mentorship pair.

**Response 200** — the new pair (`status: "ACTIVE"`, `startedAt` set).

**Errors**: 401, 403 (non-ALUMNI), 404 (unknown request or addressed to a different alumnus), 409 (already resolved)

---

### Decline Request (Alumni, addressee)

```
POST /mentorship/requests/{requestId}/decline
Authorization: Bearer <token>   (ALUMNI role required, must be the addressee)
```

No body. Marks the request `DECLINED` (+ `respondedAt`); no pair created. The student may re-request the same alumnus afterwards.

**Errors**: 401, 403 (non-ALUMNI), 404 (unknown / not addressed to caller), 409 (already resolved)

---

### Get My Pairs

```
GET /mentorship/pairs/mine
Authorization: Bearer <token>
```

All pairs where the caller is a participant (either side), ACTIVE and ENDED, ordered `startedAt` DESC. Any authenticated role may call this — scoping is strictly by the caller's user id, so a caller with no pairs (including RECRUITER/ADMIN) gets 200 with `[]`, not 403.

**Errors**: 401

---

### End Pair (participant)

```
POST /mentorship/pairs/{pairId}/end
Authorization: Bearer <token>   (must be a participant)
```

No body. Sets `status: "ENDED"` + `endedAt`. Idempotent — ending an already-ENDED pair returns 200 unchanged. Message history untouched and still readable.

**Errors**: 401, 404 (unknown pair or caller not a participant)

---

### Get Message Thread (participant)

```
GET /mentorship/pairs/{pairId}/messages
Authorization: Bearer <token>   (must be a participant)
```

Full thread, `sentAt` ASC. Side effect: every unread message sent *to* the caller gets `readAt` stamped in the same transaction. Readable on ENDED pairs.

**Response 200** — `{ "pairId": "uuid", "status": "ACTIVE", "messages": [ ... ] }`

**Errors**: 401, 404 (unknown pair or caller not a participant)

---

### Send Message (participant)

```
POST /mentorship/pairs/{pairId}/messages
Authorization: Bearer <token>   (must be a participant)
```

```json
{ "body": "Thanks for accepting! Could we set up a chat about interview prep?" }
```

`body` required, non-blank, ≤ 4,000 chars.

**Response 201** — the recorded message (`readAt: null`).

**Errors**: 400 (blank/oversize body), 401, 404 (unknown pair / not a participant), 409 (pair is ENDED — thread is read-only)

---

### Health (public)

```
GET /mentorship/health
```

**Response 200** — `{ "status": "UP" }`

---

## notification-service — Port 8009

### Get Notifications

```
GET /notifications
Authorization: Bearer <token>
```

Returns all notifications for the authenticated user (newest first).

---

### Mark as Read

```
PATCH /notifications/{notificationId}/read
Authorization: Bearer <token>
```

---

### Register Push Token

```
POST /notifications/push-tokens
Authorization: Bearer <token>
```

```json
{ "expoPushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" }
```

---

## Error Response Format

All services return errors in a consistent format:

```json
{
  "timestamp": "2026-06-18T10:30:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "File size exceeds maximum allowed 5MB",
  "path": "/skill-gap/analyse"
}
```

### Common HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 | OK — request succeeded |
| 201 | Created — resource created successfully |
| 400 | Bad Request — invalid input or missing required field |
| 401 | Unauthorised — missing or invalid JWT token |
| 403 | Forbidden — valid token but insufficient role |
| 404 | Not Found — resource does not exist |
| 422 | Unprocessable Entity — validation failed |
| 500 | Internal Server Error — unexpected server failure |
| 503 | Service Unavailable — upstream dependency (e.g. Claude API) unreachable |
