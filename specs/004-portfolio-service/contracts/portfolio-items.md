# API Contract: Portfolio Items

Base path: `/portfolio`

All protected endpoints require `Authorization: Bearer <token>`.

---

## POST /portfolio/items

Create a new portfolio item.

**Auth**: Required (student)

**Request**
```json
{
  "itemType": "PROJECT",
  "title": "SkillBridge Mobile App",
  "description": "React Native app for career development",
  "externalUrl": "https://github.com/example/skillbridge"
}
```

**Validation**
- `itemType`: required, must be `PROJECT | CERTIFICATE | ACHIEVEMENT`
- `title`: required, 1–255 characters
- `externalUrl`: optional, valid URL if provided

**Response — 201 Created**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "a1b2c3d4-...",
  "itemType": "PROJECT",
  "title": "SkillBridge Mobile App",
  "description": "React Native app for career development",
  "externalUrl": "https://github.com/example/skillbridge",
  "verified": false,
  "verificationStatus": "NONE",
  "displayOrder": 0,
  "createdAt": "2026-06-26T10:00:00Z"
}
```

**Errors**
- `400 Bad Request` — missing/invalid fields: `{ "error": "Title is required", "status": 400 }`
- `401 Unauthorized` — missing or invalid JWT

---

## GET /portfolio/mine

Get the authenticated student's portfolio (all items including unverified).

**Auth**: Required

**Response — 200 OK**
```json
[
  {
    "id": "550e8400-...",
    "userId": "a1b2c3d4-...",
    "itemType": "PROJECT",
    "title": "SkillBridge Mobile App",
    "description": "...",
    "externalUrl": "https://github.com/example/skillbridge",
    "verified": true,
    "verificationStatus": "APPROVED",
    "displayOrder": 0,
    "createdAt": "2026-06-26T10:00:00Z"
  }
]
```

`verificationStatus` values: `NONE` (no request), `PENDING` (awaiting admin review), `APPROVED` (verified=true), `REJECTED` (last request rejected, may resubmit).

Sorted: `displayOrder ASC, createdAt DESC`. Returns empty array `[]` if no items.

---

## GET /portfolio/{userId}

Get a student's public portfolio (verified items only). No authentication required.

**Auth**: None

**Path params**: `userId` — UUID of the portfolio owner

**Response — 200 OK** — same shape as `/portfolio/mine` but only `verified: true` items (all have `verificationStatus: "APPROVED"`).

**Errors**
- Returns `[]` if userId has no verified items (not 404 — user existence is not exposed)

---

## PUT /portfolio/items/{itemId}

Update an existing portfolio item (owner only). Uses `PortfolioItemUpdateRequest` — all fields optional; only provided (non-null) fields are applied.

**Auth**: Required

**Path params**: `itemId` — UUID

**Request body** — `PortfolioItemUpdateRequest` (all fields optional)
```json
{
  "title": "Updated Title",
  "externalUrl": "https://updated-url.com"
}
```

Fields: `title` (1–255 chars if provided), `description` (any string), `externalUrl` (valid URL if provided), `displayOrder` (integer). `itemType` is immutable after creation.

**Response — 200 OK** — updated item (same shape as POST 201 response)

**Errors**
- `400 Bad Request` — provided field fails validation (e.g. URL is malformed)
- `401 Unauthorized`
- `404 Not Found` — item doesn't exist or doesn't belong to the caller: `{ "error": "Portfolio item not found", "status": 404 }`

---

## DELETE /portfolio/items/{itemId}

Delete a portfolio item (owner only). Cascades to associated VerificationRequests.

**Auth**: Required

**Path params**: `itemId` — UUID

**Response — 204 No Content** (empty body)

**Errors**
- `401 Unauthorized`
- `404 Not Found` — `{ "error": "Portfolio item not found", "status": 404 }`

---

## GET /portfolio/health

Service health check. Public — no authentication required.

**Auth**: None

**Response — 200 OK**
```json
{ "status": "UP" }
```
