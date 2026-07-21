# Data Model: Delete Past Analysis

## No schema changes

This feature does **not** require a Flyway migration. All cascade relationships already exist.

## Existing entities involved

### GapReport (primary target)

```
gap_reports
├── id UUID PK
├── cv_upload_id UUID FK → cv_uploads.id
├── user_id UUID (ownership)
├── target_role TEXT
└── created_at TIMESTAMPTZ
```

**Cascade chain on delete:**
```
gap_reports ──(CASCADE ALL)──> skill_gaps ──(CASCADE ALL)──> resource_recommendations
```

Deleting a `GapReport` entity via JPA removes all its `SkillGap` children, which in turn remove all their `ResourceRecommendation` children automatically.

### CvUpload (cleaned up explicitly)

```
cv_uploads
├── id UUID PK
├── user_id UUID
├── file_name TEXT
├── file_type TEXT
├── storage_path TEXT (nullable since V5 migration)
├── extracted_text TEXT
├── status VARCHAR
└── created_at TIMESTAMPTZ
```

`GapReport` holds a `@ManyToOne` FK to `CvUpload`. JPA does not support `CascadeType.REMOVE` on `@ManyToOne`, so the service explicitly deletes the `CvUpload` after the `GapReport` is gone.

Each report has exactly one `CvUpload` (1:1 in practice, even though the DB allows 1:N). No other report references the same `cv_uploads` row, so the explicit delete is safe.

## Repository changes

### GapReportRepository — no changes needed

`findByIdAndUserId(UUID id, UUID userId)` already exists and is used for ownership-checked lookup before delete.

`GapReportRepository` extends `JpaRepository<GapReport, UUID>` which provides `delete(GapReport entity)` — no new query methods required.

## Service layer additions

### SkillGapService (interface)

Add one method:

```java
void deleteReport(UUID reportId, UUID userId);
```

### SkillGapServiceImpl

```java
@Transactional
public void deleteReport(UUID reportId, UUID userId) {
    GapReport report = gapReportRepository.findByIdAndUserId(reportId, userId)
        .orElseThrow(() -> new ReportNotFoundException(reportId));
    CvUpload cvUpload = report.getCvUpload();
    gapReportRepository.delete(report);           // cascades to skill_gaps + resource_recommendations
    cvUploadRepository.delete(cvUpload);          // explicit cleanup of parent
}
```

## Frontend state changes

No new types. The `GapReport` type (`frontend/types/skillGap.ts`) and `skillGap.ts` service gain:

```typescript
// services/skillGap.ts
export async function deleteReport(token: string, reportId: string): Promise<void> {
  await request<void>(`/skill-gap/reports/${reportId}`, token, { method: 'DELETE' });
}
```

State management in `skill-gap.tsx`: the `reports` array removes the entry with matching `reportId` after confirmation. No new state fields.
