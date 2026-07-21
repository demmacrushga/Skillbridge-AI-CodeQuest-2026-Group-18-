# Mentorship Service

**Runs on port 8008**

---

## What this service does

This service connects students with alumni mentors and gives them a place to talk. Alumni set up a mentor profile — their current role, company, industry, a handful of free-text career-interest tags, a short bio, and a switch saying whether they're currently open to new mentees. Students search those profiles by interest and industry, pick an alumnus, and send a mentorship request with an optional introductory note.

The alumnus accepts or declines each request. Accepting turns it into an active mentorship pair, and from that point the two exchange messages inside the app — no email addresses or phone numbers change hands. Either side can end the mentorship when it's run its course; the conversation history stays readable afterwards.

There is no AI anywhere in this service. Alumni discovery ranking is a plain tag-overlap count — deliberately hand-verifiable, the same philosophy as the matching and challenge services.

---

## Who uses this service

| Who | What they do |
|---|---|
| Alumni | Maintain their mentor profile and availability, review incoming requests, accept or decline them, message their mentees, end mentorships |
| Students | Search available alumni by interest/industry, send (and cancel) mentorship requests, track their sent requests, message their mentors, end mentorships |

Both sides see their own mentorship pairs and share the same message threads. Recruiters and admins have no role here — they can technically call the "my pairs" endpoint and will simply get an empty list.

---

## Key ideas

**Mentor profile & the availability toggle** — one profile per alumnus, saved as a full replace: every `PUT` overwrites the whole profile, there's no field-by-field patch. The `available` flag is the alumnus's own throttle — flip it off and they vanish from student searches and stop receiving new requests, but every existing mentorship and message thread carries on untouched. There is no system-enforced cap on how many mentees an alumnus can have; the toggle is how they self-regulate.

**Interest tags & how search ranking works** — career interests are free-text tags (1–20 of them, e.g. "backend engineering", "fintech"), not a controlled vocabulary. A student's search matches them by exact, case-insensitive comparison after trimming extra whitespace. Results include only available profiles, ranked by how many of the student's searched tags each profile matches (most first), with the most-recently-updated profile winning ties. A search with no filters is just a browse: every available profile, newest-updated first.

**Mentorship request** — a student's ask to a specific alumnus, with an optional note. It has a four-state lifecycle: it starts `PENDING` and ends in exactly one of `ACCEPTED` (alumnus says yes — a pair is created), `DECLINED` (alumnus says no), or `CANCELLED` (the student withdraws it). Cancelling is the escape hatch: requests never expire on their own, so if an alumnus simply never responds, the student cancels and is immediately free to request someone else — or the same alumnus again later. A student can only have one pending request per alumnus at a time, and can't request an alumnus they're already actively paired with.

**Pair** — the actual mentorship relationship, created only by an accepted request (it keeps a reference to that request as provenance). A pair is `ACTIVE` until either participant ends it, at which point it becomes `ENDED` — permanently; there's no restart. A new mentorship between the same two people means a new request and a new pair.

**Messages & read receipts** — plain text messages inside a pair's thread, oldest first. Each message carries a single `readAt` timestamp, stamped automatically the moment the *recipient* fetches the thread — there's no "mark as read" button, no typing indicators, no attachments, no push notifications in v1.

**Ending vs history** — ending a pair closes the thread to new messages, but deletes nothing. Both former participants can still read the entire conversation and still see the pair in their history.

---

## Common journeys

**An alumnus becomes a mentor**
```
PUT  /mentorship/profile                          →  mentor profile created, available: true
  ... a student finds them and sends a request ...
GET  /mentorship/requests/incoming                 →  pending requests, newest first
POST /mentorship/requests/{id}/accept              →  request ACCEPTED, active pair created
GET  /mentorship/pairs/{pairId}/messages           →  read the thread (marks messages read)
POST /mentorship/pairs/{pairId}/messages           →  reply
```

