# Tasks: Portfolio Service

**Input**: Design documents from `specs/004-portfolio-service/`

**Organization**: Tasks are grouped by user story (US1→US5) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps task to user story (US1–US5)

---

## Phase 1: Setup (Project Skeleton)

**Purpose**: Initialize the Spring Boot project — must complete before any other phase.

- [X] T001 Create `backend/portfolio-service/pom.xml` — copy from `backend/skill-gap-service/pom.xml`, change artifactId to `portfolio-service`, remove PDFBox/POI, change port to 8004, remove cache dependencies
- [X] T002 [P] Copy Maven wrapper from skill-gap-service: `.mvn/`, `mvnw`, `mvnw.cmd`, `.dockerignore` into `backend/portfolio-service/`
- [X] T003 [P] Create `backend/portfolio-service/Dockerfile` — copy from skill-gap-service, change jar glob to `portfolio-service-*.jar` and `EXPOSE 8004`
- [X] T004 [P] Create `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/PortfolioServiceApplication.java` — `@SpringBootApplication`, no `@EnableCaching`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure that ALL user stories depend on. Complete before US1.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 [P] Create Flyway migrations in `backend/portfolio-service/src/main/resources/db/migration/`:
  - `V1__create_portfolio_schema.sql` — `CREATE SCHEMA IF NOT EXISTS portfolio;`
  - `V2__create_portfolio_items.sql` — `portfolio_items` table per data-model.md (UUID PK, user_id, item_type VARCHAR(20), title VARCHAR(255), description TEXT, external_url TEXT, verified BOOLEAN DEFAULT false, display_order INT DEFAULT 0, created_at/updated_at TIMESTAMPTZ)
  - `V3__create_verification_requests.sql` — `verification_requests` table (UUID PK, portfolio_item_id FK → portfolio_items.id, requested_by UUID, reviewed_by UUID NULL, status VARCHAR(20), reviewer_note TEXT NULL, requested_at TIMESTAMPTZ, reviewed_at TIMESTAMPTZ NULL)
  - `V4__create_portfolio_links.sql` — `portfolio_links` table (UUID PK, user_id UUID UNIQUE, share_token VARCHAR(64) UNIQUE, active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ)
- [X] T006 [P] Create JPA entities in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/entity/`:
  - `PortfolioItem.java` — `@Entity @Table(name="portfolio_items", schema="portfolio")`, all fields per data-model.md, `@PrePersist`/`@PreUpdate` for timestamps, `@OneToMany(mappedBy="portfolioItem", cascade=ALL, orphanRemoval=true) Set<VerificationRequest> verificationRequests`
  - `VerificationRequest.java` — `@ManyToOne(fetch=LAZY) @JoinColumn(name="portfolio_item_id") PortfolioItem portfolioItem`
  - `PortfolioLink.java` — userId, shareToken, active, createdAt
- [X] T007 [P] Create JPA repositories in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/repository/`:
  - `PortfolioItemRepository.java` — extends `JpaRepository<PortfolioItem, UUID>`; custom `@Query` with `LEFT JOIN FETCH pi.verificationRequests` named `findByUserIdWithVerificationRequests(@Param("userId") UUID userId)`; `findByIdAndUserId(UUID,UUID)`; `findByUserIdAndVerifiedTrue(UUID)`
  - `VerificationRequestRepository.java` — `existsByPortfolioItemIdAndStatus(UUID, String)`; `findByIdAndStatus(UUID, String)`
  - `PortfolioLinkRepository.java` — `findByUserId(UUID)`; `findByShareTokenAndActiveTrue(String)`
