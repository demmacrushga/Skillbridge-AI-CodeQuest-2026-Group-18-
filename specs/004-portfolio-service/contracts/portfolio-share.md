# API Contract: Portfolio Share Link

Base path: `/portfolio`

---

## POST /portfolio/share

Generate (or retrieve) the caller's shareable portfolio link.

**Auth**: Required (student)

**Request**: No body

**Idempotency**: If the caller already has an active `portfolio_links` row, the existing token is returned — no new row is inserted.

**Response — 200 OK**
```json
{
  "shareToken": "aB3kLm9pQr2sTuVwXyZ0aC1dEfGhIjKlMnO",
  "shareUrl": "http://localhost:8004/portfolio/share/aB3kLm9pQr2sTuVwXyZ0aC1dEfGhIjKlMnO",
  "active": true,
  "createdAt": "2026-06-26T10:00:00Z"
}
```

**Notes**
- `shareToken`: 43-char URL-safe Base64 string (32 random bytes, no padding).
- `shareUrl`: absolute URL constructed from the service base URL + token path.
- On first call: inserts a `portfolio_links` row and returns 200.
- On subsequent calls: returns the existing row's data unchanged.

**Errors**
- `401 Unauthorized`

---

## GET /portfolio/share/{token}

Access a portfolio via its share link. Public — no authentication required.

**Auth**: None

**Path params**: `token` — the 43-char share token

**Response — 200 OK** — list of the owner's verified items (same shape as `GET /portfolio/{userId}`)

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
    "displayOrder": 0,
    "createdAt": "2026-06-26T10:00:00Z"
  }
]
```

Only `verified: true` items are included. Returns `[]` if the owner has no verified items.

**Errors**
- `404 Not Found` — token not found or `active: false`: `{ "error": "Share link not found", "status": 404 }`

