# Research: Matching Service

**Date**: 2026-07-18 | **Feature**: specs/009-matching-service

Seven design decisions. All NEEDS CLARIFICATION items from Technical Context resolved here.

---

## Decision 1: Deterministic match score formula

**Decision**: Weighted skill-overlap ratio. Each `OpportunitySkill` has weight
`w = 2.0` if `required = true` (must-have), else `w = 1.0` (nice-to-have).

```
matchScore = 100.0 × Σ(w of matched skills) / Σ(w of all required skills)
```

- "Matched" = student's `student_skills` set contains the skill name (case-insensitive,
  trimmed comparison — see Decision 3).
- Rounded to 2 decimal places (NUMERIC(5,2) semantics).
- Student with empty skill profile → 0.00 for every opportunity (floor).
- Result ordering: `matchScore` DESC, tie-break `opportunity.createdAt` DESC (stable).

**Rationale**: SC-007 requires the score to be hand-reproducible from a documented formula.
A 2:1 must-have:nice-to-have weighting is the simplest weighting that makes "missing a
must-have hurts more than missing a nice-to-have" visible in acceptance tests. No AI call
means: instant (SC-002 ≤ 5s is trivially met), free, deterministic in tests, and
Constitution III is not engaged.

**Alternatives considered**:
- *Claude-scored semantic matching* — rejected: non-deterministic, costs money, slow, and
  requires Constitution III prompt plumbing for zero demo benefit at this scale.
- *Percentage of matched skills regardless of weight* — rejected: a student missing all
  must-haves but having all nice-to-haves would score well; misleading ranking.
- *Jaccard similarity* — rejected: penalizes opportunities with many requirements and
  conflates "student has extra skills" with fit; harder to explain by hand.

---

## Decision 2: Score computed at request time, no `student_matches` cache in v1

**Decision**: `GET /matching/opportunities` scores all active, non-expired opportunities
against the caller's skill profile in memory on every request. The `student_matches` table
from `docs/database.md` is NOT created in v1 migrations.

**Rationale**: 500 active opportunities (SC-002) = one indexed read
(`WHERE active = true AND (deadline IS NULL OR deadline >= today)`) + 500 arithmetic
evaluations — comfortably under 5 seconds. Spec assumption explicitly defers the cache.
Skill profile changes take effect immediately (spec edge case: "no stale cache").

**Alternatives considered**:
- *Persist `student_matches` on a schedule / on write* — rejected for v1: adds a
  recomputation trigger matrix (on new posting, on skill change, on deactivate, on
  deadline pass) for no measurable gain at demo scale. YAGNI. The table can be added
  later behind the same endpoint contract.

---

## Decision 3: Student skill profile storage and normalization

**Decision**: New `student_skills` table: `(id UUID PK, student_id UUID, skill_name
VARCHAR(150))`, unique on `(student_id, lower(skill_name))`. One row per skill — no
separate profile row; "profile" is the set of the student's skill rows.

- **Write API**: `PUT /matching/profile/skills` with the full desired list (replace
  semantics — delete missing, insert new, in one transaction). Idempotent, trivially
  testable, matches the frontend pattern of editing a list then saving once.
- **Normalization**: trim whitespace, collapse internal runs of whitespace to one space,
  store as typed. Comparison for scoring is case-insensitive (`lower()` on both sides).
- **Validation**: 0–50 skills, each non-blank after trim, max 150 chars, duplicates
  (case-insensitive) collapse to one.

**Rationale**: Spec Q1 chose a matching-service-owned profile. Replace-semantics PUT
avoids add/delete endpoint pairs and partial-update races. Row-per-skill (vs JSON array
column) keeps the unique constraint and scoring query simple in plain JPA.

**Alternatives considered**:
- *Client-supplied skills per request (spec Q1 option B)* — rejected by user: no canonical
  skill list exists in the app; scores would be client-influenceable.
- *JSONB skill array on a profile table* — rejected: loses unique constraint, harder to
  query/score, no benefit at this scale.

---

## Decision 4: Role enforcement via `@PreAuthorize` method security

**Decision**: Add `@EnableMethodSecurity` to `SecurityConfig` (the only additive change to
the copied config) and guard controller methods:

