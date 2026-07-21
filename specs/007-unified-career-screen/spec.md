# Feature Specification: Unified Career Screen

**Feature Branch**: `007-unified-career-screen`

**Created**: 2026-06-29

**Status**: Draft

**Input**: The app currently has two separate tabs — "Careers" and "Roadmap" — that represent a single linear journey: pick a career path → generate a roadmap → track it. This creates unnecessary tab-switching and splits a cohesive flow across two screens. Consolidate both into a single **Career** tab that is state-driven: show the career path picker when no roadmap exists, and show the roadmap directly when one does, with an in-screen option to change paths.

---

## User Scenarios & Testing

### User Story 1 — New Student Sees Career Path Picker (Priority: P1)

A student who has not yet generated a roadmap opens the Career tab. They see the full career path selection wizard (choose path, choose academic level, add current skills) and can generate their roadmap. After generation, the same tab transitions to showing the roadmap directly.

**Why this priority**: This is the primary onboarding flow. Every new user hits this screen first.

**Independent Test**: Student has no roadmap → Career tab shows path picker → student selects path + level + skills → taps "Generate My Roadmap" → generation overlay appears → roadmap renders in-place → revisiting the Career tab now shows the roadmap directly, not the picker.

**Acceptance Scenarios**:

1. **Given** a student has no roadmap, **When** they open the Career tab, **Then** they see the career path picker (path grid, level selector, skills input, generate button).
2. **Given** a student selects a career path and taps "Generate My Roadmap", **When** Claude generates the roadmap, **Then** the generating overlay appears in the same screen (no navigation to a separate tab).
3. **Given** generation succeeds, **When** the roadmap is ready, **Then** the Career tab transitions to showing the roadmap in-place and the "Careers" section of the tab bar is removed.
4. **Given** generation fails (network error), **Then** an error message is shown and the student remains on the picker — they can try again.

---

### User Story 2 — Returning Student Sees Roadmap Directly (Priority: P1)

A student who already has a roadmap opens the Career tab and sees their roadmap immediately — progress bar, milestones grouped by semester, Up Next card, complete milestone action. No picker is shown.

**Why this priority**: Returning users (the majority after day 1) should land directly on their roadmap without any intermediate step.

**Independent Test**: Student has an existing roadmap → Career tab shows roadmap → progress %, next milestone, semester groups all render correctly.

**Acceptance Scenarios**:

1. **Given** a student has an existing roadmap, **When** they open the Career tab, **Then** the roadmap renders immediately (no picker).
2. **Given** the roadmap has completed milestones, **Then** completed ones show as compact rows and incomplete ones show as active cards.
3. **Given** all milestones are completed, **Then** a "You've completed your roadmap!" celebration state is shown with a "Change Path" option.

---

### User Story 3 — Student Can Change Career Path (Priority: P2)

A student with an existing roadmap wants to switch career paths (e.g. they changed from Software Engineer to Data Analyst). They tap "Change Path" in the roadmap header. A confirmation dialog warns them their existing roadmap will be replaced. If they confirm, the screen transitions back to the career path picker in-place.

**Why this priority**: Without this, students who want to change paths are stuck — they have no way to access the picker once a roadmap exists. This was previously achieved by visiting the separate "Careers" tab.

**Independent Test**: Student has roadmap → taps "Change Path" → confirmation dialog → confirms → Career tab shows picker → student picks new path + generates → roadmap updates in-place.

**Acceptance Scenarios**:

1. **Given** a student has an existing roadmap, **When** they tap the "Change Path" button in the Career header, **Then** a confirmation dialog appears: "This will replace your current roadmap. Continue?"
2. **Given** the student confirms, **Then** the screen transitions to the career path picker without leaving the Career tab.
3. **Given** the student cancels, **Then** nothing changes and the roadmap remains visible.
4. **Given** the student picks a new path and generates, **Then** the old roadmap is replaced and the new one renders in-place.

---

### Edge Cases

- What if the roadmap fetch fails? Show an error state with a retry button. Do not fall back to the picker (would confuse the user into thinking they have no roadmap).
- What if the roadmap loads slowly? Show a loading indicator centered in the screen (same pattern as current roadmap.tsx).
- What if the user is on the "Change Path" picker and navigates away mid-flow? State resets on focus — if the user re-opens the Career tab they see the roadmap (the existing roadmap was never deleted; only a new generation would replace it).
- What if a student has no roadmap but taps the Career tab on the dashboard's "Up Next" card? The dashboard card should link to the unified Career tab; if no roadmap, the picker renders.

---

## Requirements

