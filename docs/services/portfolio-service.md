# Portfolio Service

**Runs on port 8004**

---

## What this service does

This service manages each student's professional portfolio — the collection of projects, certifications, and achievements that make up their public profile on the platform.

Students add their work here. They can do it manually (filling in a title and description), or let the AI scan their CV or GitHub profile and suggest what to include. Once an item is added, the student can request a verification: Claude reviews it and decides whether it's credible. Verified items get a trust badge. Admins can step in and override any AI decision if needed.

Students can also generate a shareable link to their portfolio — a public page that only shows their verified work. Recruiters use this when reviewing candidates.

---

## Who uses this service

| Who | What they do |
|---|---|
| Students | Add, edit, and delete items; request verification; import from CV or GitHub; generate a share link |
| Admins | Review and override any AI verification decision |
| Anyone (no sign-in needed) | View a student's public portfolio using a share link |

---

## Key ideas

**Portfolio item** — a single entry in a student's portfolio. It has a type (Project, Certification, or Achievement), a title, an optional description, and an optional link to the work (GitHub repo, certificate URL, etc.). Items start off unverified.

**Verification** — when a student asks for their item to be verified, Claude looks at the title, description, type, and external link, and returns a decision: `APPROVED` or `REJECTED`, along with a short explanation. This happens in a few seconds. If Claude is unavailable, the item is saved as "pending" — the student isn't blocked, and an admin can review it later.

**Verification status** — where a particular item stands in the verification process:

| Status | What it means |
|---|---|
| `NONE` | The student hasn't asked for verification yet |
| `PENDING` | Verification was requested but Claude was unavailable — awaiting a human review |
| `APPROVED` | The item passed verification and now has a trust badge |
| `REJECTED` | The item didn't pass verification |

**Who reviewed it** — tracked alongside the status:

| Source | What it means |
|---|---|
| `AI` | Claude made the decision |
| `HUMAN` | An admin stepped in and overrode the AI decision |
| `PENDING_FALLBACK` | The AI was unavailable when verification was requested |

**Share link** — a unique URL the student can send to anyone. It shows only their verified items. Generating the link multiple times always returns the same URL — it doesn't create a new one each time.

**Importing items** — instead of adding items one by one manually, the student can upload their CV or paste a website URL (like their GitHub profile). Claude reads the content and suggests which things are worth adding to the portfolio. The student then picks which suggestions they want to save. Nothing is added automatically without the student confirming.

---

## Common journeys

**A student adding and verifying a project**
```
POST /portfolio/items              →  item saved, not yet verified
POST /portfolio/items/{id}/verify  →  AI decision returned immediately
```

**A student importing from their CV**
```
POST /portfolio/extract   (with CV file)   →  AI suggestions, nothing saved yet
POST /portfolio/items/batch                →  student saves the ones they want
```

**A student sharing their portfolio with a recruiter**
```
POST /portfolio/share   →  share URL
```
The recruiter opens the URL — they see only the verified items, no sign-in needed.

**An admin correcting a wrong AI decision**
```
PATCH /portfolio/verification/{requestId}   →  decision updated, source marked as HUMAN
```

---

## Endpoints

### Add an item

```
POST /portfolio/items
Authorization: Bearer <access_token>
```

```json
{
  "itemType": "PROJECT",
  "title": "Student Result Management System",
  "description": "A full-stack web app for managing exam results. Built with React and Spring Boot. Used by 200+ students across three departments.",
  "externalUrl": "https://github.com/username/results-system"
}
```

`itemType` must be `PROJECT`, `CERTIFICATION`, or `ACHIEVEMENT`. Including an `externalUrl` is optional but strongly recommended — it gives Claude much more to work with during verification.

**On success (201)** — the saved item, with `verified: false` and `verificationStatus: "NONE"`.

**What can go wrong**
- `400` — title is missing, type is invalid
- `401` — not signed in

---

### See all my portfolio items

```
GET /portfolio/mine
Authorization: Bearer <access_token>
```

Returns everything in the student's portfolio, including unverified items. Each item shows its current verification status.

**On success (200)**
```json
[
  {
    "id": "uuid",
    "itemType": "PROJECT",
    "title": "Student Result Management System",
    "verified": true,
    "verificationStatus": "APPROVED",
    "reviewSource": "AI",
    "displayOrder": 0
  }
]
```

---

### View a student's public portfolio

```
GET /portfolio/{userId}
```

No sign-in needed. Returns only the items that have been verified (`verified: true`). Used when a recruiter is browsing a student's profile, and when someone opens a share link.

---

### Update an item

```
PUT /portfolio/items/{itemId}
Authorization: Bearer <access_token>
```

Replaces the item's content. One important thing: **if the item was verified, editing it resets its verification**. The badge is removed and the status goes back to `NONE`. The student will need to request verification again after updating. This is intentional — the AI verified a specific piece of content, not the item in general.

**On success (200)** — the updated item.

**What can go wrong**
- `400`, `401`, `404`

---

### Delete an item

```
DELETE /portfolio/items/{itemId}
Authorization: Bearer <access_token>
```

Permanently removes the item. If a verification request existed for it, that's removed too.

