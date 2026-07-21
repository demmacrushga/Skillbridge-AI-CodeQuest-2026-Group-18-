# API Contract: Portfolio Verification

Base path: `/portfolio`

---

## POST /portfolio/items/{itemId}/verify

Submit a portfolio item for admin verification.

**Auth**: Required (student who owns the item)

**Path params**: `itemId` — UUID

**Request**: No body

**Response — 201 Created**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440000",
  "portfolioItemId": "550e8400-...",
  "status": "PENDING",
  "reviewerNote": null,
  "requestedAt": "2026-06-26T10:00:00Z",
  "reviewedAt": null
}
```

**Errors**
- `401 Unauthorized` — missing/invalid JWT
- `404 Not Found` — item doesn't exist or doesn't belong to caller: `{ "error": "Portfolio item not found", "status": 404 }`
- `409 Conflict` — PENDING request already exists for this item: `{ "error": "A verification request is already pending for this item", "status": 409 }`

---

## PATCH /portfolio/verification/{requestId}

Review a verification request (ADMIN only).

**Auth**: Required (role must be `ADMIN`)

**Path params**: `requestId` — UUID

**Request**
```json
{
  "decision": "APPROVED",
  "reviewerNote": "Verified against GitHub profile"
}
```

**Validation**
- `decision`: required, must be `APPROVED | REJECTED`
- `reviewerNote`: optional

**Response — 200 OK**
```json
{
  "id": "660e8400-...",
  "portfolioItemId": "550e8400-...",
  "status": "APPROVED",
  "reviewerNote": "Verified against GitHub profile",
  "requestedAt": "2026-06-26T10:00:00Z",
  "reviewedAt": "2026-06-26T11:00:00Z"
}
```

**Side effects on APPROVED**:
- `portfolio_items.verified` is set to `true` for the linked item.

**Side effects on REJECTED**:
- `portfolio_items.verified` remains unchanged.
- Student may resubmit a new verification request.

**Errors**
- `400 Bad Request` — invalid decision value
- `401 Unauthorized`
- `403 Forbidden` — caller is not ADMIN: `{ "error": "Access denied", "status": 403 }`
- `404 Not Found` — requestId doesn't exist: `{ "error": "Verification request not found", "status": 404 }`
- `409 Conflict` — request is already reviewed (not PENDING): `{ "error": "Verification request is already resolved", "status": 409 }`