| Endpoint(s) | Guard |
|---|---|
| `POST /matching/opportunities`, `GET /matching/opportunities/mine`, `POST .../deactivate`, `GET .../applications` (recruiter) | `@PreAuthorize("hasRole('RECRUITER')")` → 403 otherwise |
| `POST .../apply`, `GET /matching/applications`, `GET/PUT /matching/profile/skills` | `@PreAuthorize("hasRole('STUDENT')")` → 403 otherwise |
| `GET /matching/opportunities` | Any authenticated role (matches are student-facing but harmless to expose; scoring uses the caller's own skills) |
| `GET /matching/health` | Public (in `PUBLIC_ENDPOINTS`) |

The JWT `role` claim is already mapped to `ROLE_<role>` by the copied `JwtUserDetails`.

**Rationale**: First service with role-guarded endpoints — no prior pattern to copy.
Method-level guards sit next to the handler they protect and are exercised directly in
`@WebMvcTest` slices. URL-based matchers would split one path prefix
(`/matching/opportunities`) across roles by HTTP method — fragile string coupling.

**Alternatives considered**:
- *SecurityConfig `requestMatchers` per method+path* — rejected: see above.
- *Manual role check in service layer* — rejected: duplicates Spring Security machinery,
  easy to forget on a new endpoint.

---

## Decision 5: Endpoint inventory and response shapes

**Decision**: 10 endpoints (9 protected + 1 public), full contract in
`contracts/matching-api.md`:

| # | Method & Path | Role | Returns |
|---|---|---|---|
| 1 | `POST /matching/opportunities` | RECRUITER | 201 `OpportunityResponse` |
| 2 | `GET /matching/opportunities` | authenticated | 200 `MatchListResponse` (ranked) |
| 3 | `POST /matching/opportunities/{id}/apply` | STUDENT | 201 `ApplicationResponse` |
| 4 | `GET /matching/applications` | STUDENT | 200 `[ApplicationWithOpportunity]` |
| 5 | `GET /matching/profile/skills` | STUDENT | 200 `SkillsResponse` |
| 6 | `PUT /matching/profile/skills` | STUDENT | 200 `SkillsResponse` |
| 7 | `GET /matching/opportunities/mine` | RECRUITER | 200 `[OpportunityResponse]` + applicant counts |
| 8 | `POST /matching/opportunities/{id}/deactivate` | RECRUITER (owner) | 200 `OpportunityResponse` (`active: false`) |
| 9 | `GET /matching/opportunities/{id}/applications` | RECRUITER (owner) | 200 `[ApplicantResponse]` |
| 10 | `GET /matching/health` | public | 200 `{ "status": "UP" }` |

`GET /matching/opportunities/{id}` (single opportunity detail) is deliberately omitted:
the match-list entry carries everything the detail view needs (description, skills,
score); students navigate from the list. Recruiters get full detail from `/mine`.

**Rationale**: Matches spec US1–US6 exactly; nothing more. Deactivate returns the updated
entity (200) rather than 204 so the frontend can re-render from the response.

**Alternatives considered**:
- *Detail endpoint* — rejected: YAGNI; list payload already carries detail fields.
- *DELETE for postings* — rejected: deactivate preserves application history integrity
  (spec edge case); hard delete would orphan student application rows.

---

## Decision 6: Frontend screen model — hidden screens, not a 7th tab

**Decision**: Two new hidden screens registered in `app/(app)/_layout.tsx` with
`href: null`:
- `opportunities.tsx` (student): ranked match list → expand card for detail → Apply
  button (optimistic) → "My Applications" section/tab within the screen. Skill profile
  edit lives here too (simple chip editor behind an "Edit skills" action).
- `opportunities-manage.tsx` (recruiter): post form, my postings list, deactivate,
  applicants bottom-sheet/section per posting.

Home screen gains an "Opportunities" QuickLink routing by role (`user.role ===
'RECRUITER'` → manage screen, else student screen). The last `ComingSoonCard`
("Internship Matches") is removed — with no cards left, the Coming Soon section is
dropped entirely.

**Rationale**: The tab bar already shows 6 tabs (Home, Skills, Career, Portfolio,
Interview, Profile); a 7th crowds mobile. Hidden screens + QuickLink is the established
pattern for `gap-report`, `portfolio-review`, `mock-interview-session`.

**Alternatives considered**:
- *Visible tab* — rejected: tab overflow on small screens.
- *Role-based tab swap* — rejected: more `_layout.tsx` complexity than the feature needs;
  recruiters are a demo persona reached via QuickLink.

---

## Decision 7: External postings via nullable `externalUrl` (added 2026-07-18)

**Decision**: Opportunities carry an optional `externalUrl` (http/https, ≤ 2048 chars).
Presence marks the posting as externally hosted. Matching is unchanged (description +
skills are always provided). Apply semantics become click-tracking for external postings:
`POST .../apply` still records the application (409/404 rules identical) and the response
includes the `externalUrl`; the client opens it for the student to complete the
application on the company's site. The match list exposes the field so clients can badge
external listings.

**Rationale**: Aligns with `docs/architecture.md` ("Application tracking (student clicks
apply)") and lets recruiters mirror listings from company careers pages without any new
endpoints, tables, or a second posting type. Student history and recruiter applicant
counts stay truthful because the click is always recorded first.

**Alternatives considered**:
- *Separate `source: INTERNAL|EXTERNAL` enum* — rejected: redundant; `externalUrl IS NOT
  NULL` already discriminates, and a second axis invites invalid combinations.
- *Skip recording applications for external postings* — rejected: breaks US4 (My
  Applications) and US6 (applicant counts) for exactly the listings students are most
  likely to pursue.
- *Automated ingestion (scraping / bulk import / admin-curated feeds)* — rejected for v1:
  separate feature with its own actor (admin), data-quality problems, and dedup concerns.
  Spec assumption documents manual posting only.
