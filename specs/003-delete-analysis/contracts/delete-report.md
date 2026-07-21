# API Contract: Delete Gap Report

## Endpoint

```
DELETE /skill-gap/reports/{reportId}
```

### Authentication

Bearer JWT (required). The `userId` is extracted from the JWT principal.

### Path parameters

| Parameter  | Type   | Required | Description                    |
|------------|--------|----------|--------------------------------|
| `reportId` | UUID   | Yes      | ID of the gap report to delete |

### Request body

None.

### Responses

#### 204 No Content — success

```
HTTP/1.1 204 No Content
```

Empty body. The report, its skill gaps, its resource recommendations, and its associated CV upload record have all been deleted.

#### 404 Not Found — report not found or belongs to another user

```json
{
  "error": "Report not found: <reportId>",
  "status": 404
}
```

Returned when:
- The `reportId` does not exist in the database.
- The `reportId` exists but belongs to a different `userId` than the JWT principal.

Both cases return 404 to avoid leaking report existence to other users.

#### 401 Unauthorized — missing or invalid JWT

```json
{
  "error": "Unauthorized",
  "status": 401
}
```

#### 400 Bad Request — invalid UUID format

```json
{
  "error": "Invalid UUID format",
  "status": 400
}
```

Returned if `reportId` is not a valid UUID.

---

## Frontend service call

```typescript
// services/skillGap.ts
export async function deleteReport(token: string, reportId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/skill-gap/reports/${reportId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, message: body.message ?? body.error ?? 'Delete failed' };
  }
}
```

Note: The `request<T>` helper in `skillGap.ts` calls `res.json()` which would fail on a 204. The `deleteReport` function calls `fetch` directly and checks `res.ok` without parsing the body.
