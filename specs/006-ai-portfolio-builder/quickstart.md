# Quickstart: AI Portfolio Builder

## Prerequisites

- Features 004 (portfolio-service) and 005 (AI verification) fully deployed
- `ANTHROPIC_API_KEY` set in environment (already in docker-compose for portfolio-service)
- Portfolio-service running on port 8004 (or via nginx on 8080)
- Frontend Expo dev server running (`npx expo start` in `frontend/`)

## Setup

```bash
# Start services (portfolio-service already has ANTHROPIC_API_KEY from feature 005)
docker-compose up --build portfolio-service

# Register and login
export TOKEN=$(curl -s -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"student@test.com","password":"Pass1234!","role":"STUDENT","firstName":"Test","lastName":"Student"}' \
  | jq -r '.accessToken')
```

## Validate US1: CV Upload Extraction

### Happy Path

```bash
# Upload a CV PDF
curl -s -X POST http://localhost:8080/portfolio/extract \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/sample-cv.pdf" | jq
```

**Expected**: 200 with JSON array of extracted items:
```json
[
  { "itemType": "PROJECT", "title": "...", "description": "...", "externalUrl": "...", "confidence": 0.9 },
  { "itemType": "CERTIFICATION", "title": "...", "description": "...", "externalUrl": null, "confidence": 0.8 }
]
```

### File Validation

```bash
# Upload a file > 5MB → 400
curl -s -X POST http://localhost:8080/portfolio/extract \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/large-file.pdf"
# Expected: 400 "File exceeds maximum allowed size of 5MB"

# Upload a PNG → 400
curl -s -X POST http://localhost:8080/portfolio/extract \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/image.png"
# Expected: 400 "Unsupported file type 'image/png'. Only PDF and DOCX files are accepted."
```

## Validate US2: Website URL Extraction

```bash
# Extract from a GitHub profile
curl -s -X POST http://localhost:8080/portfolio/extract-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com/torvalds"}' | jq
```

**Expected**: 200 with JSON array of project items, each with `externalUrl` pointing to repos.

### URL Validation

```bash
# Invalid URL → 400
curl -s -X POST http://localhost:8080/portfolio/extract-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"not-a-url"}'
# Expected: 400 "url must be a valid URL"

# Unreachable URL → 502
curl -s -X POST http://localhost:8080/portfolio/extract-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://this-domain-does-not-exist-xyz.com"}'
# Expected: 502 "Could not fetch content from the provided URL"
```

## Validate Batch Save

```bash
# Save extracted items
curl -s -X POST http://localhost:8080/portfolio/items/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"itemType":"PROJECT","title":"E-commerce API","description":"Spring Boot REST API","externalUrl":"https://github.com/user/ecommerce-api"},
      {"itemType":"CERTIFICATION","title":"AWS CCP","description":"Cloud certification","externalUrl":null}
    ]
  }' | jq
```

**Expected**: 201 Created with `PortfolioItemResponse[]`:
```json
[
  { "id": "uuid-1", "itemType": "PROJECT", "title": "E-commerce API", "verified": false, "verificationStatus": "NONE", ... },
  { "id": "uuid-2", "itemType": "CERTIFICATION", "title": "AWS CCP", "verified": false, "verificationStatus": "NONE", ... }
]
```

### Verify Items Appear in Portfolio

```bash
curl -s http://localhost:8080/portfolio/mine \
  -H "Authorization: Bearer $TOKEN" | jq 'length'
# Expected: 2
```

## Validate US3: AI Fallback

```bash
# Run with a bad API key to simulate Claude failure
ANTHROPIC_API_KEY=invalid docker-compose up --build portfolio-service

curl -s -X POST http://localhost:8080/portfolio/extract \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/sample-cv.pdf"
```

**Expected**: 503 with:
```json
{ "status": 503, "error": "Service Unavailable", "message": "AI service unavailable. Please try again or add items manually." }
```

No 500. No items saved.

## Check Logs (AI Prompt Compliance)

```bash
docker logs skillbridge-portfolio | grep "PORTFOLIO_EXTRACTION_V1"
# Expected: INFO lines with prompt name, itemCount, and latencyMs on every extraction call
```

## Frontend Validation

1. Open the app, navigate to Portfolio tab
2. Tap "Build with AI" button (next to the "+" FAB)
3. Choose "Upload CV" → pick a PDF → wait for processing animation
4. Review screen shows extracted items with checkboxes (all checked by default)
5. Uncheck one item, edit another's title, tap "Add N items"
6. Portfolio list shows the saved items
7. Tap "Build with AI" again → choose "Paste Website Link" → enter a GitHub URL → review → save
