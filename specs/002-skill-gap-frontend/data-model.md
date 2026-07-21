# Data Model: Skill Gap Frontend

**Feature**: `002-skill-gap-frontend`
**Date**: 2026-06-25

---

## TypeScript Types (`frontend/types/skillGap.ts`)

These types mirror the response shape from `skill-gap-service`. They are **API response types** — not state types.

```ts
export interface RecommendationResponse {
  id: string;
  type: string;       // "COURSE" | "BOOK" | "PROJECT" — string, not enum, for forward compatibility
  title: string;
  url: string | null; // null allowed — UI must handle gracefully
}

export interface SkillGapItem {
  id: string;
  skillName: string;
  importanceRank: number; // 1 = most important; used for sorting and display
  description: string;
  recommendations: RecommendationResponse[];
}

export interface GapReport {
  reportId: string;
  targetRole: string;
  gaps: SkillGapItem[];
}
```

---

## Screen State Models

### SkillGapScreen (`app/(app)/skill-gap.tsx`)

| State field       | Type                       | Notes |
|-------------------|----------------------------|-------|
| `pickedFile`      | `DocumentPickerAsset \| null` | Set by `expo-document-picker`; cleared after successful submit |
| `targetRole`      | `string`                   | Controlled text input |
| `isAnalysing`     | `boolean`                  | `true` while POST /analyse is in-flight |
| `analyseError`    | `string \| null`           | Error message for failed analysis |
| `reports`         | `GapReport[]`              | From GET /skill-gap/reports on mount |
| `isLoadingHistory`| `boolean`                  | `true` while loading history |
| `historyError`    | `string \| null`           | Error message for failed history load |

### GapReportScreen (`app/(app)/gap-report/[reportId].tsx`)

| State field   | Type              | Notes |
|---------------|-------------------|-------|
| `report`      | `GapReport \| null` | Loaded via GET /skill-gap/reports/{reportId} OR passed via navigation params |
| `isLoading`   | `boolean`         | Loading indicator while fetching |
| `error`       | `string \| null`  | Error message if fetch fails |

---

## Navigation Parameters

`gap-report/[reportId].tsx` receives `reportId` as a dynamic segment.

Pass from SkillGapScreen: `router.push(`/gap-report/${reportId}`)`.

The screen fetches the full report from the API (not relying on navigation state) to support deep links and refreshes.

---

## Recommendation Type Icons

| `type` value | Ionicons icon          | Color              |
|--------------|------------------------|--------------------|
| `COURSE`     | `school-outline`       | `colors.tertiary` (#2563EB) |
| `BOOK`       | `book-outline`         | `colors.secondary` (#059669) |
| `PROJECT`    | `code-slash-outline`   | `colors.primary` (#0F172A) |
| (default)    | `link-outline`         | `colors.onSurfaceVariant` |

---

## Relationships

```
SkillGapScreen
  ├── calls skillGapService.analyseCV() → POST /skill-gap/analyse → GapReport
  ├── calls skillGapService.getReports() → GET /skill-gap/reports → GapReport[]
  └── navigates to → GapReportScreen (with reportId)

GapReportScreen
  └── calls skillGapService.getReport(reportId) → GET /skill-gap/reports/{reportId} → GapReport
```
