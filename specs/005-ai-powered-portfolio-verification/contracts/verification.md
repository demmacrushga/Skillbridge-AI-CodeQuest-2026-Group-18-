# Contract: AI Portfolio Verification Endpoints

## Changed Endpoint: Request Verification

### POST /portfolio/items/{itemId}/verify

**Auth**: JWT Bearer required (student owns item)

**Change from feature 004**: Previously returned `status: PENDING`. Now returns `APPROVED` or `REJECTED` immediately (synchronous AI review). `PENDING` only returned when Claude is unavailable (fallback).

**Path Parameters**:
- `itemId` (UUID) — must belong to authenticated user

**Request Body**: none

**Response 200 OK** — AI reviewed (happy path):
```json
{
  "id": "uuid",
  "portfolioItemId": "uuid",
  "status": "APPROVED",
  "reviewerNote": "This project demonstrates clear technical skills with a public GitHub repository and detailed description. Approved.",
  "reviewSource": "AI",
  "requestedAt": "2026-06-28T10:00:00Z",
  "reviewedAt": "2026-06-28T10:00:02Z"
}
```

**Response 200 OK** — Claude unavailable (fallback):
```json
{
  "id": "uuid",
  "portfolioItemId": "uuid",
  "status": "PENDING",
  "reviewerNote": "Automated review unavailable — your item has been queued for manual review.",
  "reviewSource": "PENDING_FALLBACK",
  "requestedAt": "2026-06-28T10:00:00Z",
  "reviewedAt": null
}
```

**Response 404 Not Found** — item not found or not owned by user:
```json
{ "status": 404, "error": "Not Found", "message": "Portfolio item not found: {itemId}" }
```

**Response 409 Conflict** — verification already resolved (APPROVED or REJECTED):
```json
{ "status": 409, "error": "Conflict", "message": "Verification request is already resolved" }
```

> **Note**: HTTP status is **200** (not 201) for the happy path. The verification request was already created in feature 004 as 201; now the response is the resolved decision, not the creation of a new pending record.

---

## Unchanged Endpoint: Admin Manual Override

### PATCH /portfolio/verification/{requestId}

**Auth**: JWT Bearer required (role ADMIN enforced in service layer)

**Change from feature 004**: `reviewSource` field added to response. Admin override now sets `reviewSource: HUMAN`.

**Request Body**:
```json
{
  "decision": "APPROVED",
  "reviewerNote": "Manually reviewed — project verified after portfolio review session."
}
```

**Response 200 OK**:
```json
{
  "id": "uuid",
  "portfolioItemId": "uuid",
  "status": "APPROVED",
  "reviewerNote": "Manually reviewed — project verified after portfolio review session.",
  "reviewSource": "HUMAN",
  "requestedAt": "2026-06-28T10:00:00Z",
  "reviewedAt": "2026-06-28T11:00:00Z"
}
```

**Response 403 Forbidden** — non-admin caller:
```json
{ "status": 403, "error": "Forbidden", "message": "Access denied" }
```

**Response 409 Conflict** — request is not PENDING:
```json
{ "status": 409, "error": "Conflict", "message": "Verification request is already resolved" }
```

---

## Frontend Impact

`verificationStatus` in `PortfolioItemResponse` still works the same — no frontend change needed:
- `APPROVED` → green verified badge
- `REJECTED` → red badge, "Request Verification" button reappears (student can revise item then re-request)
- `PENDING` → yellow "Pending…" label (only on Claude fallback)

`reviewSource` is informational — frontend may display "Verified by AI" vs "Verified by admin" optionally but not required for MVP.
