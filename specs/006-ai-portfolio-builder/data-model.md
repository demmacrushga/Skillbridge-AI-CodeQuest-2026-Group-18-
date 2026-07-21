# Data Model: AI-Powered Portfolio Builder

## Schema Changes

**None.** This feature adds no new tables and no new columns. Extraction is stateless — extracted items are returned to the frontend for review and only persisted when the student explicitly batch-saves (which creates standard `PortfolioItem` rows via the existing table).

---

## New Internal DTOs (not persisted)

### ExtractedItemTemplate (service-layer record)

```java
// service/dto/ExtractedItemTemplate.java
record ExtractedItemTemplate(
    String itemType,       // normalised to PROJECT|CERTIFICATION|AWARD|PUBLICATION|OTHER
    String title,
    String description,    // may be null
    String externalUrl,    // may be null
    double confidence      // 0.0–1.0, dropped before batch save
) {}
```

Used internally by `ClaudeExtractionService` — parsed from Claude's JSON array response.

---

## New API DTOs

### ExtractedItemResponse (response — returned to frontend for review)

```java
// dto/response/ExtractedItemResponse.java
record ExtractedItemResponse(
    String itemType,       // PROJECT | CERTIFICATION | AWARD | PUBLICATION | OTHER
    String title,
    String description,    // may be null
    String externalUrl,    // may be null
    double confidence      // 0.0–1.0
) {}
```

Returned by both `POST /portfolio/extract` and `POST /portfolio/extract-url`. The `confidence` field is for frontend display only — it is NOT included in the batch save request.

---

### ExtractUrlRequest (request — URL extraction)

```java
// dto/request/ExtractUrlRequest.java
record ExtractUrlRequest(
    @NotBlank(message = "url is required")
    @org.hibernate.validator.constraints.URL(message = "url must be a valid URL")
    String url
) {}
```

---

### BatchCreateItemsRequest (request — batch save)

```java
// dto/request/BatchCreateItemsRequest.java
record BatchCreateItemsRequest(
    @NotNull(message = "items is required")
    @Size(min = 1, max = 50, message = "items must contain 1–50 entries")
    @Valid
    List<PortfolioItemRequest> items
) {}
```

Each item in the list is validated using the existing `PortfolioItemRequest` constraints (`@NotBlank itemType`, `@NotBlank @Size(max=255) title`, `@URL externalUrl`).

---

## Existing Entities (unchanged)

### PortfolioItem

No changes. Batch save creates standard `PortfolioItem` rows:

```java
@Entity
@Table(name = "portfolio_items", schema = "portfolio")
public class PortfolioItem {
    @Id @GeneratedValue UUID id;
    UUID userId;
    String itemType;          // PROJECT | CERTIFICATION | AWARD | PUBLICATION | OTHER
    String title;
    String description;       // nullable, TEXT
    String externalUrl;       // nullable, TEXT
    boolean verified;         // false on creation
    int displayOrder;         // 0 on creation
    Instant createdAt;
    Instant updatedAt;
    Set<VerificationRequest> verificationRequests;
}
```

### VerificationRequest

No changes (feature 005's `reviewSource` column remains).

### PortfolioLink

No changes.

---

## New Service Components

### FileParserService

```
service/FileParserService.java
```
- Copies the pattern from `skill-gap-service/FileParserService.java`
- `String extractText(MultipartFile file)` — validates size (≤5MB) and MIME type (PDF/DOCX), extracts text
- Throws `FileSizeExceededException`, `UnsupportedFileTypeException`, `FileParsingException`
- PDF: Apache PDFBox 3.0.3 `Loader.loadPDF()` + `PDFTextStripper`
- DOCX: Apache POI 5.3.0 `XWPFDocument` + `XWPFWordExtractor`

---

### WebsiteFetchService

```
service/WebsiteFetchService.java
```
- `String fetchAndClean(String url)` — fetches HTML via `RestTemplate`, cleans with Jsoup, returns plain text
- Truncates to 50,000 chars (configurable via `portfolio.extraction.max-html-chars`)
- Logs WARN if truncation occurs
- Throws `WebsiteFetchException` on HTTP errors, timeouts, or unreachable URLs
- Uses separate `RestTemplate` instance with configurable connect/read timeouts (`portfolio.extraction.url-connect-timeout-ms`, `portfolio.extraction.url-read-timeout-ms`)

---

### ClaudeExtractionService

```
service/ClaudeExtractionService.java
```
- Prompt constant: `PORTFOLIO_EXTRACTION_V1`
- System prompt: instructs Claude to extract portfolio-worthy items as a JSON array
- `List<ExtractedItemTemplate> extract(String content)` — sends text to Claude, parses JSON array, validates shape
- `max_tokens: 4096` (configurable via `anthropic.extraction-max-tokens`)
- Strips markdown code fences if present
- Throws `AiServiceException` on `RestClientException` or `JsonProcessingException`
- Logs: `prompt=PORTFOLIO_EXTRACTION_V1, latencyMs=...` at INFO
- Logs: `prompt=PORTFOLIO_EXTRACTION_V1, itemCount=N` at INFO on success

---

### itemType Normalisation

Handled in `PortfolioExtractionServiceImpl` before mapping to `ExtractedItemResponse`:

```
allowed = {PROJECT, CERTIFICATION, AWARD, PUBLICATION, OTHER}
input = Claude's itemType (case-insensitive)
if input (uppercased) in allowed → use uppercased value
else → OTHER
```

---

## State Flow

```
                    POST /portfolio/extract (file)
                           or
                    POST /portfolio/extract-url (url)
                           │
                    ┌──────┴──────┐
                    │  Parse/Fetch │
                    │  → text      │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │  Claude AI  │
                    │  extract    │
                    └──────┬──────┘
                           │
                    ┌──────┴──────────┐
                    │  Validate JSON  │
                    │  Normalise type │
                    └──────┬──────────┘
                           │
                    ┌──────┴──────┐
                    │  Return     │
                    │  items[]    │  ← NOT persisted
                    └─────────────┘
                           │
                    ┌──────┴──────┐
                    │  Frontend   │
                    │  review     │  ← student edits, unchecks
                    └──────┬──────┘
                           │
                    POST /portfolio/items/batch
                           │
                    ┌──────┴──────┐
                    │  @Transactional │
                    │  save all   │
                    └──────┬──────┘
                           │
                    201 Created
                    PortfolioItemResponse[]
                           │
                    GET /portfolio/mine
                    (items now visible)
```

---

## New Dependencies (portfolio-service pom.xml)

| Dependency | Version | Purpose |
|---|---|---|
| `org.apache.pdfbox:pdfbox` | 3.0.3 | PDF text extraction (same as skill-gap-service) |
| `org.apache.poi:poi-ooxml` | 5.3.0 | DOCX text extraction (same as skill-gap-service) |
| `org.jsoup:jsoup` | 1.18.1 | HTML cleaning for website fetching |

---

## No Flyway Migrations

No schema changes. All extraction is stateless. Batch save uses the existing `portfolio_items` table.
