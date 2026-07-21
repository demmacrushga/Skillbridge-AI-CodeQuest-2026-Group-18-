# API Contract: Skill Gap Service (Frontend View)

**Feature**: `002-skill-gap-frontend`
**Base path**: `/skill-gap/` (via nginx gateway on `EXPO_PUBLIC_API_URL`)
**Auth**: `Authorization: Bearer {accessToken}` required on all endpoints except `/health`

---

## POST /skill-gap/analyse

**Purpose**: Submit a CV for gap analysis.

**Request**:
- Content-Type: `multipart/form-data`
- Body fields:
  - `file` (File/Blob): PDF or DOCX, max 5MB
  - `targetRole` (string): non-empty, e.g. `"Backend Developer"`

**Success Response** — `201 Created`:
```json
{
  "reportId": "uuid",
  "targetRole": "Backend Developer",
  "gaps": [
    {
      "id": "uuid",
      "skillName": "Spring Boot",
      "importanceRank": 1,
      "description": "Lacks backend framework experience",
      "recommendations": [
        {
          "id": "uuid",
          "type": "COURSE",
          "title": "Spring Boot in Practice",
          "url": "https://example.com/course"
        }
      ]
    }
  ]
}
```

**Error Responses**:
| Status | When | Frontend Action |
|--------|------|-----------------|
| `400` | Missing or blank `targetRole` | Show "Target role is required" |
| `413` | File > 5MB | Show "File too large (max 5MB)" |
| `422` | Unsupported file type or empty CV | Show backend error message |
| `503` | Claude API unavailable | Show "AI analysis failed, try again later" |
| `401` | Expired JWT | AuthContext handles token refresh or logout |

---

## GET /skill-gap/reports

**Purpose**: List all past gap reports for the authenticated user.

**Success Response** — `200 OK`:
```json
[
  {
    "reportId": "uuid",
    "targetRole": "Backend Developer",
    "gaps": [ ... ]
  }
]
```
Returns `[]` (empty array) if no prior analyses. Never 404.

**Error Responses**:
| Status | Frontend Action |
|--------|-----------------|
| `401`  | Handled by AuthContext |
| `5xx`  | Show "Failed to load history" inline error |

---

## GET /skill-gap/reports/{reportId}

**Purpose**: Fetch a single gap report by ID.

**Path Parameter**: `reportId` — UUID of the report

**Success Response** — `200 OK`:
```json
{
  "reportId": "uuid",
  "targetRole": "Backend Developer",
  "gaps": [ ... ]
}
```

**Error Responses**:
| Status | Frontend Action |
|--------|-----------------|
| `404`  | Show "Report not found" and navigate back |
| `401`  | Handled by AuthContext |

---

## GET /skill-gap/health

**Purpose**: Health check (not called by frontend; used by docker-compose and nginx)

**Response** — `200 OK`: `{ "status": "UP" }`

---

## Frontend Service Contract (`frontend/services/skillGap.ts`)

```ts
analyseCV(token: string, file: DocumentPickerAsset, targetRole: string): Promise<GapReport>
getReports(token: string): Promise<GapReport[]>
getReport(token: string, reportId: string): Promise<GapReport>
```

All functions throw `{ status: number, message: string }` on error — same pattern as `services/career.ts`.
