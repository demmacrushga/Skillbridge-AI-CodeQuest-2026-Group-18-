# Challenge Service

**Runs on port 8007**

---

## What this service does

This service is where companies post real industry challenges — a task like "build a fraud-detection API" — along with instructions on how to submit a solution and a deadline. Students browse the list of open challenges, pick one, and submit a link to their work (a GitHub repo, a deployed demo, whatever the challenge asks for). There's no file upload — just a URL.

Once the deadline passes, or whenever the recruiter is ready, the recruiter who posted the challenge reviews every submission and gives each one a numeric score out of 100. A leaderboard for that challenge then ranks every scored submission from highest to lowest, so students can see where they stand.

It's a deliberately lightweight, manually-judged competition system. There is no AI grading here — scoring is a human decision by the recruiter who owns the challenge. Everything else (ranking, filtering active challenges, tracking who already submitted) is computed automatically.

---

## Who uses this service

| Who | What they do |
|---|---|
| Recruiters | Post challenges, view their own challenges with live submission counts, review submissions to their own challenges, score (or re-score) submissions, deactivate their own challenges |
| Students | Browse open challenges, submit a solution link, view their own submission history, view leaderboards |

Both roles can browse the open challenge list and view any leaderboard — recruiters see the exact same board students see.

---

## Key ideas

**Challenge** — a task posted by a recruiter. It has a title, a description, instructions for how to submit (`submissionFormat` — e.g. "GitHub repository link with a README"), and a deadline. A challenge is `active` by default.

**Open for submissions** — a challenge only accepts submissions and appears on the public browse list while it is both `active` and its deadline hasn't passed yet. This isn't a separate status field — it's recalculated on every request by comparing the deadline to the current time. Once the deadline quietly passes, the challenge disappears from the browse list and starts rejecting new submissions, with no batch job or explicit "expired" event involved.

**Submission** — a student's solution link to a specific challenge. Each student can submit to a given challenge exactly once — there's no editing or resubmitting. If a student submits the wrong link, there's no way to fix it in v1; deactivating and reposting the challenge is the only workaround available to the recruiter, and even that doesn't let the student redo their submission.

**Scoring** — only the recruiter who posted the challenge can score its submissions. A score is a number from 0.00 to 100.00, with at most two decimal places. Scoring works like an upsert: scoring the same submission twice simply overwrites the previous score. There's no history of previous scores and no way to clear a score back to unscored.

**Leaderboard** — a ranking of every *scored* submission to a challenge, best score first, ties broken by whoever submitted earliest. It's entries carry only a student ID, never a name — the JWT this service reads has no name claim, and this service doesn't call auth-service to look one up. The frontend is expected to render something like "Student a1b2…" from the ID.

**Deactivation, not deletion** — a recruiter can deactivate their own challenge. That removes it from the public browse list and blocks new submissions (they now behave the same way an expired challenge does — a 404). But nothing is deleted: existing submissions, scores, and the leaderboard all stay exactly as they were, still visible to everyone who could see them before. There is no "reactivate."

---

## Common journeys

**A recruiter posts a challenge and later scores it**
```
POST /challenge                                        →  challenge created, active, 0 submissions
  ... students submit over the following weeks ...
GET  /challenge/{id}/submissions                        →  every submission, unscored
POST /challenge/{id}/submissions/{submissionId}/score   →  score assigned (repeat per submission)
GET  /challenge/{id}/leaderboard                         →  ranked list of scored submissions
```

**A student finds a challenge, submits, and checks their standing**
```
GET  /challenge                                          →  list of open challenges, each flagged submitted/not
POST /challenge/{id}/submissions                         →  submission recorded, score: null
GET  /challenge/my-submissions                           →  own submission history, across all challenges
GET  /challenge/{id}/leaderboard                          →  see rank once the recruiter scores it
```

**A recruiter closes out a challenge**
```
POST /challenge/{id}/deactivate   →  challenge leaves the browse list; submissions/scores untouched
GET  /challenge/{id}/leaderboard   →  still fully viewable
```

---

## Endpoints

All endpoints are under `/challenge`. Every endpoint except the health check requires `Authorization: Bearer <access_token>`.

### Health check

```
GET /challenge/health
```

Open to everyone — no sign-in needed.

**On success (200)** — `{ "status": "UP" }`

---

### Post a challenge

```
POST /challenge
Authorization: Bearer <access_token>   (recruiter only)
```

```json
{
  "title": "Build a Fraud Detection API",
  "description": "Design and implement an API that flags fraudulent mobile-money transactions.",
  "submissionFormat": "GitHub repository link with a README explaining your approach",
  "deadline": "2026-08-15T23:59:00Z"
}
```

| Field | Rules |
|---|---|
| `title` | Required. Cannot be blank. Max 255 characters. |
| `description` | Required. Cannot be blank. Max 5,000 characters. |
| `submissionFormat` | Required. Cannot be blank. Max 2,000 characters. |
| `deadline` | Required. Must be a timestamp in the future. |

