# Data Model: AI-Powered Portfolio Verification

## Schema Changes

Only one migration needed — all other tables unchanged.

---

## Flyway Migration V5

**File**: `V5__add_review_source_to_verification_requests.sql`

```sql
ALTER TABLE portfolio.verification_requests
    ADD COLUMN IF NOT EXISTS review_source VARCHAR(20) NOT NULL DEFAULT 'AI';
```

**Notes**:
- `DEFAULT 'AI'` — existing rows (from old manual flow) get `AI` retroactively. Acceptable since there are no production rows yet.
- Three valid values: `AI`, `HUMAN`, `PENDING_FALLBACK`
- No DB constraint — validated at application layer to allow future values without migration.

---

## Updated Entity: VerificationRequest

```java
@Entity
@Table(name = "verification_requests", schema = "portfolio")
public class VerificationRequest {
    @Id @GeneratedValue private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "portfolio_item_id", nullable = false)
    private PortfolioItem portfolioItem;

    private UUID requestedBy;
    private UUID reviewedBy;          // null for AI reviews
    private String status;            // PENDING | APPROVED | REJECTED
    private String reviewerNote;      // AI reason or human note
    private String reviewSource;      // AI | HUMAN | PENDING_FALLBACK  ← NEW
    private Instant requestedAt;
    private Instant reviewedAt;
}
```

---

## Internal DTOs (not persisted)

### ClaudeVerificationResponse (record)
```java
// service/dto/ClaudeVerificationResponse.java
record ClaudeVerificationResponse(String decision, String reason) {}
```

Used only within `ClaudeVerificationService` — never exposed in API responses.

---

## Updated Response DTO: VerificationRequestResponse

Add `reviewSource` field so clients know whether the decision was AI or human:

```java
// dto/response/VerificationRequestResponse.java
record VerificationRequestResponse(
    UUID id,
    UUID portfolioItemId,
    String status,
    String reviewerNote,
    String reviewSource,     // ← NEW
    Instant requestedAt,
    Instant reviewedAt
) {}
```

---

## New Service Component

### ClaudeVerificationService
```
service/ClaudeVerificationService.java
```
- Prompt constant: `PORTFOLIO_VERIFICATION_V1`
- System prompt: instructs Claude to return ONLY `{ "decision": "APPROVED"|"REJECTED", "reason": "..." }`
- Method: `ClaudeVerificationResponse verify(PortfolioItem item)` — throws `AiServiceException` on failure
- Logs: prompt name + latency at INFO level
- No caching (`@Cacheable` inappropriate — each item is unique)

---

## No Other Model Changes

- `PortfolioItem` — unchanged
- `PortfolioLink` — unchanged
- `PortfolioItemResponse` — unchanged
- `PortfolioItemRequest` / `PortfolioItemUpdateRequest` — unchanged

---

## State Transitions (updated)

```
[item created]
      │
      ▼
POST /items/{id}/verify
      │
      ├─ Claude available ──► Claude reviews ──► APPROVED (verified=true) or REJECTED
      │                                         reviewSource = AI
      │
      └─ Claude unavailable ──► PENDING
                                reviewSource = PENDING_FALLBACK
                                reviewerNote = "Automated review unavailable..."
                                      │
                                      ▼
                              PATCH /verification/{id} (admin)
                                      │
                                      ▼
                              APPROVED or REJECTED
                              reviewSource = HUMAN
```
