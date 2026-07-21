# Data Model: Portfolio Service

## Schema

PostgreSQL schema: `portfolio` (isolated; no cross-schema access).

---

## Entities

### PortfolioItem

```
portfolio.portfolio_items
├── id            UUID         PK, generated
├── user_id       UUID         NOT NULL  (owner — from JWT)
├── item_type     VARCHAR(20)  NOT NULL  PROJECT | CERTIFICATE | ACHIEVEMENT
├── title         VARCHAR(255) NOT NULL
├── description   TEXT         NULLABLE
├── external_url  TEXT         NULLABLE
├── verified      BOOLEAN      NOT NULL, DEFAULT false
├── display_order INTEGER      NOT NULL, DEFAULT 0
├── created_at    TIMESTAMPTZ  NOT NULL
└── updated_at    TIMESTAMPTZ  NOT NULL
```

**Validation:**
- `itemType`: must be one of `PROJECT`, `CERTIFICATE`, `ACHIEVEMENT`
- `title`: 1–255 characters, not blank
- `externalUrl`: valid URL format if provided (Bean Validation `@URL`)

**State transitions:**
```
verified: false  ──(APPROVED verification)──►  verified: true
verified: true   ──(REJECTED does not change)─► verified: true  [only re-verified if already true]
```

---

### VerificationRequest

```
portfolio.verification_requests
├── id                UUID         PK, generated
├── portfolio_item_id UUID         FK → portfolio_items.id, NOT NULL
├── requested_by      UUID         NOT NULL  (student user_id)
├── reviewed_by       UUID         NULLABLE  (admin user_id)
├── status            VARCHAR(20)  NOT NULL  PENDING | APPROVED | REJECTED
├── reviewer_note     TEXT         NULLABLE
├── requested_at      TIMESTAMPTZ  NOT NULL
└── reviewed_at       TIMESTAMPTZ  NULLABLE
```

**State machine:**
```
PENDING  ──(admin APPROVED)──►  APPROVED  (sets portfolio_item.verified = true)
PENDING  ──(admin REJECTED)──►  REJECTED  (verified stays false; student can resubmit)
```

**Constraints:**
- Only one PENDING request per `portfolio_item_id` at a time (enforced in service before insert).
- A student cannot submit a request for an item they don't own (ownership checked before creating request).

---

### PortfolioLink

```
portfolio.portfolio_links
├── id           UUID         PK, generated
├── user_id      UUID         NOT NULL, UNIQUE (one active link per user)
├── share_token  VARCHAR(64)  NOT NULL, UNIQUE
├── active       BOOLEAN      NOT NULL, DEFAULT true
└── created_at   TIMESTAMPTZ  NOT NULL
```

**Notes:**
- One active share link per user (idempotent `POST /portfolio/share`).
- `user_id` has a UNIQUE constraint so the service can use `findByUserId` and return the existing token if present.
- `share_token`: 43-character URL-safe Base64 string (32 random bytes).

---

## Flyway Migrations

| Version | File | Content |
|---|---|---|
| V1 | `V1__create_portfolio_schema.sql` | `CREATE SCHEMA IF NOT EXISTS portfolio;` |
| V2 | `V2__create_portfolio_items.sql` | `portfolio_items` table |
| V3 | `V3__create_verification_requests.sql` | `verification_requests` table |
| V4 | `V4__create_portfolio_links.sql` | `portfolio_links` table |

---

## JPA Entities

### PortfolioItem.java
```java
@Entity @Table(name = "portfolio_items", schema = "portfolio")
// id: UUID @GeneratedValue(UUID)
// userId: UUID
// itemType: String
// title: String
// description: String
// externalUrl: String
// verified: boolean (default false)
// displayOrder: int (default 0)
// createdAt: Instant (not updatable)
// updatedAt: Instant (@PrePersist + @PreUpdate)
// @OneToMany(mappedBy="portfolioItem", cascade=ALL, orphanRemoval=true) verificationRequests: Set<VerificationRequest>
```

### VerificationRequest.java
```java
@Entity @Table(name = "verification_requests", schema = "portfolio")
// id: UUID
// @ManyToOne(LAZY) portfolioItem: PortfolioItem
// requestedBy: UUID
// reviewedBy: UUID (nullable)
// status: String
// reviewerNote: String (nullable)
// requestedAt: Instant
// reviewedAt: Instant (nullable)
```

### PortfolioLink.java
```java
@Entity @Table(name = "portfolio_links", schema = "portfolio")
// id: UUID
// userId: UUID
// shareToken: String
// active: boolean (default true)
// createdAt: Instant
```

---

## Repositories

| Repository | Key queries |
|---|---|
| `PortfolioItemRepository` | `findByUserId(UUID)`, `findByIdAndUserId(UUID,UUID)`, `findByUserIdAndVerifiedTrue(UUID)` |
| `VerificationRequestRepository` | `existsByPortfolioItemIdAndStatus(UUID,String)`, `findByIdAndStatus(UUID,String)` |
| `PortfolioLinkRepository` | `findByUserId(UUID)`, `findByShareTokenAndActiveTrue(String)` |

---

## Response DTOs

| DTO | Fields |
|---|---|
| `PortfolioItemResponse` | id, userId, itemType, title, description, externalUrl, verified, verificationStatus (NONE\|PENDING\|APPROVED\|REJECTED), displayOrder, createdAt |
| `VerificationRequestResponse` | id, portfolioItemId, status, reviewerNote, requestedAt, reviewedAt |
| `ShareLinkResponse` | shareToken, shareUrl, active, createdAt |

## Request DTOs

| DTO | Used by | Fields | Validation |
|---|---|---|---|
| `PortfolioItemRequest` | POST /portfolio/items | itemType, title, description, externalUrl | itemType `@NotBlank`, title `@NotBlank @Size(max=255)`, externalUrl `@URL` (if present) |
| `PortfolioItemUpdateRequest` | PUT /portfolio/items/{itemId} | title, description, externalUrl, displayOrder | All optional; title `@Size(max=255)` if provided, externalUrl `@URL` if provided. `itemType` is immutable — not included. |
| `VerificationDecisionRequest` | PATCH /portfolio/verification/{id} | decision, reviewerNote | decision `@NotBlank`, must be APPROVED or REJECTED |
