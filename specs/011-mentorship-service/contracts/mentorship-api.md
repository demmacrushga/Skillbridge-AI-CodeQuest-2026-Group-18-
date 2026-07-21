# API Contract: mentorship-service

**Base path**: `/mentorship` (nginx prefix, service on port 8008)
**Auth**: `Authorization: Bearer <JWT>` on every endpoint except `GET /mentorship/health`.
Role read from the JWT `role` claim; participant scoping by JWT `sub`.
**Errors**: uniform envelope `{ "timestamp", "status", "error", "message", "path" }`
(+ `fieldErrors: [{field, message}]` on 400 validation failures) — same
`GlobalExceptionHandler` shape as matching/challenge services.
**Ownership privacy**: acting on a request not addressed to you, or a pair you're not a
participant of, returns 404 indistinguishable from a nonexistent id — never 403.

---

## 1. Health (public)

```
GET /mentorship/health
```
**200** — `{ "status": "UP" }`

---

## 2. Get my profile (ALUMNI)

```
GET /mentorship/profile
```
**200** — `ProfileResponse`:
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
**Errors**: 401; 403 (non-ALUMNI); 404 (no profile created yet)

---

## 3. Create/replace my profile (ALUMNI)

```
PUT /mentorship/profile
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
| `currentRole`, `company` | optional, ≤ 150 chars |
| `industry` | optional, ≤ 100 chars |
| `careerInterests` | required, 1–20 tags, each non-blank ≤ 50 chars; trimmed + whitespace-collapsed, case-insensitive duplicates merged (first casing wins) |
| `bio` | optional, ≤ 2,000 chars |
| `available` | required boolean |

Upsert: creates the profile on first call, replaces it entirely afterwards. `updatedAt`
refreshed on every call.

**200** — `ProfileResponse` (stored, normalized values)
**Errors**: 400 (validation), 401, 403 (non-ALUMNI)

---

## 4. Search alumni (STUDENT)

```
GET /mentorship/alumni?interest=fintech&interest=backend%20engineering&industry=Fintech
```
Query params (all optional, repeatable `interest`):
- `interest` — tag(s) to match, case-insensitive exact match after trim/whitespace-collapse
- `industry` — case-insensitive exact match

Returns only `available: true` profiles. Ranking: matching-tag count DESC, then
`updatedAt` DESC. No filters → all available profiles, `updatedAt` DESC.

**200** — `{ "alumni": [AlumniSearchEntry] }`:
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
Empty result → `{ "alumni": [] }` (200, not an error).
**Errors**: 401; 403 (non-STUDENT)

---

## 5. Send a mentorship request (STUDENT)

```
POST /mentorship/requests
```
```json
{ "alumniId": "uuid", "message": "Hi! I'm targeting backend roles and would love guidance." }
```
| Field | Rules |
|---|---|
| `alumniId` | required UUID — the alumnus's userId (as returned by search) |
| `message` | optional, ≤ 1,000 chars |

**201** — `RequestResponse`:
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
**Errors**: 400 (missing alumniId / oversize message); 401; 403 (non-STUDENT);
404 (alumni profile doesn't exist **or** is unavailable — indistinguishable);
409 (a PENDING request or ACTIVE pair with this alumnus already exists)

---

## 6. My sent requests (STUDENT)

```
GET /mentorship/requests/mine
```
**200** — `[RequestResponse]`, `createdAt` DESC, all statuses. Empty → `[]`.
**Errors**: 401; 403 (non-STUDENT)

---

## 6a. Cancel a request (STUDENT, sender)

```
POST /mentorship/requests/{requestId}/cancel
```
No body. Marks the caller's own `PENDING` request `CANCELLED` (+ `respondedAt`).
Cancelling frees the student to send a new request to the same alumnus immediately —
this is the only student-side exit from `PENDING` (requests never expire automatically).

**200** — `RequestResponse` (`status: "CANCELLED"`)
**Errors**: 401; 403 (non-STUDENT); 404 (unknown request or sent by a different
student); 409 (already ACCEPTED, DECLINED, or CANCELLED)

---

## 7. Incoming pending requests (ALUMNI)

```
GET /mentorship/requests/incoming
```
Only requests addressed to the caller with `status = PENDING`, `createdAt` DESC.

**200** — `[RequestResponse]`. Empty → `[]`.
**Errors**: 401; 403 (non-ALUMNI)

---

## 8. Accept a request (ALUMNI, addressee)

```
POST /mentorship/requests/{requestId}/accept
```
No body. Marks the request `ACCEPTED` (+ `respondedAt`), creates an `ACTIVE` pair.

**200** — `PairResponse`:
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
**Errors**: 401; 403 (non-ALUMNI); 404 (unknown request or addressed to a different
alumnus); 409 (already ACCEPTED or DECLINED)

---

## 9. Decline a request (ALUMNI, addressee)

```
POST /mentorship/requests/{requestId}/decline
```
No body. Marks the request `DECLINED` (+ `respondedAt`); no pair created. The student may
send a new request to the same alumnus afterwards.

**200** — `RequestResponse` (`status: "DECLINED"`)
**Errors**: 401; 403 (non-ALUMNI); 404 (unknown / not addressed to caller);
409 (already resolved)

---

## 10. My pairs (STUDENT or ALUMNI)

```
GET /mentorship/pairs/mine
```
All pairs where the caller is a participant (either side), `startedAt` DESC, ACTIVE and
ENDED both included. Any authenticated role may call this — scoping is strictly by the
caller's user id, so a caller with no pairs (including RECRUITER/ADMIN, who can never be
participants) gets 200 with an empty list, not 403.

**200** — `[PairResponse]`. Empty → `[]`.
**Errors**: 401

---

## 11. End a pair (participant)

```
POST /mentorship/pairs/{pairId}/end
```
No body. Sets `status: ENDED` + `endedAt`. Idempotent — ending an already-ENDED pair
returns 200 unchanged. Message history untouched and still readable.

**200** — `PairResponse` (`status: "ENDED"`)
**Errors**: 401; 404 (unknown pair or caller not a participant)

---

## 12. Message thread (participant)

### Read (and mark read)

```
GET /mentorship/pairs/{pairId}/messages
```
Full thread, `sentAt` ASC. Side effect: every message in the thread sent *to* the caller
(`senderId != caller`) with `readAt: null` gets `readAt` stamped in the same transaction.
Readable on ENDED pairs.

**200** — `ThreadResponse`:
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
**Errors**: 401; 404 (unknown pair or caller not a participant)

### Send

```
POST /mentorship/pairs/{pairId}/messages
```
```json
{ "body": "Thanks for accepting! Could we set up a chat about interview prep?" }
```
| Field | Rules |
|---|---|
| `body` | required, non-blank, ≤ 4,000 chars |

**201** — `MessageResponse` (`readAt: null`)
**Errors**: 400 (blank/oversize body); 401; 404 (unknown pair / not a participant);
409 (pair is ENDED — thread is read-only)

---

## Status-code → exception mapping

| Status | Exceptions |
|---|---|
| 400 | `MethodArgumentNotValidException` (+fieldErrors), `HttpMessageNotReadableException`, `IllegalArgumentException` |
| 401 | missing/invalid/expired JWT (filter) / `AuthenticationException` |
| 403 | `AccessDeniedException` (role mismatch from `@PreAuthorize`) |
| 404 | `ProfileNotFoundException`, `RequestNotFoundException`, `PairNotFoundException` |
| 409 | `DuplicateRequestException`, `RequestAlreadyResolvedException` (accept/decline/cancel on a non-PENDING request), `PairEndedException` |
| 500 | anything else (logged with stack trace, generic message) |