**On success (201)** — the new challenge.
```json
{
  "id": "uuid",
  "title": "Build a Fraud Detection API",
  "description": "Design and implement an API that flags fraudulent mobile-money transactions.",
  "submissionFormat": "GitHub repository link with a README explaining your approach",
  "deadline": "2026-08-15T23:59:00Z",
  "active": true,
  "createdAt": "2026-07-18T10:00:00Z",
  "submissionCount": 0
}
```

**What can go wrong**
- `400` — title, description, or submission format is blank or too long; deadline is missing or not in the future
- `401` — not signed in
- `403` — signed in, but not a recruiter

---

### Browse open challenges

```
GET /challenge
Authorization: Bearer <access_token>
```

Returns every challenge that is currently active and not past its deadline, newest first. Each entry carries a `submitted` flag telling a student whether they've already submitted to it (always `false` for a recruiter, since recruiters don't submit). There's no pagination — the whole open list comes back every time.

**On success (200)**
```json
{
  "challenges": [
    {
      "id": "uuid",
      "title": "Build a Fraud Detection API",
      "description": "Design and implement an API that flags fraudulent mobile-money transactions.",
      "submissionFormat": "GitHub repository link with a README explaining your approach",
      "deadline": "2026-08-15T23:59:00Z",
      "createdAt": "2026-07-18T10:00:00Z",
      "submitted": false
    }
  ]
}
```
An empty platform returns `{ "challenges": [] }`.

**What can go wrong**
- `401` — not signed in

---

### Submit a solution

```
POST /challenge/{challengeId}/submissions
Authorization: Bearer <access_token>   (student only)
```

```json
{ "submissionUrl": "https://github.com/username/fraud-detection-api" }
```

| Field | Rules |
|---|---|
| `submissionUrl` | Required. Cannot be blank. Must start with `http://` or `https://`. Max 2,048 characters. |

**On success (201)** — the recorded submission, unscored.
```json
{
  "id": "uuid",
  "challengeId": "uuid",
  "submissionUrl": "https://github.com/username/fraud-detection-api",
  "score": null,
  "submittedAt": "2026-07-18T10:05:00Z"
}
```

**What can go wrong**
- `400` — the URL is blank, doesn't start with http/https, or is too long
- `401` — not signed in
- `403` — signed in, but not a student
- `404` — the challenge doesn't exist, or it's inactive, or its deadline has already passed (all three look identical from the outside)
- `409` — this student already submitted to this challenge — one submission per student per challenge, no edits

---

### See my submissions

```
GET /challenge/my-submissions
Authorization: Bearer <access_token>   (student only)
```

Returns every submission the signed-in student has ever made, across every challenge — including challenges that have since been deactivated or expired. History is never removed. Ordered newest first.