**A student finds a mentor (and keeps options open)**
```
GET  /mentorship/alumni?interest=fintech           →  available alumni, best match first
POST /mentorship/requests                          →  request sent, PENDING
POST /mentorship/requests/{id}/cancel              →  (if no answer) withdrawn — free to try elsewhere
  ... or the alumnus accepts ...
GET  /mentorship/pairs/mine                        →  the new ACTIVE pair
POST /mentorship/pairs/{pairId}/messages           →  say hello
POST /mentorship/pairs/{pairId}/end                →  wrap up when it's run its course
```

---

## Endpoints

All endpoints are under `/mentorship`. Every endpoint except the health check requires `Authorization: Bearer <access_token>`.

### Health check

```
GET /mentorship/health
```

Open to everyone — no sign-in needed.

**On success (200)** — `{ "status": "UP" }`

---

### Get my mentor profile

```
GET /mentorship/profile
Authorization: Bearer <access_token>   (alumni only)
```

**On success (200)** — the caller's stored profile.
```json
{
  "id": "uuid",
  "userId": "uuid",
  "currentRole": "Senior Backend Engineer",
  "company": "Hubtel",
  "industry": "Fintech",
  "careerInterests": ["backend engineering", "fintech", "mentoring juniors"],
  "bio": "Class of 2019. Happy to help with interview prep and career switching.",
  "available": true,
  "updatedAt": "2026-07-19T10:00:00Z"
}
```

**What can go wrong**
- `401` — not signed in
- `403` — signed in, but not an alumnus
- `404` — no profile created yet

---

### Create or replace my mentor profile

