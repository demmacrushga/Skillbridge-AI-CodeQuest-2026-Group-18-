# Career Service

**Runs on port 8002**

---

## What this service does

This service is the heart of a student's development journey on SkillBridge AI. When a student joins the platform, they tell it what career they want and what year of university they're in. The service then asks Claude to design a personalised semester-by-semester plan for them — a set of concrete things to learn, build, and earn on the way to that career goal.

As the student completes each item on the plan, they mark it done here. The service keeps track of how far along they are and updates their progress.

---

## Who uses this service

| Who | What they do |
|---|---|
| Students | Generate their career plan, check their progress, mark milestones as complete |
| Anyone (no sign-in needed) | Browse the list of available career paths |

---

## Key ideas

**Career path** — a professional goal the student is working toward, like *Software Engineer*, *Data Analyst*, *Product Manager*, or *Accountant*. Students pick one when they first join. The platform has a pre-built list of options.

**Roadmap** — the AI-generated plan created specifically for one student. It's built around their chosen career, their current year of study, and the skills they already have. Each student has one active roadmap at a time.

**Milestone** — a single item on the roadmap. It could be a skill to learn ("Master data structures"), a project to build ("Create a REST API"), a certification to earn ("Complete AWS Cloud Practitioner"), or work experience to seek. Each milestone belongs to a specific semester and has a type to help the student understand what kind of work is involved.

**Progress** — every time a student completes a milestone, the service calculates how far through the roadmap they are, as a percentage from 0 to 100. This number feeds into the student's overall Career Readiness Score later.

**How the AI works** — when a student generates their roadmap, Claude looks at their career goal, their academic level, and their current skills, then produces a realistic plan. Behind the scenes, the service caches common combinations (e.g. "Software Engineer, Level 200") for 24 hours so students with the same path get their roadmap instantly instead of waiting for a fresh AI call every time.

---

## Common journeys

**A student generating their plan for the first time**
```
POST /career/roadmap/generate   →  the full roadmap, ready to use
```

**A student checking their dashboard**
```
GET /career/roadmap/{userId}   →  the roadmap with all milestones and current progress
```

**A student completing something on their plan**
```
PATCH /career/milestones/{milestoneId}/complete   →  updated progress percentage
```

**The onboarding screen loading the career path picker**
```
GET /career/paths   →  list of all available career paths (no sign-in needed)
```

---

## Endpoints

### Browse career paths

```
GET /career/paths
```

Anyone can call this — no sign-in required. Returns the full list of career paths the platform supports. Used on the onboarding screen when a new student is choosing their goal.

**On success (200)**
```json
[
  {
    "id": "uuid",
    "name": "Software Engineer",
    "description": "Backend, frontend, and full-stack roles in software companies"
  },
  {
    "id": "uuid",
    "name": "Data Analyst",
    "description": "Data wrangling, visualisation, and reporting roles"
  }
]
```

---

### Generate a roadmap

```
POST /career/roadmap/generate
Authorization: Bearer <access_token>
```

This is what kicks off the personalised plan. Send the student's career goal, their current year of study, and the skills they already have.

```json
{
  "careerPath": "Software Engineer",
  "academicLevel": "Level 200",
  "currentSkills": ["Python", "HTML", "CSS"]
}
```

`academicLevel` must be exactly `Level 100`, `Level 200`, `Level 300`, or `Level 400`.

The service calls Claude and gets back a full semester-by-semester plan. This usually takes a few seconds.

**On success (201)**
```json
{
  "roadmapId": "uuid",
  "careerPath": "Software Engineer",
  "academicLevel": "Level 200",
  "progressPercent": 0,
  "milestones": [
    {
      "id": "uuid",
      "semester": 1,
      "title": "Learn Data Structures and Algorithms",
      "description": "Master arrays, linked lists, trees, and sorting algorithms. Practice on LeetCode or HackerRank.",
      "type": "SKILL",
      "order": 1,
      "completed": false
    },
    {
      "id": "uuid",
      "semester": 1,
      "title": "Build a personal portfolio website",
      "description": "Create a simple site showing who you are and what you've built. Host it on GitHub Pages.",
      "type": "PROJECT",
      "order": 2,
      "completed": false
    }
  ]
}
```

**What can go wrong**
- `400` — a required field is missing or `academicLevel` is not one of the four accepted values
- `401` — the student is not signed in
- `503` — the AI service is temporarily unavailable; try again shortly

> **Heads up:** Calling this when a roadmap already exists will replace the old one completely — all completion progress is lost. The app asks the student to confirm before doing this.

---

### View a roadmap

```
GET /career/roadmap/{userId}
Authorization: Bearer <access_token>
```

Returns the student's current roadmap with all milestones and which ones have been completed. Students can only see their own roadmap. Admins can look up anyone's.

**On success (200)** — same structure as the generate response above.

**What can go wrong**
- `401` — not signed in
- `404` — this student hasn't generated a roadmap yet

---

### Mark a milestone as complete

```
PATCH /career/milestones/{milestoneId}/complete
Authorization: Bearer <access_token>
```

The student taps "Mark as complete" on a milestone. They can optionally add a note explaining how they completed it — for example, linking to a project they built or mentioning a course they passed.

```json
{ "evidenceNote": "Completed the HackerRank Data Structures certification" }
```

`evidenceNote` is optional. If the milestone was already marked complete, this call does nothing harmful — it just returns 200 again without creating a duplicate record.

**On success (200)**
```json
{
  "milestoneId": "uuid",
  "title": "Learn Data Structures and Algorithms",
  "completed": true,
  "completedAt": "2026-07-01T09:30:00Z",
  "evidenceNote": "Completed the HackerRank Data Structures certification",
  "roadmapProgressPercent": 12
}
```

**What can go wrong**
- `401` — not signed in
- `404` — the milestone doesn't exist or doesn't belong to this student's roadmap

---

## Important behaviours

**Regenerating a roadmap is permanent.** If a student changes their career path or academic level and generates a new roadmap, the old one is gone. This is intentional — keeping stale plans around would confuse the student. The app always asks for confirmation first.

**The progress percentage is live.** Every time a milestone is marked complete, the percentage is recalculated on the spot. The frontend can display it immediately without refreshing the whole roadmap.

**The AI adapts to what the student already knows.** If a student already listed "Python" as a current skill, Claude won't put "Learn Python" as a milestone. The `currentSkills` field is used to skip things the student doesn't need.
