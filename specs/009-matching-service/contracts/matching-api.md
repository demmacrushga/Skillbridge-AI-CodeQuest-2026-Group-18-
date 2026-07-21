# API Contract: Matching Service

**Base**: `/matching` via gateway (port 8080) | **Service port**: 8006
**Auth**: JWT Bearer on all endpoints except `/matching/health`
**Errors**: uniform `{ "error": string, "status": number }` (Constitution II)

---

## 1. Post Opportunity (RECRUITER)

```
POST /matching/opportunities
Authorization: Bearer <token>   (RECRUITER role required)
```

**Request**
```json
{
  "title": "Software Engineering Intern",
  "companyName": "Hubtel",
  "description": "Join our backend team building payment APIs...",
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

`externalUrl` is optional (http/https, ≤ 2048 chars). When present, the listing is
externally hosted: applying still records the application and returns the URL for the
client to open (see endpoint 3). Omit it for platform-internal postings.

**Response 201** — `OpportunityResponse`
```json
{
  "id": "uuid",
  "title": "Software Engineering Intern",
  "companyName": "Hubtel",
  "description": "Join our backend team building payment APIs...",
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

**Errors**: 400 (blank title/description, invalid type, empty skills, past deadline,
malformed `externalUrl`), 401, 403 (non-RECRUITER)

---

## 2. Get Ranked Matches (authenticated)

```
GET /matching/opportunities
Authorization: Bearer <token>
```

Active, non-expired opportunities scored against the caller's stored skill profile
(formula: research Decision 1), ordered `matchScore` DESC, `createdAt` DESC.
Returns the full eligible set — no pagination in v1 (volume bounded by SC-002, 500
active opportunities). Callers with the RECRUITER role receive floor scores (recruiters
cannot hold a skill profile) — useful for browsing the board as students see it.
Entries whose opportunity has an `externalUrl` are externally hosted — clients SHOULD
badge them ("External ↗").

**Response 200**
```json
{
  "matches": [
    {
      "opportunity": { "id": "uuid", "title": "Software Engineering Intern", "companyName": "Hubtel", "location": "Accra", "opportunityType": "INTERNSHIP", "deadline": "2026-08-31", "active": true, "createdAt": "2026-07-18T10:00:00Z", "description": "...", "requiredSkills": [ { "skillName": "Java", "required": true } ], "applicantCount": null },
      "matchScore": 83.33,
      "rank": 1,
      "applied": false
    }
  ]
}
```

Empty list → `{ "matches": [] }`. Empty caller skill profile → all scores `0.00`,
ordered by `createdAt` DESC.

**Errors**: 401

---

## 3. Apply to Opportunity (STUDENT)

```
POST /matching/opportunities/{opportunityId}/apply
Authorization: Bearer <token>   (STUDENT role required)
```

No body.

**Response 201**
```json
{ "id": "uuid", "opportunityId": "uuid", "appliedAt": "2026-07-18T10:05:00Z", "externalUrl": "https://hubtel.com/careers/se-intern-2026" }
```

`externalUrl` is `null` for platform-internal postings. When non-null, the application
is still recorded (click-tracking) and the client SHOULD open the URL so the student
completes the application on the external site.

**Errors**: 401, 403 (non-STUDENT), 404 (unknown/inactive/expired), 409 (already applied)

---

## 4. Get My Applications (STUDENT)

```
GET /matching/applications
Authorization: Bearer <token>   (STUDENT role required)
```

**Response 200** — ordered `appliedAt` DESC
```json
[
  {
    "id": "uuid",
    "appliedAt": "2026-07-18T10:05:00Z",
    "opportunity": { "id": "uuid", "title": "Software Engineering Intern", "companyName": "Hubtel", "location": "Accra", "opportunityType": "INTERNSHIP", "deadline": "2026-08-31", "active": true, "createdAt": "...", "description": "...", "requiredSkills": [...], "applicantCount": null }
  }
]
```

**Errors**: 401, 403 (non-STUDENT)

---

## 5. Get My Skill Profile (STUDENT)

```
GET /matching/profile/skills
Authorization: Bearer <token>   (STUDENT role required)
```

**Response 200**
```json
{ "skills": ["Java", "Spring Boot"] }
```

Empty profile → `{ "skills": [] }`.

**Errors**: 401, 403 (non-STUDENT)

---

## 6. Replace My Skill Profile (STUDENT)

```
PUT /matching/profile/skills
Authorization: Bearer <token>   (STUDENT role required)
```

**Request** — full replacement list (0–50 entries, each non-blank, ≤150 chars;
duplicates collapse case-insensitively)
```json
{ "skills": ["Java", "Spring Boot", "Docker"] }
```

**Response 200** — the stored, normalized list
```json
{ "skills": ["Java", "Spring Boot", "Docker"] }
```

**Errors**: 400 (>50 skills, blank/oversized entry), 401, 403 (non-STUDENT)

---

## 7. Get My Postings (RECRUITER)

```
GET /matching/opportunities/mine
Authorization: Bearer <token>   (RECRUITER role required)
```

**Response 200** — `[OpportunityResponse]` ordered `createdAt` DESC, includes `active: false`
postings and live `applicantCount`.

**Errors**: 401, 403 (non-RECRUITER)

---

## 8. Deactivate Own Posting (RECRUITER owner)

```
POST /matching/opportunities/{opportunityId}/deactivate
Authorization: Bearer <token>   (RECRUITER role required, must own the posting)
```

No body. Idempotent: deactivating an already-inactive posting returns 200 unchanged.

**Response 200** — `OpportunityResponse` with `active: false`

**Errors**: 401, 403 (non-RECRUITER), 404 (unknown or owned by another recruiter)

---

## 9. Get Applicants for Own Posting (RECRUITER owner)

```
GET /matching/opportunities/{opportunityId}/applications
Authorization: Bearer <token>   (RECRUITER role required, must own the posting)
```

**Response 200** — ordered `appliedAt` DESC
```json
[
  { "studentId": "uuid", "appliedAt": "2026-07-18T10:05:00Z" }
]
```

No applicants → `[]`. Student identity is the UUID only — no PII (Constitution V).

**Errors**: 401, 403 (non-RECRUITER), 404 (unknown or owned by another recruiter)

---

## 10. Health (public)

```
GET /matching/health
```

**Response 200** — `{ "status": "UP" }`