```
PUT /mentorship/profile
Authorization: Bearer <access_token>   (alumni only)
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

| Field | Rules |
|---|---|
| `currentRole`, `company` | Optional. Max 150 characters each. |
| `industry` | Optional. Max 100 characters. |
| `careerInterests` | Required. 1 to 20 tags, each non-blank and max 50 characters. Whitespace is trimmed and collapsed; duplicates that differ only by case are merged (the first spelling typed is kept). |
| `bio` | Optional. Max 2,000 characters. |
| `available` | Required true/false. |

Works as an upsert: the first call creates the profile, every later call replaces it entirely. `updatedAt` is refreshed each time.

**On success (200)** — the stored profile, with normalized tag values.

**What can go wrong**
- `400` — missing tags, too many tags, a blank or too-long field, or `available` omitted
- `401` — not signed in
- `403` — signed in, but not an alumnus

---

### Search alumni

```
GET /mentorship/alumni?interest=fintech&interest=backend%20engineering&industry=Fintech
Authorization: Bearer <access_token>   (student only)
```

All filters are optional; `interest` can be repeated. Matching is exact but case-insensitive (after tidying whitespace). Only available alumni appear, ordered by how many searched tags they match, most first, with most-recently-updated as the tie-break. No filters at all returns every available profile, newest-updated first.

**On success (200)**
```json
{
  "alumni": [
    {
      "alumniId": "uuid",
      "currentRole": "Senior Backend Engineer",
      "company": "Hubtel",
      "industry": "Fintech",
      "careerInterests": ["backend engineering", "fintech"],
      "bio": "Class of 2019...",
      "matchingTags": 2,
      "updatedAt": "2026-07-19T10:00:00Z"
    }
  ]
}
```
No matches → `{ "alumni": [] }`, not an error.

**What can go wrong**
- `401` — not signed in
- `403` — signed in, but not a student

---

### Send a mentorship request

```
POST /mentorship/requests
Authorization: Bearer <access_token>   (student only)
```

```json
{ "alumniId": "uuid", "message": "Hi! I'm targeting backend roles and would love guidance." }
```

| Field | Rules |
|---|---|
| `alumniId` | Required. The alumnus's user ID, as returned by search. |
| `message` | Optional. Max 1,000 characters. |

**On success (201)** — the new request.
```json
{
  "id": "uuid",
  "studentId": "uuid",
  "alumniId": "uuid",
  "message": "Hi! I'm targeting backend roles and would love guidance.",
  "status": "PENDING",
  "createdAt": "2026-07-19T10:05:00Z",
  "respondedAt": null
}
```

**What can go wrong**
- `400` — `alumniId` missing, or the note is too long
- `401` — not signed in
- `403` — signed in, but not a student
- `404` — the alumnus has no profile, or has switched availability off (the two look identical from the outside)
- `409` — this student already has a pending request or an active mentorship with this alumnus

---

### Cancel a request

```
POST /mentorship/requests/{requestId}/cancel
Authorization: Bearer <access_token>   (student only, must be the sender)
```

No body needed. Marks the student's own still-pending request `CANCELLED`. This is the only way a student can get out of `PENDING` — requests never expire automatically — and cancelling immediately frees them to send a new request to the same alumnus.

**On success (200)** — the request with `status: "CANCELLED"` and `respondedAt` set.

**What can go wrong**
- `401` — not signed in
- `403` — signed in, but not a student
- `404` — the request doesn't exist, or it was sent by a different student (both look identical)
- `409` — the request was already accepted, declined, or cancelled

---

### See my sent requests

```
GET /mentorship/requests/mine
Authorization: Bearer <access_token>   (student only)
```

Every request the student has ever sent, in every status, newest first. Empty history → `[]`.

**What can go wrong**
- `401` — not signed in
- `403` — signed in, but not a student

---

### See my incoming requests (alumni)

```
GET /mentorship/requests/incoming
Authorization: Bearer <access_token>   (alumni only)
```

Only requests addressed to the caller that are still `PENDING`, newest first. Nothing waiting → `[]`.

**What can go wrong**
- `401` — not signed in
- `403` — signed in, but not an alumnus

---

### Accept a request (alumni)

```
POST /mentorship/requests/{requestId}/accept
Authorization: Bearer <access_token>   (alumni only, must be the addressee)
```

No body needed. Marks the request `ACCEPTED` and creates the active mentorship pair in the same step.

**On success (200)** — the new pair.
```json
{
  "id": "uuid",
  "studentId": "uuid",
  "alumniId": "uuid",
  "status": "ACTIVE",
  "startedAt": "2026-07-19T10:10:00Z",
  "endedAt": null
}
```

**What can go wrong**
- `401` — not signed in
- `403` — signed in, but not an alumnus
- `404` — the request doesn't exist, or is addressed to a different alumnus (both look identical)
- `409` — the request was already accepted or declined

---

### Decline a request (alumni)

```
POST /mentorship/requests/{requestId}/decline
Authorization: Bearer <access_token>   (alumni only, must be the addressee)
```

No body needed. Marks the request `DECLINED`; no pair is created. The student is free to send a new request to the same alumnus later — there's no cooldown.

**On success (200)** — the request with `status: "DECLINED"` and `respondedAt` set.

**What can go wrong**
- `401` — not signed in
- `403` — signed in, but not an alumnus
- `404` — the request doesn't exist, or isn't addressed to the caller
- `409` — the request was already resolved

---

### See my mentorships

```
GET /mentorship/pairs/mine
Authorization: Bearer <access_token>
```

Every pair the caller is part of — as student or as alumnus, active and ended alike — newest first. Any signed-in role can call this: the list is scoped strictly to the caller's own user ID, so a recruiter or admin (who can never be a participant) simply gets `[]` back, not a 403.

**On success (200)** — a list of pairs. No mentorships yet → `[]`.

**What can go wrong**
- `401` — not signed in

---

### End a mentorship

```
POST /mentorship/pairs/{pairId}/end
Authorization: Bearer <access_token>   (must be a participant)
```

No body needed. Either participant can end the pair — no agreement from the other side is required. Sets `status: "ENDED"` and `endedAt`; the message history is untouched and stays readable. Ending an already-ended pair is harmless: it returns 200 with the same state.

**On success (200)** — the pair with `status: "ENDED"`.

**What can go wrong**
- `401` — not signed in
- `404` — the pair doesn't exist, or the caller isn't a participant (both look identical)

---

### Read a message thread

```
GET /mentorship/pairs/{pairId}/messages
Authorization: Bearer <access_token>   (must be a participant)
```

The full thread, oldest first. Fetching the thread has a side effect: every message in it sent *to* the caller that hasn't been read yet gets its `readAt` stamped, in the same transaction. Ended pairs stay fully readable.

**On success (200)**
```json
{
  "pairId": "uuid",
  "status": "ACTIVE",
  "messages": [
    {
      "id": "uuid",
      "pairId": "uuid",
      "senderId": "uuid",
      "body": "Welcome aboard! What are you working on right now?",
      "sentAt": "2026-07-19T10:12:00Z",
      "readAt": "2026-07-19T10:15:00Z"
    }
  ]
}
```

**What can go wrong**
- `401` — not signed in
- `404` — the pair doesn't exist, or the caller isn't a participant

---

### Send a message

```
POST /mentorship/pairs/{pairId}/messages
Authorization: Bearer <access_token>   (must be a participant)
```

```json
{ "body": "Thanks for accepting! Could we set up a chat about interview prep?" }
```

| Field | Rules |
|---|---|
| `body` | Required. Cannot be blank. Max 4,000 characters. |

**On success (201)** — the recorded message, with `readAt: null` until the other side reads the thread.

**What can go wrong**
- `400` — the body is blank or too long
- `401` — not signed in
- `404` — the pair doesn't exist, or the caller isn't a participant
- `409` — the mentorship has ended — the thread is read-only now

---

## Important behaviours

**Cancel breaks the unanswered-request deadlock.** A pending request never expires on its own, and a student can't stack a second request on the same alumnus while one is pending. Without cancellation, an alumnus who simply never responds would lock that route forever. Cancelling is the deliberate escape hatch: it resolves the request as `CANCELLED` and immediately frees the student to request the same alumnus — or anyone else — again.

**Ownership failures look identical to "not found."** Accepting a request addressed to someone else, cancelling another student's request, or reading a thread you're not part of all return a `404` — the exact same response as an ID that doesn't exist at all. A `403` would confirm the resource exists, which is more than the caller should learn. Every service on this platform follows this rule.

**Ending preserves everything, and doing it twice is fine.** Ending a pair blocks new messages but deletes nothing — both former participants can still read the whole conversation and still see the pair in their history. Ending an already-ended pair returns 200 with the unchanged state rather than an error, so a double-tap in the app never surfaces a failure.

**Read receipts are set by the server, not the sender.** A message's `readAt` is stamped automatically the moment the recipient fetches the thread — the client never sends a "mark read" call, and a sender can't fake or clear a receipt. It's the only delivery signal in v1: no typing indicators, no per-device delivery states, no push notifications.

**Flipping availability off never touches existing mentorships.** An unavailable alumnus disappears from search and rejects new requests (with a 404, indistinguishable from not existing), but every active pair and message thread keeps working exactly as before. Availability is the alumnus's load throttle — there's no system-imposed mentee limit.

**No AI is involved.** Alumni search ranking is a deterministic count of matching interest tags, tie-broken by profile freshness — reproducible by hand from the documented rule, the same hand-verifiable philosophy as the matching and challenge services. This service never calls Claude or any other model.

**Profile saves are all-or-nothing.** `PUT /mentorship/profile` always replaces the entire profile — there's no way to change just the bio or just the availability flag. To flip availability, the app resends the whole profile with `available` toggled.

**No names anywhere.** Search results, requests, pairs, and messages all carry user IDs, never names — this service can't look a name up (it doesn't share a database with auth-service, and the access token carries no name claim). The app renders a masked label like "Student a1b2…" from the ID instead.