### Functional Requirements

- **FR-001**: In `_layout.tsx`, the `career-paths` tab entry MUST be replaced with a `career` entry (title "Career", compass icon); the `roadmap` entry MUST be set to `href: null` (hidden from the tab bar but kept registered until the source files are deleted). This reduces the visible tab bar from 6 to 5 tabs.
- **FR-002**: A single **"Career"** tab MUST replace the old "Careers" and "Roadmap" tabs at the same position in the tab bar.
- **FR-003**: The Career tab MUST render the career path picker when `getRoadmap()` returns null/404.
- **FR-004**: The Career tab MUST render the roadmap when `getRoadmap()` returns a valid roadmap.
- **FR-005**: All logic from `career-paths.tsx` (path grid, level picker, skill tags, generation overlay) MUST be preserved exactly in the new unified screen.
- **FR-006**: All logic from `roadmap.tsx` (semester groups, Up Next card, progress bar, complete milestone) MUST be preserved exactly in the new unified screen.
- **FR-007**: The unified screen MUST include a "Change Path" button in the roadmap header that transitions back to the picker in-place (no separate navigation).
- **FR-008**: The "Change Path" action MUST show a confirmation dialog before transitioning. The dialog MUST clarify that the existing roadmap is only replaced when a new generation succeeds — cancelling or a failed generation leaves the current roadmap intact.
- **FR-009**: The old `career-paths.tsx` and `roadmap.tsx` files MUST be deleted after migration.
- **FR-010**: The dashboard screen (`index.tsx`) quick links MUST be updated: all navigation targets pointing to `./roadmap` or `./career-paths` MUST be changed to `./career`, and the visible label for the "Roadmap" quick link MUST be renamed to **"Career"**.
- **FR-011**: The dashboard "Up Next" card link MUST point to `./career`.
- **FR-012**: The dashboard "Build your roadmap" empty state link MUST point to `./career`.
- **FR-013**: `useFocusEffect` MUST be used to re-fetch the roadmap when the tab regains focus (same pattern as other tabs).
- **FR-015**: When `fetchRoadmap()` fails (network error, server error), the screen MUST render an error state with a retry button. The screen MUST NOT fall back to the picker view — displaying the picker when the roadmap simply failed to load would incorrectly signal to the user that they have no roadmap.
- **FR-016**: If the user navigates away from the Career tab while generation is in progress (`isGenerating === true`) and then returns, `useFocusEffect` will fire `fetchRoadmap()`. If generation has since completed, the roadmap renders; if generation is still in progress (unlikely on return but possible), the generating overlay MUST re-appear. The `isGenerating` flag MUST be cleared only on generation success or failure — never on tab blur.

### Key Entities (unchanged — no backend changes)

No new entities. The feature reuses existing API calls:
- `getRoadmap(token, userId)` — from `@/services/career`
- `generateRoadmap(token, payload)` — from `@/services/career`
- `completeMilestone(token, milestoneId, note)` — from `@/services/career`
- `getCareerPaths()` — from `@/services/career`

---

## Success Criteria

- **SC-001**: The bottom tab bar shows exactly 5 tabs: Home, Skills, Career, Portfolio, Profile (was 6).
- **SC-002**: Navigating to the Career tab with no roadmap renders the path picker in under 1 second (paths already cached from dashboard).
- **SC-003**: Navigating to the Career tab with an existing roadmap renders the roadmap directly — no picker flash.
- **SC-004**: "Change Path" confirmation dialog appears before any transition. Cancelling shows no change.
- **SC-005**: All existing roadmap functionality (complete milestone, progress bar, semester groups) works identically.
- **SC-006**: No TypeScript errors (`npx tsc --noEmit` passes).
- **SC-007**: Dashboard links to `./career` for both quick actions, and the "Roadmap" label is renamed to "Career".
- **SC-008**: When the backend is unreachable, the Career tab shows an error state with a retry button — it does NOT render the picker as a fallback.

---

## Assumptions

- No backend changes. All API calls stay the same.
- The Expo Router `name` for the new file is `career` (maps to `frontend/app/(app)/career.tsx`).
- The old files `career-paths.tsx` and `roadmap.tsx` are safe to delete once the new screen is verified — no other route references them directly (confirmed by grepping `_layout.tsx` and `index.tsx`).
- The `useFocusEffect` refresh pattern (already used in skill-gap and portfolio tabs) is the right pattern for re-fetching on tab focus.
- The screen renders either the picker or the roadmap — never both at once. Toggle is driven by `roadmap` state: null → picker, non-null → roadmap.
