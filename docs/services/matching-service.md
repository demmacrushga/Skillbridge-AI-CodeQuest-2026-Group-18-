# Matching Service

**Runs on port 8006**

---

## What this service does

This service connects students to internship and entry-level job opportunities. Recruiters post listings — a title, company, description, location, type, an optional deadline, an optional link to an external application page, and a list of required skills, each marked as either a must-have or a nice-to-have.

Students keep their own skill list inside this service — it isn't pulled from any other service, it's just a plain list the student maintains here. When a student pulls up the opportunities board, the service scores every open listing against that skill list using a transparent, hand-verifiable formula (must-haves count double), and returns the list ranked best match first. Applying takes one tap — the system records the application and, for listings that link out to a company's own site, hands back that link so the app can send the student there to finish up.

Recruiters can see their own postings with live applicant counts, close a posting once they're done with it, and see who applied.

There is no AI anywhere in this service. Scoring is a deterministic formula computed fresh on every request — deliberately so, so the number behind every match can be explained and checked by hand.

---

## Who uses this service

| Who | What they do |
|---|---|
| Students | View ranked matches, apply to opportunities, view their own applications, view and replace their skill list |
| Recruiters | Post opportunities, view their own postings, deactivate their own postings, see who applied to their own postings |

Anyone signed in — student or recruiter — can browse the ranked opportunities board. A recruiter calling it sees the same board a student would, just scored at zero across the board (recruiters don't hold a skill list) — that's intentional, not a bug, and lets a recruiter browse the board the way a student experiences it.

---

## Key ideas

**Opportunity** — a listing posted by a recruiter: title, company, description, an optional location, a type (`INTERNSHIP` or `ENTRY_LEVEL` — must be typed exactly this way, the system doesn't accept lowercase), an optional deadline, an optional external URL, and a list of required skills. An opportunity is `active` by default.

**Open for matching** — like a challenge's expiry, this isn't a stored flag. An opportunity is eligible to appear on the match list and to be applied to only while it's `active` and its deadline (if it has one) hasn't passed. Once the deadline passes, it quietly stops appearing and starts rejecting new applications.

**Required skills** — each skill on an opportunity is flagged `required: true` (a must-have) or `required: false` (a nice-to-have). This flag drives the scoring weight: must-haves count twice as much as nice-to-haves.

**Student skill profile** — a student's own list of skills, stored entirely within this service. There's no "add one skill" or "remove one skill" endpoint — updating the list replaces it wholesale. Matching skill names is case- and whitespace-insensitive on both sides, so a student who types "spring boot" still matches an opportunity that asks for "Spring Boot".

**Match score** — a number from 0.00 to 100.00 showing how well a student's skills line up with an opportunity's required skills. It's computed like this: every required skill contributes a weight to the opportunity's total — 2 if it's a must-have, 1 if it's a nice-to-have. The score is the percentage of that total weight the student actually covers. A student who has every must-have but none of the nice-to-haves still scores well; a student with only the nice-to-haves scores much lower. If a student has no skills listed, or an opportunity somehow has no required skills, the score is 0.00 — never an error.

The score is never cached — it's recalculated every time the match list is requested, which means updating a skill profile is reflected immediately on the very next request.

**Application** — a record that a student applied to an opportunity. A student can only apply to a given opportunity once. There's no "withdraw" — an application, once made, stays on record even if the opportunity is later deactivated.

**Deactivation, not deletion** — a recruiter can deactivate their own posting. It disappears from the match list and stops accepting new applications, but every application already made against it (and every applicant count) is untouched. There's no "reactivate" and no edit endpoint — the only way to fix a posting is to deactivate it and post a corrected one.

---

## Common journeys

**A student updates their skills and checks their matches**
```
PUT  /matching/profile/skills        →  skill list replaced, normalized and deduplicated
GET  /matching/opportunities         →  ranked matches recalculated using the new skill list
```

**A student applies to an opportunity**
```
GET  /matching/opportunities                                →  ranked list, each flagged applied: true/false
POST /matching/opportunities/{id}/apply                     →  application recorded (externalUrl returned if external)
GET  /matching/applications                                 →  shows up in application history
```

**A recruiter posts and manages an opportunity**
```
POST /matching/opportunities                                          →  opportunity created, 0 applicants
GET  /matching/opportunities/mine                                     →  own postings with live applicant counts
GET  /matching/opportunities/{id}/applications                        →  who applied
POST /matching/opportunities/{id}/deactivate                          →  closed to new applications; history untouched
```

---

## Endpoints

All endpoints are under `/matching`. Every endpoint except the health check requires `Authorization: Bearer <access_token>`.

### Health check

```
GET /matching/health
```

Open to everyone — no sign-in needed.

**On success (200)** — `{ "status": "UP" }`

---

### Post an opportunity

```
POST /matching/opportunities
Authorization: Bearer <access_token>   (recruiter only)
```

```json
{
  "title": "Software Engineering Intern",
  "companyName": "Hubtel",
  "description": "Join our backend team building payment APIs.",
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

| Field | Rules |
|---|---|
| `title` | Required. Cannot be blank. Max 255 characters. |
| `companyName` | Required. Cannot be blank. Max 255 characters. |
| `description` | Required. Cannot be blank. Max 5,000 characters. |
| `location` | Optional. Max 255 characters. |
| `opportunityType` | Required. Must be exactly `INTERNSHIP` or `ENTRY_LEVEL`. |
| `deadline` | Optional. If set, must be today or a future date. |
| `externalUrl` | Optional. Must start with `http://` or `https://`. Max 2,048 characters. |
| `requiredSkills` | Required. 1 to 30 entries. |
| `requiredSkills[].skillName` | Required. Cannot be blank. Max 150 characters. |
| `requiredSkills[].required` | A true/false flag. If omitted, it's treated as `false` (nice-to-have) — always send it explicitly. |

**On success (201)** — the new opportunity.
```json
{
  "id": "uuid",
  "title": "Software Engineering Intern",
  "companyName": "Hubtel",
  "description": "Join our backend team building payment APIs.",
  "location": "Accra",
  "opportunityType": "INTERNSHIP",
  "deadline": "2026-08-31",
  "externalUrl": "https://hubtel.com/careers/se-intern-2026",
  "active": true,
  "createdAt": "2026-07-18T10:00:00Z",
  "requiredSkills": [
    { "skillName": "Java", "required": true },
    { "skillName": "Spring Boot", "required": true },
    { "skillName": "PostgreSQL", "required": false }
  ],
  "applicantCount": 0
}
```

**What can go wrong**
- `400` — title, company name, or description is blank or too long; `opportunityType` is missing or not exactly `INTERNSHIP`/`ENTRY_LEVEL`; `requiredSkills` is empty or has more than 30 entries, or a skill name is blank or too long; `deadline` is before today; `externalUrl` doesn't start with http/https or is too long
- `401` — not signed in
- `403` — signed in, but not a recruiter

---

### View ranked matches

```
GET /matching/opportunities
Authorization: Bearer <access_token>
```

Scores every open opportunity against the signed-in student's skill list and returns them ranked best-match first (ties broken by the newest posting). Each entry shows whether the student already applied. A recruiter calling this sees every open opportunity at a score of 0.00, since recruiters don't have a skill list — this lets a recruiter browse the same board a student sees.

**On success (200)**
```json
{
  "matches": [
    {
      "opportunity": {
        "id": "uuid",
        "title": "Software Engineering Intern",
        "companyName": "Hubtel",
        "description": "Join our backend team building payment APIs.",
        "location": "Accra",
        "opportunityType": "INTERNSHIP",
        "deadline": "2026-08-31",
        "externalUrl": null,
        "active": true,
        "createdAt": "2026-07-18T10:00:00Z",
        "requiredSkills": [
          { "skillName": "Java", "required": true },
          { "skillName": "Spring Boot", "required": true },
          { "skillName": "PostgreSQL", "required": false }
        ]
      },
      "matchScore": 80.00,
      "rank": 1,
      "applied": false
    }
  ]
}
```
An empty board, or a student with no skills listed at all, both return normally — a student with no skills simply sees every opportunity at 0.00, ordered by newest first, rather than an error.

**What can go wrong**
- `401` — not signed in

---

### Apply to an opportunity

```
POST /matching/opportunities/{opportunityId}/apply
Authorization: Bearer <access_token>   (student only)
```

No body needed.

**On success (201)** — the recorded application.
```json
{
  "id": "uuid",
  "opportunityId": "uuid",
  "appliedAt": "2026-07-18T10:05:00Z",
  "externalUrl": "https://hubtel.com/careers/se-intern-2026"
}
```
`externalUrl` is `null` for postings that don't link out anywhere. When it's present, the app should take the student there to actually finish applying — this endpoint records intent to apply, not confirmation that the recruiter received a completed application.

**What can go wrong**
- `401` — not signed in
- `403` — signed in, but not a student
- `404` — the opportunity doesn't exist, or it's inactive, or its deadline has passed (all three look identical from the outside)
- `409` — already applied to this opportunity

---

### See my applications

```
GET /matching/applications
Authorization: Bearer <access_token>   (student only)
```

Returns every application the signed-in student has made, newest first, each with the full opportunity it points to. An opportunity stays visible here even after the recruiter deactivates it — application history is never rewritten.

**On success (200)**
```json
[
  {
    "id": "uuid",
    "appliedAt": "2026-07-18T10:05:00Z",
    "opportunity": {
      "id": "uuid",
      "title": "Software Engineering Intern",
      "companyName": "Hubtel",
      "description": "Join our backend team building payment APIs.",
      "location": "Accra",
      "opportunityType": "INTERNSHIP",
      "deadline": "2026-08-31",
      "externalUrl": null,
      "active": true,
      "createdAt": "2026-07-18T10:00:00Z",
      "requiredSkills": [ { "skillName": "Java", "required": true } ]
    }
  }
]
```

**What can go wrong**
- `401` — not signed in
- `403` — signed in, but not a student

---

### See my skill list

```
GET /matching/profile/skills
Authorization: Bearer <access_token>   (student only)
```

**On success (200)** — `{ "skills": ["Java", "Spring Boot"] }`. An empty list if none have been set.

**What can go wrong**
- `401` — not signed in
- `403` — signed in, but not a student

---

### Replace my skill list

```
PUT /matching/profile/skills
Authorization: Bearer <access_token>   (student only)
```

```json
{ "skills": ["Java", "Spring Boot", "Docker"] }
```

| Field | Rules |
|---|---|
| `skills` | Required. Up to 50 entries. Each entry cannot be blank and must be 150 characters or fewer. |

This replaces the student's entire skill list in one go — there's no way to add or remove a single skill. The list is cleaned up automatically: extra whitespace is trimmed and collapsed, and duplicate skills that only differ by case or spacing are merged into one (the first spelling typed is what's kept).

**On success (200)** — the stored, cleaned-up list.
```json
{ "skills": ["Java", "Spring Boot", "Docker"] }
```

**What can go wrong**
- `400` — more than 50 skills, or any entry is blank or too long
- `401` — not signed in
- `403` — signed in, but not a student

---

### See my postings (recruiter)

```
GET /matching/opportunities/mine
Authorization: Bearer <access_token>   (recruiter only)
```

Returns every opportunity the signed-in recruiter has posted — including deactivated ones — newest first, each with a live applicant count.

**On success (200)**
```json
[
  {
    "id": "uuid",
    "title": "Software Engineering Intern",
    "companyName": "Hubtel",
    "description": "Join our backend team building payment APIs.",
    "location": "Accra",
    "opportunityType": "INTERNSHIP",
    "deadline": "2026-08-31",
    "externalUrl": "https://hubtel.com/careers/se-intern-2026",
    "active": true,
    "createdAt": "2026-07-18T10:00:00Z",
    "requiredSkills": [ { "skillName": "Java", "required": true } ],
    "applicantCount": 3
  }
]
```

**What can go wrong**
- `401` — not signed in
- `403` — signed in, but not a recruiter

---

### Deactivate a posting (recruiter)

```
POST /matching/opportunities/{opportunityId}/deactivate
Authorization: Bearer <access_token>   (recruiter only, must own the posting)
```

No body needed. Removes the posting from the match list and blocks new applications. Everyone who already applied stays on record. Calling this twice is harmless — it just returns the current, already-deactivated state.

**On success (200)** — the opportunity, now inactive.
```json
{
  "id": "uuid",
  "title": "Software Engineering Intern",
  "companyName": "Hubtel",
  "description": "Join our backend team building payment APIs.",
  "location": "Accra",
  "opportunityType": "INTERNSHIP",
  "deadline": "2026-08-31",
  "externalUrl": "https://hubtel.com/careers/se-intern-2026",
  "active": false,
  "createdAt": "2026-07-18T10:00:00Z",
  "requiredSkills": [ { "skillName": "Java", "required": true } ],
  "applicantCount": 3
}
```

**What can go wrong**
- `401` — not signed in
- `403` — signed in, but not a recruiter
- `404` — the posting doesn't exist or isn't owned by this recruiter

---

### See who applied (recruiter)

```
GET /matching/opportunities/{opportunityId}/applications
Authorization: Bearer <access_token>   (recruiter only, must own the posting)
```

**On success (200)** — a list of applicants, newest first. Only a student ID is included — no name or contact details, since this service has no way to look those up.
```json
[
  { "studentId": "uuid", "appliedAt": "2026-07-18T10:05:00Z" }
]
```
No applicants yet → `[]`.

**What can go wrong**
- `401` — not signed in
- `403` — signed in, but not a recruiter
- `404` — the posting doesn't exist or isn't owned by this recruiter

---

## Important behaviours

**Must-haves count double.** When scoring a match, every required skill an opportunity lists contributes a weight toward the total — 2 for a must-have, 1 for a nice-to-have. The score is the percentage of that total weight the student's skills cover. This means a student who covers every must-have but none of the nice-to-haves will always outrank one who covers only the nice-to-haves, which is the point: must-haves matter more.

**Skill matching ignores case and extra spacing.** "spring boot", "Spring   Boot", and "SPRING BOOT" are all treated as the same skill, on both the student's list and an opportunity's required list.

**A "not found" response protects privacy.** If a recruiter tries to deactivate or view applicants for a posting they don't own, they get a 404 ("not found") rather than a 403 ("access denied") — the same response they'd get for an ID that doesn't exist at all. A 403 would confirm the posting exists, which is more than the caller should be able to learn. Every service on this platform follows this rule.

**Deactivating never erases anything.** A deactivated posting drops off the match list and stops accepting new applications, but applications already made against it stay fully visible in the student's own history, and the recruiter's own view of the posting (with its applicant count) stays intact.

**There's no edit endpoint.** A recruiter who needs to correct a posting has to deactivate it and post a new one — there's no way to patch an existing listing's fields.

**Scores are never cached.** There's no background job recomputing matches — every call to the match list endpoint recalculates every score on the spot from the student's current skill list. Update your skills, and the very next request reflects it immediately.

**Any signed-in role can browse the match list.** `GET /matching/opportunities` doesn't check for a student role — a recruiter can call it too, and will see the same open postings scored at 0.00 across the board, since they hold no skill list. This lets a recruiter see the board exactly as students experience it.

**Skill profile updates are all-or-nothing.** There's no way to add or remove a single skill — `PUT /matching/profile/skills` always replaces the entire list. If a student wants to add one skill, they resend the full list with the new one included.

**No AI is involved.** Unlike some other services on this platform, matching-service never calls Claude or any other model. Every match score comes from the weighted-overlap formula described above — deliberately, so scores are cheap to compute and easy to verify by hand.
