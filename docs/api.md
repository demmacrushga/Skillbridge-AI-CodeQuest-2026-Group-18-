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

**Response 201** — returns created item with `verified: false`.

---

### Get Portfolio

```
GET /portfolio/{userId}
```

No auth required for public portfolios. Returns all items; unverified items are hidden on public views.

---

### Submit for Verification

```
POST /portfolio/items/{itemId}/verify
Authorization: Bearer <token>
```

No body required. Creates a verification request with status `PENDING`.

---

### Admin — Review Verification

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

## interview-service — Port 8005

### Start Session

```
POST /interview/sessions
Authorization: Bearer <token>
```

```json
{
  "careerPath": "Software Engineer",
  "experienceLevel": "ENTRY"
}
```

**Response 201**
```json
{
  "sessionId": "uuid",
  "questions": [
    { "id": "uuid", "order": 1, "text": "Tell me about a project you are proud of." },
    { "id": "uuid", "order": 2, "text": "How do you approach debugging a problem you have never seen before?" }
  ]
}
```

---

### Submit Answer

```
POST /interview/sessions/{sessionId}/answers
Authorization: Bearer <token>
```

```json
{
  "questionId": "uuid",
  "answerText": "I recently built a student result management system...",
  "inputType": "TEXT"
}
```

**Response 200**
```json
{
  "answerId": "uuid",
  "feedback": {
    "contentScore": 72,
    "structureScore": 65,
    "feedbackText": "Your answer demonstrates relevant experience...",
    "improvementPoints": [
      "Quantify the impact — how many students used the system?",
      "Use the STAR structure: Situation, Task, Action, Result."
    ]
  }
}
```

---

### Get Session History

```
GET /interview/sessions
Authorization: Bearer <token>
```

Returns list of all past sessions with scores.

---

## matching-service — Port 8006

### Get Matches for Student

```
GET /matching/opportunities
Authorization: Bearer <token>
```

**Response 200**
```json
{
  "matches": [
    {
      "opportunity": {
        "id": "uuid",
        "title": "Software Engineering Intern",
        "company": "Hubtel",
        "location": "Accra",
        "deadline": "2026-08-31"
      },
      "matchScore": 87.4,
      "rank": 1
    }
  ]
}
```

---

### Post Opportunity (Recruiter)

```
POST /matching/opportunities
Authorization: Bearer <token>   (RECRUITER role required)
```

```json
{
  "title": "Software Engineering Intern",
  "description": "...",
  "location": "Accra",
  "opportunityType": "INTERNSHIP",
  "deadline": "2026-08-31",
  "requiredSkills": ["Java", "Spring Boot", "PostgreSQL"]
}
```

---

### Apply to Opportunity

```
POST /matching/opportunities/{opportunityId}/apply
Authorization: Bearer <token>
```

No body required. Records the application.

---

## challenge-service — Port 8007

### Post Challenge (Company)

```
POST /challenge
Authorization: Bearer <token>   (RECRUITER role required)
```

```json
{
  "title": "Build a Fraud Detection API",
  "description": "Design and implement an API that...",
  "submissionFormat": "GitHub repository link with a README explaining your approach",
  "deadline": "2026-07-15T23:59:00Z"
}
```

---

### Get All Challenges

```
GET /challenge
```

No auth required. Returns all active challenges.

---

### Submit Solution

```
POST /challenge/{challengeId}/submissions
Authorization: Bearer <token>
```

```json
{ "submissionUrl": "https://github.com/username/fraud-detection-api" }
```

---

### Get Leaderboard

```
GET /challenge/{challengeId}/leaderboard
```

**Response 200**
```json
{
  "challengeId": "uuid",
  "entries": [
    { "rank": 1, "studentName": "Abena M.", "score": 94.5 },
    { "rank": 2, "studentName": "Kwame A.", "score": 89.0 }
  ]
}
```

---

## mentorship-service — Port 8008

### Get Matched Alumni

```
GET /mentorship/matches
Authorization: Bearer <token>
```

Returns alumni matched to the student's career interests.

---

### Send Mentorship Request

```
POST /mentorship/requests
Authorization: Bearer <token>
```

```json
{
  "alumniId": "uuid",
  "message": "Hi, I am a Level 200 CS student interested in backend engineering..."
}
```

---

### Send Message

```
POST /mentorship/pairs/{pairId}/messages
Authorization: Bearer <token>
```

```json
{ "body": "Thank you for the advice on the interview structure." }
```

---

### Get Messages

```
GET /mentorship/pairs/{pairId}/messages
Authorization: Bearer <token>
```

Returns paginated message thread for the mentorship pair.

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
