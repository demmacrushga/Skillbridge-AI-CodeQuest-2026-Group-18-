# Contract: AI Portfolio Builder Endpoints

## New Endpoint: Extract from CV Upload

### POST /portfolio/extract

**Auth**: JWT Bearer required (student)

**Content-Type**: `multipart/form-data`

**Request Parts**:
- `file` (MultipartFile, required) — PDF or DOCX, max 5MB

**Response 200 OK** — Claude extracted items:
```json
[
  {
    "itemType": "PROJECT",
    "title": "E-commerce REST API",
    "description": "Built a Spring Boot REST API for an e-commerce platform with JWT authentication, PostgreSQL, and Docker deployment.",
    "externalUrl": "https://github.com/user/ecommerce-api",
    "confidence": 0.92
  },
  {
    "itemType": "CERTIFICATION",
    "title": "AWS Certified Cloud Practitioner",
    "description": "Foundational cloud certification covering AWS core services and cloud architecture principles.",
    "externalUrl": null,
    "confidence": 0.85
  },
  {
    "itemType": "AWARD",
    "title": "Dean's List 2024",
    "description": "Awarded for academic excellence — top 10% of the cohort.",
    "externalUrl": null,
    "confidence": 0.78
  }
]
```

**Response 200 OK** — No portfolio-worthy items found:
```json
[]
```

**Response 400 Bad Request** — file too large:
```json
{ "status": 400, "error": "Bad Request", "message": "File exceeds maximum allowed size of 5MB (received 6291456 bytes)" }
```

**Response 400 Bad Request** — unsupported file type:
```json
{ "status": 400, "error": "Bad Request", "message": "Unsupported file type 'image/png'. Only PDF and DOCX files are accepted." }
```

**Response 400 Bad Request** — file appears empty:
```json
{ "status": 400, "error": "Bad Request", "message": "CV appears empty or unreadable after text extraction" }
```

**Response 503 Service Unavailable** — Claude API unavailable:
```json
{ "status": 503, "error": "Service Unavailable", "message": "AI service unavailable. Please try again or add items manually." }
```

---

## New Endpoint: Extract from Website URL

### POST /portfolio/extract-url

**Auth**: JWT Bearer required (student)

**Content-Type**: `application/json`

**Request Body**:
```json
{
  "url": "https://github.com/username"
}
```

**Response 200 OK** — Claude extracted items:
```json
[
  {
    "itemType": "PROJECT",
    "title": "skillbridge-ai",
    "description": "AI-powered mobile career development platform built with Expo, React Native, Spring Boot microservices, and PostgreSQL.",
    "externalUrl": "https://github.com/username/skillbridge-ai",
    "confidence": 0.90
  },
  {
    "itemType": "PROJECT",
    "title": "weather-app",
    "description": "Real-time weather application using OpenWeatherMap API with location-based forecasts.",
    "externalUrl": "https://github.com/username/weather-app",
    "confidence": 0.75
  }
]
```

**Response 200 OK** — No items found:
```json
[]
```

**Response 400 Bad Request** — invalid URL:
```json
{ "status": 400, "error": "Bad Request", "message": "url must be a valid URL" }
```

**Response 502 Bad Gateway** — URL unreachable:
```json
{ "status": 502, "error": "Bad Gateway", "message": "Could not fetch content from the provided URL" }
```

**Response 503 Service Unavailable** — Claude API unavailable:
```json
{ "status": 503, "error": "Service Unavailable", "message": "AI service unavailable. Please try again or add items manually." }
```

---

## New Endpoint: Batch Save Items

### POST /portfolio/items/batch

**Auth**: JWT Bearer required (student)

**Content-Type**: `application/json`

**Request Body**:
```json
{
  "items": [
    {
      "itemType": "PROJECT",
      "title": "E-commerce REST API",
      "description": "Built a Spring Boot REST API...",
      "externalUrl": "https://github.com/user/ecommerce-api"
    },
    {
      "itemType": "CERTIFICATION",
      "title": "AWS Certified Cloud Practitioner",
      "description": "Foundational cloud certification...",
      "externalUrl": null
    }
  ]
}
```

**Validation**:
- `items` must be non-null, 1–50 entries
- Each item validated as `PortfolioItemRequest`: `@NotBlank itemType`, `@NotBlank @Size(max=255) title`, `@URL externalUrl`

**Response 201 Created** — all items saved:
```json
[
  {
    "id": "uuid-1",
    "userId": "uuid",
    "itemType": "PROJECT",
    "title": "E-commerce REST API",
    "description": "Built a Spring Boot REST API...",
    "externalUrl": "https://github.com/user/ecommerce-api",
    "verified": false,
    "verificationStatus": "NONE",
    "displayOrder": 0,
    "createdAt": "2026-06-29T10:00:00Z"
  },
  {
    "id": "uuid-2",
    "userId": "uuid",
    "itemType": "CERTIFICATION",
    "title": "AWS Certified Cloud Practitioner",
    "description": "Foundational cloud certification...",
    "externalUrl": null,
    "verified": false,
    "verificationStatus": "NONE",
    "displayOrder": 0,
    "createdAt": "2026-06-29T10:00:00Z"
  }
]
```

**Response 400 Bad Request** — validation error:
```json
{ "status": 400, "error": "Bad Request", "message": "items must contain 1–50 entries" }
```

---

## Unchanged Endpoints

All existing portfolio endpoints remain unchanged:
- `POST /portfolio/items` — single item creation (manual entry, still available)
- `GET /portfolio/mine` — list user's items
- `GET /portfolio/{userId}` — public portfolio
- `PUT /portfolio/items/{itemId}` — update item
- `DELETE /portfolio/items/{itemId}` — delete item
- `POST /portfolio/items/{itemId}/verify` — AI verification (feature 005)
- `PATCH /portfolio/verification/{requestId}` — admin override (feature 005)
- `POST /portfolio/share` — share link
- `GET /portfolio/share/{token}` — shared portfolio
- `GET /portfolio/health` — health check

---

## Frontend Impact

### New Components

| Screen/Component | Purpose |
|---|---|
| "Build with AI" button in portfolio header | Opens extraction method modal |
| Extraction method modal (bottom sheet) | Choose "Upload CV" or "Paste Website Link" |
| Processing state (animated) | Shown during Claude extraction (5–15s) |
| `(app)/portfolio-review` screen | Review extracted items with checkboxes, edit, batch-save |

### New Service Functions (frontend)

```typescript
// services/portfolio.ts
extractFromCV(accessToken, file): Promise<ExtractedItem[]>
extractFromUrl(accessToken, url): Promise<ExtractedItem[]>
batchCreateItems(accessToken, items): Promise<PortfolioItem[]>
```

### New Types (frontend)

```typescript
// types/portfolio.ts
interface ExtractedItem {
  itemType: string;
  title: string;
  description: string | null;
  externalUrl: string | null;
  confidence: number;
}

interface BatchCreatePayload {
  items: { itemType: string; title: string; description?: string; externalUrl?: string }[];
}
```