**On success (204)** — nothing returned.

**What can go wrong**
- `401` — not signed in
- `404` — item doesn't exist or belongs to someone else

---

### Request AI verification

```
POST /portfolio/items/{itemId}/verify
Authorization: Bearer <access_token>
```

No body needed. Claude looks at the item and returns a decision within a few seconds. The student sees the result immediately.

If Claude is unavailable at that moment, the item is saved as `PENDING` and the student gets a normal 200 response — they're not blocked. An admin can review it later.

**On success (200)**
```json
{
  "id": "uuid",
  "portfolioItemId": "uuid",
  "status": "APPROVED",
  "reviewerNote": "Public GitHub repository is present and active. The project scope matches the description. Approved.",
  "reviewSource": "AI",
  "requestedAt": "2026-07-01T10:00:00Z",
  "reviewedAt": "2026-07-01T10:00:03Z"
}
```

**What can go wrong**
- `401` — not signed in
- `404` — item doesn't exist or belongs to someone else
- `409` — a verification request is already pending for this item (can't have two at once)

---

### Admin — override a verification decision

```
PATCH /portfolio/verification/{requestId}
Authorization: Bearer <access_token>   (admin only)
```

Admins use this when the AI got something wrong — either approving something it shouldn't have, or rejecting something that's clearly legitimate.

```json
{
  "decision": "APPROVED",
  "reviewerNote": "GitHub repository confirmed. The student is listed as the primary contributor."
}
```

`decision` must be `APPROVED` or `REJECTED`. The record is updated and the source is marked as `HUMAN` so it's clear a person made this call.

**On success (200)** — the updated verification record.

**What can go wrong**
- `400` — decision value is invalid
- `401` — not signed in
- `403` — signed in, but not an admin
- `404` — the verification request doesn't exist

---

### Generate a share link

```
POST /portfolio/share
Authorization: Bearer <access_token>
```

Creates a public URL the student can share with recruiters or save in their CV. Calling this multiple times always returns the same URL — it doesn't create a new link each time.

**On success (200)**
```json
{ "shareUrl": "https://skillbridge.ai/portfolio/share/aGVsbG8gd29ybGQ" }
```

---

### Save multiple items at once

```
POST /portfolio/items/batch
Authorization: Bearer <access_token>
```

For when a student wants to add several things at once — for example, after importing from their CV. Up to 50 items in one request. Either all of them are saved or none of them are — if one item has a problem, nothing is saved.

```json
{
  "items": [
    { "itemType": "PROJECT", "title": "E-commerce API", "description": "Spring Boot REST API", "externalUrl": "https://github.com/user/repo" },
    { "itemType": "CERTIFICATION", "title": "AWS Cloud Practitioner", "description": "Issued May 2026", "externalUrl": null }
  ]
}
```

**On success (201)** — array of all saved items.

**What can go wrong**
- `400` — the list is empty, contains more than 50 items, or one of the items has a missing or invalid field
- `401` — not signed in

---

### Import items from a CV

```
POST /portfolio/extract
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

Upload a CV (PDF or DOCX, max 5 MB). Claude reads it and suggests which things are worth adding to the portfolio, along with a confidence score for each suggestion. Nothing is saved yet — the student chooses which suggestions to keep and then saves them using the batch endpoint above.

**On success (200)**
```json
[
  {
    "itemType": "PROJECT",
    "title": "E-commerce API",
    "description": "Spring Boot REST API for online retail",
    "externalUrl": "https://github.com/user/repo",
    "confidence": 0.92
  },
  {
    "itemType": "CERTIFICATION",
    "title": "AWS Cloud Practitioner",
    "description": "Issued May 2026",
    "externalUrl": null,
    "confidence": 0.87
  }
]
```

If nothing portfolio-worthy is found, the response is an empty list `[]`.

The `confidence` score (0 to 1) is a rough indicator of how certain Claude is that the suggestion is worth including. It's shown in the app to help the student decide — it has no effect on the actual items if they're saved.

**What can go wrong**
- `400` — wrong file type, file too large, or the PDF is password-protected
- `401` — not signed in
- `503` — the AI service is temporarily unavailable

---

### Import items from a website

```
POST /portfolio/extract-url
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{ "url": "https://github.com/username" }
```

Works the same as the CV import but from a public web page instead of a file. Claude fetches the page and suggests portfolio items from what it finds. Same response format and the same confirmation-before-saving behaviour.

**What can go wrong**
- `400` — the URL is not valid
- `401` — not signed in
- `502` — the URL couldn't be reached or returned an error
- `503` — the AI service is temporarily unavailable

---

## Important behaviours

**Verification is optional.** Students can build a complete portfolio without ever verifying anything. Verification adds a trust badge that makes items more credible to recruiters, but the portfolio works fine without it.

**Editing a verified item removes the badge.** This is by design — the badge was earned for a specific version of the item. Once the content changes, the old decision no longer applies.

**The AI never auto-saves anything.** When importing from a CV or URL, Claude only suggests items. The student has to actively choose which ones to save. Nothing appears in their portfolio without their explicit action.

**There's no limit on portfolio size** in v1. Students can add as many items as they like.
