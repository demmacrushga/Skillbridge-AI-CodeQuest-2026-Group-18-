# Skill Gap Service

**Runs on port 8003**

---

## What this service does

A student uploads their CV, tells the service what job they're aiming for, and gets back a clear list of skills they're currently missing for that role — ranked from most important to least. Each missing skill comes with an explanation of why it matters and at least one concrete recommendation for how to develop it (a specific course, a project to build, or a certification to earn).

The idea is to take the guesswork out of career preparation. Instead of a student wondering "what should I learn next?", they get a direct, AI-generated answer based on their actual CV and their actual target role.

Results are saved so students can look back at past analyses and track which gaps they've already closed.

---

## Who uses this service

| Who | What they do |
|---|---|
| Students | Upload a CV, view their gap reports, delete old reports |

---

## Key ideas

**Gap report** — the output of one analysis. It contains the full list of skill gaps Claude identified, each ranked by how important it is for the target role. A student can run multiple analyses over time (e.g. each semester after updating their CV) and all of them are saved.

**Skill gap** — a single missing skill. Rank 1 means it's the most critical thing to work on for that role. Each gap has an explanation of why it matters and a list of resources to help close it.

**Resources** — each skill gap comes with at least one suggestion. Resources are categorised as a `COURSE` (something to watch or take), a `PROJECT` (something to build), or a `CERTIFICATION` (something to earn). Some resources include a direct link; others are general suggestions.

**How the CV is processed** — the uploaded file is read in memory and the text is extracted. The raw file is then discarded — nothing is saved to disk. Only the extracted text is passed to Claude. PDF and DOCX files are both supported.

**How the AI works** — Claude receives the CV text and the target role, then identifies what's missing. The service checks that what comes back is valid and ranked correctly. If Claude's response is unusable for any reason, the request fails with a clear error rather than silently saving bad data.

---

## Common journeys

**Running a new analysis**
```
POST /skill-gap/analyse   →  the gap report, ready to review
```

**Coming back to review a past report**
```
GET /skill-gap/reports/{reportId}   →  full report
```

**Seeing all past analyses**
```
GET /skill-gap/reports   →  list of all reports, newest first
```

**Cleaning up an old report**
```
DELETE /skill-gap/reports/{reportId}   →  gone completely
```

---

## Endpoints

### Upload a CV and run an analysis

```
POST /skill-gap/analyse
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

Send the CV file and the role the student is targeting. The service reads the file, sends it to Claude, and returns the results.

| What to send | Format | Rules |
|---|---|---|
| `file` | PDF or DOCX | Max 5 MB; must not be password-protected |
| `targetRole` | Plain text | e.g. `"Software Engineer"` — cannot be blank |

This usually takes 10–30 seconds depending on how long the CV is.

**On success (201)**
```json
{
  "reportId": "uuid",
  "targetRole": "Software Engineer",
  "createdAt": "2026-07-01T10:00:00Z",
  "gaps": [
    {
      "id": "uuid",
      "skillName": "System Design",
      "importanceRank": 1,
      "description": "System design is a core expectation for software engineering roles. Your CV shows strong coding ability but no evidence of designing or reasoning about large-scale systems.",
      "recommendations": [
        {
          "type": "COURSE",
          "title": "Grokking the System Design Interview",
          "url": "https://educative.io/courses/grokking-the-system-design-interview"
        },
        {
          "type": "PROJECT",
          "title": "Design and build a URL shortener — focus on the database and scaling decisions",
          "url": null
        }
      ]
    },
    {
      "id": "uuid",
      "skillName": "Docker and containerisation",
      "importanceRank": 2,
      "description": "Most engineering teams expect graduates to be comfortable running apps in containers. This skill is missing from your CV entirely.",
      "recommendations": [
        {
          "type": "COURSE",
          "title": "Docker for Beginners — freeCodeCamp",
          "url": "https://www.youtube.com/watch?v=fqMOX6JJhGo"
        }
      ]
    }
  ]
}
```

**What can go wrong**
- `400` — file is too large, the format isn't PDF or DOCX, the `targetRole` field is blank, or the PDF is password-protected
- `401` — not signed in
- `503` — the AI service is temporarily unavailable; try again in a moment

---

### View a specific report

```
GET /skill-gap/reports/{reportId}
Authorization: Bearer <access_token>
```

Returns the full report with all skill gaps and recommendations. Only the student who created the report can see it — anyone else gets a "not found" response rather than an "access denied" one. This is intentional and consistent across the platform.

**On success (200)** — same structure as the analysis response above.

**What can go wrong**
- `401` — not signed in
- `404` — the report doesn't exist or was created by a different student

---

### View all past reports

```
GET /skill-gap/reports
Authorization: Bearer <access_token>
```

Returns every gap report the signed-in student has ever run, newest first. Each entry includes the full gap list so the student can see their full history without fetching each report individually.

**On success (200)**
```json
[
  {
    "reportId": "uuid",
    "targetRole": "Software Engineer",
    "createdAt": "2026-07-01T10:00:00Z",
    "gaps": [ ... ]
  },
  {
    "reportId": "uuid",
    "targetRole": "Data Analyst",
    "createdAt": "2026-05-15T08:30:00Z",
    "gaps": [ ... ]
  }
]
```

**What can go wrong**
- `401` — not signed in

---

### Delete a report

```
DELETE /skill-gap/reports/{reportId}
Authorization: Bearer <access_token>
```

Permanently removes the report, all the skill gaps inside it, and all the resource recommendations attached to those gaps. There is no undo. Only the report's owner can delete it.

**On success (204)** — no content returned.

**What can go wrong**
- `401` — not signed in
- `404` — the report doesn't exist or belongs to someone else

---

## Important behaviours

**Every upload is a fresh analysis.** Running the service again with an updated CV creates a brand new report — it doesn't update the old one. Students can keep as many reports as they like and compare them over time. This is useful for tracking progress: upload your CV in Level 200, fix the gaps, upload again in Level 300, and see what's changed.

**Rank 1 is the highest priority.** Within a report, rank 1 is the most important skill to develop for that specific role and CV combination. The same skill might appear at different ranks in different reports if the CV or role changes.

**The file is never stored.** After the text is extracted from the uploaded CV, the file itself is discarded. The service only keeps the text and the analysis results.

**Reports are snapshots.** Once created, a report never changes. The AI doesn't go back and revise old reports. If a student improves their CV and re-runs the analysis, they get a new report with new results.