**On success (200)**
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
      "description": "Design and implement an API that flags fraudulent mobile-money transactions.",
      "submissionFormat": "GitHub repository link with a README explaining your approach",
      "deadline": "2026-08-15T23:59:00Z",
      "active": true,
      "createdAt": "2026-07-18T10:00:00Z",
      "submissionCount": null
    }
  }
]
```
`score` is `null` until the recruiter scores it. `submissionCount` inside the nested challenge is always `null` here — it's only meaningful on the recruiter's own views.

**What can go wrong**
- `401` — not signed in
- `403` — signed in, but not a student

---

### Get a challenge's leaderboard

```
GET /challenge/{challengeId}/leaderboard
Authorization: Bearer <access_token>
```

Ranks every *scored* submission to the challenge, best score first, ties broken by whichever submission came in earlier. Works for expired and deactivated challenges too — the leaderboard doesn't disappear just because the challenge is closed.

**On success (200)**
```json
{
  "challengeId": "uuid",
  "entries": [
    { "rank": 1, "studentId": "uuid", "score": 94.50 },
    { "rank": 2, "studentId": "uuid", "score": 89.00 }
  ]
}
```
If nothing has been scored yet, `entries` is an empty array — not an error.

**What can go wrong**
- `401` — not signed in
- `404` — the challenge doesn't exist

---

### See my challenges (recruiter)

```
GET /challenge/mine
Authorization: Bearer <access_token>   (recruiter only)
```

Returns every challenge the signed-in recruiter has posted — including deactivated ones — newest first, each with a live `submissionCount`.

**On success (200)**
```json
[
  {
    "id": "uuid",
    "title": "Build a Fraud Detection API",
    "description": "Design and implement an API that flags fraudulent mobile-money transactions.",
    "submissionFormat": "GitHub repository link with a README explaining your approach",
    "deadline": "2026-08-15T23:59:00Z",
    "active": true,
    "createdAt": "2026-07-18T10:00:00Z",
    "submissionCount": 3
  }
]
```

**What can go wrong**
- `401` — not signed in
- `403` — signed in, but not a recruiter

---

### Review submissions to my challenge (recruiter)

```
GET /challenge/{challengeId}/submissions
Authorization: Bearer <access_token>   (recruiter only, must own the challenge)
```

Returns every submission to the challenge, newest first — the student's ID, their submission URL, current score, and when they submitted.

**On success (200)**
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

**What can go wrong**
- `401` — not signed in
- `403` — signed in, but not a recruiter
- `404` — the challenge doesn't exist, or it belongs to a different recruiter (both look identical — see [Important behaviours](#important-behaviours))

---

### Score a submission (recruiter)

```
POST /challenge/{challengeId}/submissions/{submissionId}/score
Authorization: Bearer <access_token>   (recruiter only, must own the challenge)
```

```json
{ "score": 85.50 }
```

| Field | Rules |
|---|---|
| `score` | Required. From `0.00` to `100.00` inclusive. At most two decimal places — a third decimal digit is rejected outright, never rounded. |

Scoring is available any time after submission, including after the deadline and after the challenge has been deactivated — judging is expected to happen once the submission window is over. Scoring the same submission again simply replaces the previous score.

**On success (200)** — the submission with its updated score.
```json
{
  "id": "uuid",
  "studentId": "uuid",
  "submissionUrl": "https://github.com/username/fraud-detection-api",
  "score": 85.50,
  "submittedAt": "2026-07-18T10:05:00Z"
}
```

**What can go wrong**
- `400` — score is missing, out of range, or has more than two decimal places
- `401` — not signed in
- `403` — signed in, but not a recruiter
- `404` — the challenge doesn't exist or isn't owned by this recruiter, or the submission doesn't exist within that challenge

---

### Deactivate a challenge (recruiter)

```
POST /challenge/{challengeId}/deactivate
Authorization: Bearer <access_token>   (recruiter only, must own the challenge)
```

No body needed. Removes the challenge from the public browse list and stops it accepting new submissions. Everything already submitted — including scores and the leaderboard — remains fully visible. Calling this on an already-deactivated challenge is harmless; it just returns the current state again.

**On success (200)** — the challenge, now inactive.
```json
{
  "id": "uuid",
  "title": "Build a Fraud Detection API",
  "description": "Design and implement an API that flags fraudulent mobile-money transactions.",
  "submissionFormat": "GitHub repository link with a README explaining your approach",
  "deadline": "2026-08-15T23:59:00Z",
  "active": false,
  "createdAt": "2026-07-18T10:00:00Z",
  "submissionCount": 3
}
```

**What can go wrong**
- `401` — not signed in
- `403` — signed in, but not a recruiter
- `404` — the challenge doesn't exist or isn't owned by this recruiter

---

## Important behaviours

**Deactivating hides, it never deletes.** A deactivated challenge disappears from `GET /challenge` and starts rejecting new submissions with a 404, exactly like an expired one. But every submission, every score, the leaderboard, the recruiter's own `/mine` view, and a student's `my-submissions` history all keep working normally. There's no undo for deactivation — no "reactivate" endpoint — but there's also nothing destructive about it.

**Duplicate submissions are blocked twice over.** The service checks whether a student has already submitted before accepting a new one, and the database itself has a uniqueness constraint on (challenge, student) as a backstop in case two submission requests land at the same moment. Both paths produce the same `409`.

**Scoring ignores whether the challenge is still open.** Every other write to a challenge (submitting) is blocked once the deadline passes or the challenge is deactivated. Scoring is the deliberate exception — a recruiter is expected to judge submissions *after* the window closes, so scoring stays available regardless of the challenge's active/expiry state. The only thing that still gates scoring is ownership: only the recruiter who posted the challenge can score its submissions.

**Ownership failures look identical to "not found."** If a recruiter tries to review, score, or deactivate a challenge that belongs to someone else, they get a `404` — the same response they'd get for a challenge ID that doesn't exist at all. This is deliberate: a `403` would confirm that a challenge with that ID exists, which is more information than the caller should have. Every service on the platform follows this rule.

**There's no AI involved in scoring.** Unlike some of the other services on this platform, challenge-service never calls Claude or any other model. Every score is a human decision made by the recruiter who owns the challenge — there's no auto-grading of submission links.

**The leaderboard is computed fresh on every request, not stored.** There's no `leaderboard_entries` table quietly updating in the background — every call to the leaderboard endpoint re-reads the scored submissions for that challenge and re-sorts them on the spot (score highest first, then earliest submission time as the tie-break). At the volumes this platform expects, that's fast enough that a cached table isn't worth the complexity. You may see a `leaderboard_entries` table sketched in [`docs/database.md`](../database.md) — that table doesn't actually exist yet; it's reserved for later if a cache ever becomes necessary.

**No names on the leaderboard.** Leaderboard entries and submission reviews carry a student's ID, never their name — this service has no way to look up a name (it doesn't share a database with auth-service, and the access token it reads doesn't carry one). The mobile app renders a short label from the ID instead.

**There's no editing.** Once posted, a challenge can't be changed — only deactivated. Once submitted, a solution link can't be changed or withdrawn — only left as-is. If a recruiter needs to fix a typo in a challenge, the only option is to deactivate it and post a new one; the old submissions stay attached to the original and don't carry over.
