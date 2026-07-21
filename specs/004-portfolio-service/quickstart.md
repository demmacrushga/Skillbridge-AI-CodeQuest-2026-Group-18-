# Quickstart: Portfolio Service Validation

Use this guide to validate that portfolio-service works end-to-end after implementation.

## Prerequisites

- Docker and Docker Compose running
- Auth-service running (port 8001) — needed to obtain a JWT
- Portfolio-service running (port 8004)
- PostgreSQL with `portfolio` schema created (Flyway runs on startup)

## Setup

```bash
# Start the service stack
docker-compose up --build portfolio-service

# Verify health
curl http://localhost:8004/portfolio/health
# Expected: {"status":"UP"}
```

## Get a JWT Token

```bash
# Register a student
curl -X POST http://localhost:8001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"student@test.com","password":"test1234","role":"STUDENT"}'

# Login and capture the token
TOKEN=$(curl -s -X POST http://localhost:8001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@test.com","password":"test1234"}' | jq -r '.accessToken')
echo $TOKEN
```

---

## US1 — Item CRUD

### Create an item
```bash
curl -X POST http://localhost:8004/portfolio/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "itemType": "PROJECT",
    "title": "My First Project",
    "description": "A cool project",
    "externalUrl": "https://github.com/example/project"
  }'
# Expected: 201, body with id, verified: false
```

Save the item ID:
```bash
ITEM_ID=<id from response>
```

### Update the item
```bash
curl -X PUT http://localhost:8004/portfolio/items/$ITEM_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Title"}'
# Expected: 200, updated title in response
```

### Delete the item
```bash
curl -X DELETE http://localhost:8004/portfolio/items/$ITEM_ID \
  -H "Authorization: Bearer $TOKEN"
# Expected: 204 No Content
```

---

## US2 — Portfolio View

```bash
# Get user's own portfolio (all items)
curl http://localhost:8004/portfolio/mine \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200, array of items (includes unverified)

# Get user's public portfolio (verified only)
USER_ID=$(curl -s http://localhost:8001/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq -r '.userId')

curl http://localhost:8004/portfolio/$USER_ID
# Expected: 200, array of only verified items (empty if none verified yet)
```

---

## US3 — Verification Workflow

```bash
# Create a new item to verify
ITEM_ID=$(curl -s -X POST http://localhost:8004/portfolio/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"itemType":"CERTIFICATE","title":"AWS Cloud Practitioner","externalUrl":"https://credly.com/example"}' \
  | jq -r '.id')

# Submit for verification
REQUEST_ID=$(curl -s -X POST http://localhost:8004/portfolio/items/$ITEM_ID/verify \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.id')
echo "Request: $REQUEST_ID, Status should be PENDING"

# Attempt duplicate submission → should get 409
curl -X POST http://localhost:8004/portfolio/items/$ITEM_ID/verify \
  -H "Authorization: Bearer $TOKEN"
# Expected: 409 Conflict

# Get an ADMIN token
ADMIN_TOKEN=$(curl -s -X POST http://localhost:8001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin1234"}' | jq -r '.accessToken')

# Admin approves
curl -X PATCH http://localhost:8004/portfolio/verification/$REQUEST_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"decision":"APPROVED","reviewerNote":"Verified via Credly"}'
# Expected: 200, status: APPROVED

# Verify the item is now verified
curl http://localhost:8004/portfolio/mine \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | select(.id=="'$ITEM_ID'") | .verified'
# Expected: true

# Non-admin trying to approve → 403
curl -X PATCH http://localhost:8004/portfolio/verification/$REQUEST_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"decision":"APPROVED"}'
# Expected: 403 Forbidden
```

---

## US4 — Share Link

```bash
# Generate share link (first call creates it)
SHARE_RESPONSE=$(curl -s -X POST http://localhost:8004/portfolio/share \
  -H "Authorization: Bearer $TOKEN")
echo $SHARE_RESPONSE
SHARE_TOKEN=$(echo $SHARE_RESPONSE | jq -r '.shareToken')

# Generate again → idempotent, same token
curl -s -X POST http://localhost:8004/portfolio/share \
  -H "Authorization: Bearer $TOKEN" | jq -r '.shareToken'
# Expected: same token as above

# Access share link (no auth)
curl http://localhost:8004/portfolio/share/$SHARE_TOKEN
# Expected: 200, array of verified items

# Invalid token → 404
curl http://localhost:8004/portfolio/share/invalid-token-here
# Expected: 404
```

---

## Via nginx Gateway

When nginx is configured, all endpoints are accessible via the gateway:

```bash
curl http://localhost/portfolio/health
curl -X POST http://localhost/portfolio/items -H "Authorization: Bearer $TOKEN" ...
```

---

## Test Suite

```bash
cd backend/portfolio-service
./mvnw test
# Expected: All tests pass, JaCoCo ≥ 70% coverage reported
```
