# Quickstart: AI Portfolio Verification

## Prerequisites

- Feature 004 (portfolio-service) fully deployed
- `ANTHROPIC_API_KEY` set in environment
- Portfolio-service running on port 8004 (or via nginx on 8080)

## Setup

```bash
# Start services
docker-compose up --build portfolio-service

# Register and login
export TOKEN=$(curl -s -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"student@test.com","password":"Pass1234!","role":"STUDENT","firstName":"Test","lastName":"Student"}' \
  | jq -r '.accessToken')

# Create a portfolio item
export ITEM_ID=$(curl -s -X POST http://localhost:8080/portfolio/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"itemType":"PROJECT","title":"SkillBridge Mobile App","description":"Built a full-stack React Native app with Spring Boot microservices backend. Deployed to Docker Compose with Nginx gateway.","externalUrl":"https://github.com/username/skillbridge"}' \
  | jq -r '.id')
```

## Validate US1: AI Auto-Verification (Happy Path)

```bash
# Request verification — Claude reviews immediately
curl -X POST http://localhost:8080/portfolio/items/$ITEM_ID/verify \
  -H "Authorization: Bearer $TOKEN"
```

**Expected**:
```json
{
  "status": "APPROVED",
  "reviewerNote": "...(Claude reasoning)...",
  "reviewSource": "AI",
  "reviewedAt": "2026-..."
}
```

Verify `verified=true` on the item:
```bash
curl http://localhost:8080/portfolio/mine \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.[0] | {verified, verificationStatus}'
# Expected: { "verified": true, "verificationStatus": "APPROVED" }
```

## Validate US1: Rejection Path

```bash
# Create a vague item
export VAGUE_ID=$(curl -s -X POST http://localhost:8080/portfolio/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"itemType":"PROJECT","title":"My project"}' \
  | jq -r '.id')

curl -X POST http://localhost:8080/portfolio/items/$VAGUE_ID/verify \
  -H "Authorization: Bearer $TOKEN"
```

**Expected**: `"status": "REJECTED"` with `reviewerNote` explaining missing details.

## Validate US1: 409 on Already Resolved

```bash
# Second call on already-approved item
curl -X POST http://localhost:8080/portfolio/items/$ITEM_ID/verify \
  -H "Authorization: Bearer $TOKEN"
# Expected: 409 Conflict
```

## Validate US2: Fallback (Claude Unavailable)

Run with a bad API key to simulate Claude failure:

```bash
ANTHROPIC_API_KEY=invalid docker-compose up --build portfolio-service

curl -X POST http://localhost:8080/portfolio/items/$ITEM_ID/verify \
  -H "Authorization: Bearer $TOKEN"
```

**Expected**:
```json
{
  "status": "PENDING",
  "reviewerNote": "Automated review unavailable — your item has been queued for manual review.",
  "reviewSource": "PENDING_FALLBACK"
}
```
No 500. HTTP 200.

## Validate US3: Admin Override

```bash
# Get request ID from the PENDING item
export REQ_ID=$(curl -s http://localhost:8080/portfolio/mine \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')

# Set ADMIN_TOKEN via DB: UPDATE auth.users SET role='ADMIN' WHERE email='admin@test.com'
curl -X PATCH http://localhost:8080/portfolio/verification/$REQ_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"decision":"APPROVED","reviewerNote":"Manually verified after portfolio session."}'
```

**Expected**: `"status": "APPROVED"`, `"reviewSource": "HUMAN"`.

## Check Logs (AI Prompt Compliance)

```bash
docker logs skillbridge-portfolio | grep "PORTFOLIO_VERIFICATION_V1"
# Expected: INFO line with prompt name and latencyMs on every Claude call
```
