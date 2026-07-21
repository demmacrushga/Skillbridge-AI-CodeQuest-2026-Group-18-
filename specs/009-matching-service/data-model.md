# Data Model: Matching Service

**Date**: 2026-07-18 | **Schema**: `matching` (isolated per Constitution I)

## Entities

### `Opportunity`
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, generated | — |
| postedBy | UUID | NOT NULL | Recruiter user id — plain UUID, no cross-schema FK |
| title | VARCHAR(255) | NOT NULL, non-blank | — |
| companyName | VARCHAR(255) | NOT NULL, non-blank | — |
| description | TEXT | NOT NULL, non-blank | — |
| location | VARCHAR(255) | NULL | — |
| opportunityType | ENUM(INTERNSHIP, ENTRY_LEVEL) | NOT NULL | case-sensitive, string-stored |
| deadline | DATE | NULL | expired rows excluded from matches |
| externalUrl | VARCHAR(2048) | NULL | externally-hosted listing; apply still records + returns URL |
| active | BOOLEAN | NOT NULL, DEFAULT TRUE | deactivate sets false |
| createdAt | TIMESTAMPTZ | NOT NULL, DEFAULT now() | tie-break for equal scores |
| skills | `@OneToMany(mappedBy, cascade ALL, orphanRemoval)` | — | `@OrderBy id` for stable output |

### `OpportunitySkill`
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, generated | — |
| opportunity | `@ManyToOne(LAZY)` FK → opportunities.id | NOT NULL, ON DELETE CASCADE | — |
| skillName | VARCHAR(150) | NOT NULL, non-blank | stored as typed (trimmed) |
| required | BOOLEAN | NOT NULL, DEFAULT TRUE | true = must-have (weight 2), false = nice-to-have (weight 1) |

### `Application`
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, generated | — |
| studentId | UUID | NOT NULL | plain UUID |
| opportunity | `@ManyToOne(LAZY)` FK → opportunities.id | NOT NULL | NOT cascade-deleted (history preserved) |
| appliedAt | TIMESTAMPTZ | NOT NULL, DEFAULT now() | — |
| — | UNIQUE(student_id, opportunity_id) | — | duplicate apply → 409 via constraint catch |

### `StudentSkill`
| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK, generated | — |
| studentId | UUID | NOT NULL | plain UUID |
| skillName | VARCHAR(150) | NOT NULL | trimmed; compared case-insensitively |
| — | UNIQUE(student_id, lower(skill_name)) | — | functional unique index |

**Not created in v1** (research Decision 2): `student_matches` — scores computed at
request time; table may be added later as a cache without contract changes.

## Migrations (Flyway)

| Version | File | Contents |
|---|---|---|
| V1 | `V1__create_schema.sql` | `CREATE SCHEMA IF NOT EXISTS matching` |
| V2 | `V2__create_opportunities.sql` | `opportunities` + `opportunity_skills` tables, FK cascade, indexes on `active, deadline` and `opportunity_id` |
| V3 | `V3__create_applications.sql` | `applications` table, unique `(student_id, opportunity_id)`, indexes on `student_id` and `opportunity_id` |
| V4 | `V4__create_student_skills.sql` | `student_skills` table, functional unique index `(student_id, lower(skill_name))`, index on `student_id` |

## DTOs

### Requests
- **PostOpportunityRequest**: `title` @NotBlank @Size(max=255), `companyName` @NotBlank
  @Size(max=255), `description` @NotBlank @Size(max=5000), `location` @Size(max=255),
  `opportunityType` @NotNull (INTERNSHIP|ENTRY_LEVEL, case-sensitive), `deadline`
  @FutureOrPresent (optional — same-day deadlines are valid, matching eligibility is
  `deadline >= CURRENT_DATE`), `externalUrl` @Pattern(http/https) @Size(max=2048)
  (optional), `requiredSkills` @NotEmpty @Size(max=30) of SkillRequirementRequest
- **SkillRequirementRequest**: `skillName` @NotBlank @Size(max=150), `required` boolean
  (default true)
- **UpdateSkillsRequest**: `skills` @NotNull @Size(max=50) of @NotBlank @Size(max=150)
  strings; duplicates (case-insensitive) collapse

### Responses
- **OpportunityResponse**: id, title, companyName, description, location, opportunityType,
  deadline, externalUrl (nullable), active, createdAt, requiredSkills[{skillName, required}],
  applicantCount (recruiter views only; null/omitted for students)
- **MatchResponse**: opportunity (OpportunityResponse), matchScore (0.00–100.00), rank,
  applied (boolean — caller already applied; drives button state)
- **MatchListResponse**: matches[MatchResponse]
- **ApplicationResponse**: id, opportunityId, appliedAt, externalUrl (nullable — present
  when the posting is external so the client can open it after recording the click)
- **ApplicationWithOpportunityResponse**: id, appliedAt, opportunity (OpportunityResponse)
- **ApplicantResponse**: studentId, appliedAt
- **SkillsResponse**: skills[string]

## Validation Rules (from spec FR-001/FR-010)

| Rule | Error |
|---|---|
| title/companyName/description blank | 400 |
| opportunityType invalid or wrong case | 400 |
| requiredSkills empty or > 30 | 400 |
| skill list > 50, or any blank/>150 after trim | 400 |
| deadline before today (today is valid) | 400 |
| externalUrl malformed (non-http/https) or > 2048 chars | 400 |
| apply to unknown/inactive/expired opportunity | 404 |
| duplicate application | 409 |
| recruiter resource not owned by caller | 404 |
| non-RECRUITER on recruiter endpoints / non-STUDENT on student endpoints | 403 |

## State Transitions

- **Opportunity.active**: `true → false` via deactivate (one-way in v1; no reactivate endpoint).
- **Opportunity eligibility for matching** (derived, not stored):
  `active = true AND (deadline IS NULL OR deadline >= CURRENT_DATE)`.
- **Application**: created on apply; never deleted in v1 (no withdraw endpoint).