- [X] T008 [P] Copy + repackage security classes from `backend/skill-gap-service/src/main/java/com/skillbridge/skillgap/security/` into `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/security/`: `JwtService.java`, `JwtUserDetails.java`, `JwtAuthFilter.java` — update package declarations only
- [X] T009 [P] Create config classes in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/config/`:
  - `SecurityConfig.java` — public paths: `/portfolio/health`, `/portfolio/share/**`, `/portfolio/*` (GET only for public portfolio), swagger endpoints; adapt from skill-gap-service
  - `RestTemplateConfig.java` — copy from skill-gap-service
  - `StartupLogger.java` — copy from skill-gap-service, update service name to `portfolio-service`
  - `CorrelationIdFilter.java` — copy from skill-gap-service
- [X] T010 [P] Create `backend/portfolio-service/src/main/resources/application.yml` — port 8004, datasource with schema `portfolio`, Flyway locations `classpath:db/migration`, no cache config, no multipart config, springdoc paths
- [X] T011 [P] Create request DTOs in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/dto/request/`:
  - `PortfolioItemRequest.java` — `@NotBlank String itemType`, `@NotBlank @Size(max=255) String title`, `String description`, `@URL String externalUrl`
  - `PortfolioItemUpdateRequest.java` — all fields optional (no annotations that fire on null): `String title`, `String description`, `String externalUrl`, `Integer displayOrder`; `@Size(max=255)` on title if non-null, `@URL` on externalUrl if non-null
  - `VerificationDecisionRequest.java` — `@NotBlank String decision`, `String reviewerNote`
- [X] T012 [P] Create response DTOs (Java records) in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/dto/response/`:
  - `PortfolioItemResponse.java` — `UUID id, UUID userId, String itemType, String title, String description, String externalUrl, boolean verified, String verificationStatus, int displayOrder, Instant createdAt`
  - `VerificationRequestResponse.java` — `UUID id, UUID portfolioItemId, String status, String reviewerNote, Instant requestedAt, Instant reviewedAt`
  - `ShareLinkResponse.java` — `String shareToken, String shareUrl, boolean active, Instant createdAt`
- [X] T013 [P] Create exceptions in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/exception/`:
  - `PortfolioItemNotFoundException.java` (extends RuntimeException)
  - `VerificationRequestNotFoundException.java` (extends RuntimeException)
  - `DuplicateVerificationException.java` (extends RuntimeException)
  - `VerificationAlreadyResolvedException.java` (extends RuntimeException)
  - `GlobalExceptionHandler.java` — `@RestControllerAdvice`; handlers: `PortfolioItemNotFoundException` → 404, `VerificationRequestNotFoundException` → 404, `DuplicateVerificationException` → 409, `VerificationAlreadyResolvedException` → 409, `AccessDeniedException` → 403, `MethodArgumentNotValidException` → 400; uniform `{ "error": String, "status": int }` shape
- [X] T014 [P] Create `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/service/PortfolioService.java` — interface declaring all method signatures:
  - `PortfolioItemResponse createItem(PortfolioItemRequest request, UUID userId)`
  - `PortfolioItemResponse updateItem(UUID itemId, PortfolioItemUpdateRequest request, UUID userId)`
  - `void deleteItem(UUID itemId, UUID userId)`
  - `List<PortfolioItemResponse> getMyPortfolio(UUID userId)`
  - `List<PortfolioItemResponse> getPublicPortfolio(UUID userId)`
  - `VerificationRequestResponse requestVerification(UUID itemId, UUID requestedBy)`
  - `VerificationRequestResponse reviewVerification(UUID requestId, String decision, String reviewerNote, UUID reviewedBy, String reviewerRole)`
  - `ShareLinkResponse generateShareLink(UUID userId, String baseUrl)`
  - `List<PortfolioItemResponse> getSharePortfolio(String token)`

**Checkpoint**: Foundation ready — user story phases can now begin.

---

## Phase 3: US1 — Manage Portfolio Items (P1) 🎯 MVP

**Goal**: Students can create, update, and delete portfolio items via REST.

**Independent Test**: `POST /portfolio/items` → 201 item; `PUT /portfolio/items/{id}` → 200 updated; `DELETE /portfolio/items/{id}` → 204. Unauthorized access → 404.

- [X] T015 [US1] Implement createItem, updateItem, deleteItem in `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/service/PortfolioServiceImpl.java`:
  - `createItem` — persist new PortfolioItem with userId from principal, return PortfolioItemResponse (verificationStatus=NONE)
  - `updateItem` — `findByIdAndUserId` or throw `PortfolioItemNotFoundException`; apply non-null fields from `PortfolioItemUpdateRequest` only; return updated response
  - `deleteItem` — `@Transactional`; `findByIdAndUserId` or throw `PortfolioItemNotFoundException`; `portfolioItemRepository.delete(item)` (cascades to VerificationRequests)
- [X] T016 [US1] Add POST, PUT, DELETE endpoints to `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/controller/PortfolioController.java`:
  - `POST /portfolio/items` → 201 with `PortfolioItemResponse`
  - `PUT /portfolio/items/{itemId}` → 200 with updated item
  - `DELETE /portfolio/items/{itemId}` → 204 No Content
  - All inject `@AuthenticationPrincipal JwtUserDetails principal`
- [X] T017 [P] [US1] Create `backend/portfolio-service/src/test/java/com/skillbridge/portfolio/service/PortfolioServiceTest.java` — mock `PortfolioItemRepository`; test:
  - `createItem_happyPath_returnsItemWithVerificationStatusNone`
  - `updateItem_notFound_throwsPortfolioItemNotFoundException`
  - `updateItem_wrongUser_throwsPortfolioItemNotFoundException`
  - `deleteItem_happyPath_callsRepositoryDelete`
  - `deleteItem_notFound_throwsPortfolioItemNotFoundException`
- [X] T018 [P] [US1] Create `backend/portfolio-service/src/test/java/com/skillbridge/portfolio/controller/PortfolioControllerTest.java` — `@WebMvcTest(PortfolioController.class)`, `addFilters=false`; mock `PortfolioService`; test:
  - `createItem_validRequest_returns201`
  - `createItem_missingTitle_returns400`
  - `updateItem_notFound_returns404`
  - `deleteItem_validRequest_returns204`

**Checkpoint**: Item CRUD fully functional. `./mvnw test` passes for US1 tests.

---

## Phase 4: US2 — View Portfolio (P1)

**Goal**: Authenticated students see all their items (`GET /portfolio/mine`); public visitors see only verified items (`GET /portfolio/{userId}`).

**Independent Test**: `GET /portfolio/mine` (with token) → array including unverified items with verificationStatus field; `GET /portfolio/{userId}` (no token) → only verified items; `GET /portfolio/health` → `{"status":"UP"}`.

- [X] T019 [US2] Add getMyPortfolio, getPublicPortfolio to `PortfolioServiceImpl.java`:
  - `getMyPortfolio` — call `portfolioItemRepository.findByUserIdWithVerificationRequests(userId)` (JOIN FETCH); compute `verificationStatus` per item: if `item.isVerified()` → APPROVED; else if PENDING request in collection → PENDING; else if REJECTED → REJECTED; else NONE; return sorted list
  - `getPublicPortfolio` — `findByUserIdAndVerifiedTrue(userId)`; map to response with verificationStatus=APPROVED
- [X] T020 [US2] Add GET endpoints and health to `PortfolioController.java`:
  - `GET /portfolio/mine` → 200 authenticated
  - `GET /portfolio/{userId}` → 200 public (no `@AuthenticationPrincipal`)
  - `GET /portfolio/health` → 200 `{"status":"UP"}` public
- [X] T021 [P] [US2] Add tests to `PortfolioServiceTest.java`:
  - `getMyPortfolio_itemWithPendingRequest_returnsVerificationStatusPending`
  - `getMyPortfolio_itemWithNoRequest_returnsVerificationStatusNone`
  - `getMyPortfolio_verifiedItem_returnsVerificationStatusApproved`
  - `getPublicPortfolio_returnsOnlyVerifiedItems`
- [X] T022 [P] [US2] Add tests to `PortfolioControllerTest.java`:
  - `getMyPortfolio_authenticated_returns200`
  - `getPublicPortfolio_noAuth_returns200`
  - `health_returns200`

**Checkpoint**: Both portfolio view endpoints functional with verificationStatus in responses.

---

## Phase 5: US3 — Verification Workflow (P2)

**Goal**: Students request item verification (409 on duplicate); ADMIN approves/rejects (403 for non-admin).

**Independent Test**: `POST /portfolio/items/{id}/verify` → 201 PENDING; second call → 409; ADMIN `PATCH /portfolio/verification/{id}` with APPROVED → 200, item.verified becomes true; non-ADMIN → 403.

- [X] T023 [US3] Add requestVerification, reviewVerification to `PortfolioServiceImpl.java`:
  - `requestVerification(itemId, requestedBy)` — `findByIdAndUserId` or 404; `existsByPortfolioItemIdAndStatus(itemId, "PENDING")` → throw `DuplicateVerificationException` if true; persist new VerificationRequest(status=PENDING); return response
  - `reviewVerification(requestId, decision, reviewerNote, reviewedBy, reviewerRole)` — `@Transactional`; find by id or throw `VerificationRequestNotFoundException`; check status equals "PENDING" else throw `VerificationAlreadyResolvedException`; check `reviewerRole.equals("ADMIN")` else throw `AccessDeniedException("Access denied")`; set status, reviewedBy, reviewedAt; if APPROVED set `item.verified=true`; save; return response
- [X] T024 [US3] Add verification endpoints to `PortfolioController.java`:
  - `POST /portfolio/items/{itemId}/verify` → 201 with `VerificationRequestResponse`
  - `PATCH /portfolio/verification/{requestId}` → 200; passes `principal.userId()` and `principal.role()` to service
- [X] T025 [P] [US3] Add tests to `PortfolioServiceTest.java`:
  - `requestVerification_itemNotOwned_throwsPortfolioItemNotFoundException`
  - `requestVerification_pendingAlreadyExists_throwsDuplicateVerificationException`
  - `requestVerification_happyPath_returnsPendingRequest`
  - `reviewVerification_nonAdmin_throwsAccessDeniedException`
  - `reviewVerification_alreadyResolved_throwsVerificationAlreadyResolvedException`
  - `reviewVerification_approved_setsItemVerifiedTrue`
  - `reviewVerification_rejected_itemRemainsUnverified`
- [X] T026 [P] [US3] Add tests to `PortfolioControllerTest.java`:
  - `requestVerification_validRequest_returns201`
  - `requestVerification_duplicatePending_returns409`
  - `reviewVerification_adminApproved_returns200`
  - `reviewVerification_nonAdmin_returns403`
  - `reviewVerification_alreadyResolved_returns409`

**Checkpoint**: Verification workflow complete. Admin can review via API; verified badge visible via GET /portfolio/mine.

---

## Phase 6: US4 — Shareable Portfolio Link (P3)

**Goal**: Students generate a stable share URL; anyone can access verified portfolio via token (no auth).

**Independent Test**: `POST /portfolio/share` → 200 with shareToken; call again → same token (idempotent); `GET /portfolio/share/{token}` (no auth) → verified items; invalid token → 404.

- [X] T027 [US4] Create `backend/portfolio-service/src/main/java/com/skillbridge/portfolio/service/ShareTokenGenerator.java`:
  - `generateToken()` method: `new SecureRandom()` → `nextBytes(32)` → `Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)` → returns 43-char URL-safe token
  - Annotate with `@Component`
- [X] T028 [US4] Add generateShareLink, getSharePortfolio to `PortfolioServiceImpl.java` (inject `ShareTokenGenerator`):
  - `generateShareLink(userId, baseUrl)` — `portfolioLinkRepository.findByUserId(userId)` → if present return existing `ShareLinkResponse`; else generate token via `shareTokenGenerator.generateToken()`; persist new `PortfolioLink`; return `ShareLinkResponse(token, baseUrl + "/portfolio/share/" + token, true, createdAt)`
  - `getSharePortfolio(token)` — `findByShareTokenAndActiveTrue(token)` → throw `PortfolioItemNotFoundException("Share link not found")` if empty; get ownerId; return `getPublicPortfolio(ownerId)`
- [X] T029 [US4] Add share endpoints to `PortfolioController.java`:
  - `POST /portfolio/share` → 200; extract base URL from `HttpServletRequest` (`request.getScheme() + "://" + request.getServerName() + ":" + request.getServerPort()`)
  - `GET /portfolio/share/{token}` → 200 public (no auth)
- [X] T030 [P] [US4] Add tests to `PortfolioServiceTest.java`:
  - `generateShareLink_firstCall_persistsAndReturnsToken`
  - `generateShareLink_secondCall_returnsExistingToken`
  - `getSharePortfolio_invalidToken_throwsException`
  - `getSharePortfolio_validToken_returnsVerifiedItems`
- [X] T031 [P] [US4] Add tests to `PortfolioControllerTest.java`:
  - `generateShareLink_authenticated_returns200WithToken`
  - `getSharePortfolio_validToken_returns200`
  - `getSharePortfolio_invalidToken_returns404`

**Checkpoint**: Share links functional. Recruiters can view student portfolio without login.

---

## Phase 7: US5 — Frontend Portfolio Screen (P3)

**Goal**: Portfolio tab in the mobile app — list items with badges, add/delete items, request verification, share.

**Independent Test**: App builds; Portfolio tab renders between Roadmap and Profile; verified items show green badge; "Request Verification" button appears on NONE/REJECTED items; "Pending…" shown on PENDING items; delete triggers confirmation; share button shows/copies URL.

- [X] T032 [P] [US5] Create `frontend/services/portfolio.ts` — API functions using the same `fetch`/`request<T>` pattern as `frontend/services/skillGap.ts`:
  - `getMyPortfolio(token)` → `GET /portfolio/mine`
  - `createItem(token, payload)` → `POST /portfolio/items`
  - `updateItem(token, itemId, payload)` → `PUT /portfolio/items/{itemId}`
  - `deleteItem(token, itemId)` → `DELETE /portfolio/items/{itemId}` (direct fetch, 204 = no body)
  - `requestVerification(token, itemId)` → `POST /portfolio/items/{itemId}/verify`
  - `sharePortfolio(token)` → `POST /portfolio/share`
- [X] T033 [US5] Create `frontend/app/(app)/portfolio.tsx` — portfolio screen (depends on T032):
  - `useFocusEffect` + `useCallback` to reload items on tab focus
  - `FlatList` rendering `PortfolioItemCard` per item
  - `PortfolioItemCard` shows: title, itemType chip, verified badge (green checkmark when `verified=true`), verificationStatus-aware action button:
    - `verificationStatus === "NONE" || verificationStatus === "REJECTED"` → "Request Verification" button
    - `verificationStatus === "PENDING"` → disabled "Pending…" label
    - `verificationStatus === "APPROVED"` → no button (badge shown)
  - Delete: trash icon → `Alert.alert` confirmation → `deleteItem` (optimistic removal, rollback on error)
  - FAB or header "+" opens add-item `Modal`: itemType picker (PROJECT / CERTIFICATE / ACHIEVEMENT), title input, description input, externalUrl input → `createItem` on submit
  - "Share Portfolio" button → `sharePortfolio` → show token URL in `Alert` or clipboard copy
  - Loading, error, and empty states handled
- [X] T034 [US5] Update `frontend/app/(app)/_layout.tsx` — insert Portfolio tab between Roadmap and Profile:
  - Add `<Tabs.Screen name="portfolio" options={{ title: 'Portfolio', tabBarIcon: ... }} />` using `briefcase-outline` / `briefcase` Ionicons
  - Ensure `gap-report` remains hidden with `href: null`

**Checkpoint**: Mobile app renders Portfolio tab with full CRUD, verification, and share functionality.

---

## Phase 8: Polish & Infrastructure

**Purpose**: Integrate service into the platform stack.

- [X] T035 [P] Update `docker-compose.yml` — add `portfolio-service` entry: image build from `backend/portfolio-service`, port `8004:8004`, env vars `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `JWT_SECRET`; depends on `postgres`
- [X] T036 [P] Update `nginx/nginx.conf` — add upstream `portfolio_service { server portfolio-service:8004; }` and location `/portfolio/ { proxy_pass http://portfolio_service/portfolio/; }`
- [X] T037 [P] Update `.env.example` — add `# Portfolio Service` section with `PORTFOLIO_DB_NAME=portfolio`
- [X] T038 [P] Update `.github/workflows/` CI file — add `portfolio-service` to the build matrix alongside existing services (lint → test → build pattern)

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) ──────────────────────────────────► Phase 2 (Foundational)
                                                             │
                                              ┌──────────────┤
                                              ▼              ▼
                                        Phase 3 (US1)   Phase 7 (US5)*
                                              │
                                              ▼
                                        Phase 4 (US2)
                                              │
                                              ▼
                                        Phase 5 (US3)
                                              │
                                              ▼
                                        Phase 6 (US4)
                                              │
                                              ▼
                                        Phase 8 (Polish)
```

*US5 frontend depends on backend endpoints being stable (US1+US2 minimum).

### User Story Dependencies

- **US1 (P1)**: Requires Phase 2 complete. No dependency on other stories.
- **US2 (P1)**: Requires US1 complete (same `PortfolioServiceImpl.java` and `PortfolioController.java`).
- **US3 (P2)**: Requires US1+US2 (verification status appears in US2 responses).
- **US4 (P3)**: Requires US2 complete (share link returns public portfolio = US2's getPublicPortfolio).
- **US5 (P3)**: Requires US1+US2 minimum; full feature needs US3+US4.

### Within Each User Story

- Service impl → Controller → Tests (within the same story)
- Service test [P] and Controller test [P] can run in parallel after implementation

---

## Parallel Execution Examples

### Phase 2 (all tasks independent — launch together):
```
T005 Flyway migrations
T006 Entity classes
T007 Repositories
T008 Security classes
T009 Config classes
T010 application.yml
T011 Request DTOs
T012 Response DTOs
T013 Exceptions + GlobalExceptionHandler
T014 PortfolioService interface
```

### US1 (T015 blocks T016; T017 and T018 parallel after T016):
```
T015 → T016 → [T017, T018] in parallel
```

### US5 (T032 service parallel with planning; T034 parallel with T033):
```
T032 → T033 (depends on T032)
T034 (independent — only touches _layout.tsx)
```

---

## Implementation Strategy

### MVP (US1 + US2 backend only — no frontend, no verification, no share)

1. Complete Phase 1 (Setup)
2. Complete Phase 2 (Foundational)
3. Complete Phase 3 (US1 — Item CRUD)
4. Complete Phase 4 (US2 — Portfolio View)
5. **STOP & VALIDATE**: Run `./mvnw test` + quickstart.md manual steps for US1+US2
6. `docker-compose up portfolio-service` → health check passes

### Incremental Delivery

1. US1+US2 backend → working CRUD + public view (MVP)
2. US3 verification → admin can approve items (verified badge visible)
3. US4 share link → recruiters can access via URL
4. US5 frontend → mobile app tab with full feature
5. Phase 8 polish → service integrated into platform stack

---

## Notes

- Tests are required for JaCoCo ≥ 70% (spec success criteria #8)
- `PortfolioServiceTest.java` and `PortfolioControllerTest.java` accumulate tests across US1–US4 phases — mark each task [X] after adding its tests
- `PortfolioServiceImpl.java` grows incrementally across US1–US4 — this is expected
- Validate the `verificationStatus` computation carefully in US2 (T019) — it drives the frontend button logic in US5 (T033)
- `deleteItem` uses `@Transactional` — cascade removes VerificationRequests automatically via JPA `orphanRemoval=true`
- `reviewVerification` passes `principal.role()` as `reviewerRole` parameter — do NOT check role in controller
