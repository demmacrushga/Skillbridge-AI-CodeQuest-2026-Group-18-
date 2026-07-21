# Tasks: Unified Career Screen

**Input**: Design documents from `/specs/007-unified-career-screen/`

**Branch**: `feat/unified-career-screen`

**Prerequisites**: plan.md ✓ | spec.md ✓ | research.md ✓ | contracts/career-screen.md ✓ | quickstart.md ✓

**No tests requested** — this is a pure frontend refactor with manual QA via quickstart.md.

---

## Phase 1: Setup

**Purpose**: Verify no new dependencies are needed before implementation begins.

- [X] T001 Confirm all imports in `career-paths.tsx` and `roadmap.tsx` are already available in the frontend package.json — no `npm install` needed; in `frontend/package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the unified screen skeleton with state shape, fetch logic, and conditional render scaffold — every user story phase builds on this.

**⚠️ CRITICAL**: All US phases depend on this being complete first.

- [X] T002 Create `frontend/app/(app)/career.tsx` with: all state variables from the contract (`roadmap`, `isLoading`, `error`, `changingPath`, `paths`, `selectedPath`, `level`, `skills`, `isGenerating`, `generateError`), `useAuth()` import, `useFocusEffect` + `fetchRoadmap()` stub, and a top-level conditional render scaffold (`isLoading` → loading, `error` → error, `roadmap && !changingPath` → roadmap placeholder, else → picker placeholder)

**Checkpoint**: `career.tsx` exists and compiles with placeholder `<View />` returns — foundation ready

---

## Phase 3: User Story 1 — New Student Sees Career Path Picker (Priority: P1) 🎯 MVP

**Goal**: A student with no roadmap sees the full career path picker (path grid, level selector, skill tags, generate button) and can trigger roadmap generation, which renders the roadmap in-place on success.

**Independent Test**: Log in as user with no roadmap → Career tab shows picker → select path + level → tap "Generate My Roadmap" → `GeneratingOverlay` appears → on success, roadmap renders in-place without navigation.

### Implementation for User Story 1

- [X] T003 [P] [US1] Lift `TYPE_CONFIG`, `PATH_META`, `LEVELS`, and `GENERATING_STEPS` constants verbatim from `career-paths.tsx` into `career.tsx` (top-level, above component); in `frontend/app/(app)/career.tsx`
- [X] T004 [P] [US1] Lift `GeneratingOverlay` sub-component (animated rings, step text, `usePulse` calls) verbatim from `career-paths.tsx` into `career.tsx`; in `frontend/app/(app)/career.tsx`
- [X] T005 [P] [US1] Lift `SkillTags` sub-component verbatim from `career-paths.tsx` into `career.tsx`; in `frontend/app/(app)/career.tsx`
- [X] T006 [US1] Replace picker placeholder with full picker JSX (path grid, level selector, `SkillTags`, generate button) inside the `else` branch of the render scaffold — rendered when `roadmap === null || changingPath`; in `frontend/app/(app)/career.tsx`
- [X] T007 [US1] Implement `handleGenerate()`: calls `generateRoadmap()` (sets `isGenerating=true` before, `isGenerating=false` on success/failure only), then `fetchRoadmap()`, then `setChangingPath(false)` — on error sets `generateError` and leaves picker visible; in `frontend/app/(app)/career.tsx`

**Checkpoint**: US1 independently testable — new user sees picker, generates roadmap, roadmap renders in-place

---

## Phase 4: User Story 2 — Returning Student Sees Roadmap Directly (Priority: P1)

**Goal**: A student with an existing roadmap opens Career tab and sees their roadmap immediately — progress bar, semester groups, Up Next card, mark-complete action. No picker shown.

**Independent Test**: Log in as user with existing roadmap → Career tab shows roadmap directly (no picker, no flash) → progress %, completed rows, Up Next card all render → pull-to-refresh re-fetches → "Mark Complete" updates progress.

### Implementation for User Story 2

- [X] T008 [P] [US2] Lift `CompletedRow` and `MilestoneCard` sub-components verbatim from `roadmap.tsx` into `career.tsx`; in `frontend/app/(app)/career.tsx`
- [X] T009 [P] [US2] Lift `UpNextCard` sub-component (with `usePulse` animation, note input, "Mark Complete" button) verbatim from `roadmap.tsx` into `career.tsx`; in `frontend/app/(app)/career.tsx`
- [X] T010 [US2] Replace roadmap placeholder with full roadmap JSX (progress header, semester group list, `UpNextCard`, `CompletedRow` entries, celebration state for all-complete) inside the `roadmap && !changingPath` branch; in `frontend/app/(app)/career.tsx`
- [X] T011 [US2] Implement `completeMilestone()` handler and `ScrollView` `refreshControl` (pull-to-refresh calls `fetchRoadmap()`) in CareerScreen; in `frontend/app/(app)/career.tsx`
- [X] T012 [US2] Replace loading and error placeholders: Loading → centered `ActivityIndicator`; Error → error icon + message + "Try Again" `TouchableOpacity` that calls `fetchRoadmap()` (MUST NOT render picker); in `frontend/app/(app)/career.tsx`

**Checkpoint**: US2 independently testable — returning user lands on roadmap, completes a milestone, sees progress update

---

## Phase 5: User Story 3 — Student Can Change Career Path (Priority: P2)

**Goal**: A student with a roadmap can tap "Change Path" to transition back to the picker in-place, with a confirmation dialog that clarifies the existing roadmap is only replaced on successful generation.

**Independent Test**: Has roadmap → tap "Change Path" → confirmation dialog appears → cancel → roadmap still shown → tap again → confirm → picker renders in same tab → generate new roadmap → new roadmap renders, old gone.

### Implementation for User Story 3

- [X] T013 [US3] Add "Change Path" `TouchableOpacity` button to the roadmap section header (top-right of roadmap view header area); in `frontend/app/(app)/career.tsx`
- [X] T014 [US3] Implement `handleChangePath()` with `Alert.alert('Change Career Path', 'Your current roadmap will be replaced when you generate a new one.', [{text:'Cancel', style:'cancel'}, {text:'Change Path', style:'destructive', onPress: () => setChangingPath(true)}])` — existing roadmap NOT deleted on confirm; `setChangingPath(false)` called only after new generation succeeds or fails; in `frontend/app/(app)/career.tsx`

**Checkpoint**: US3 independently testable — all three user stories now work end-to-end

---

## Phase 6: Polish & Integration

**Purpose**: Wire the new screen into the tab bar and dashboard, remove old files, validate types.

- [X] T015 Update `frontend/app/(app)/_layout.tsx` — add `<Tabs.Screen name="career" options={{ title: 'Career', tabBarIcon: compass }} />` at the position where career-paths was; set `href: null` on both the `career-paths` and `roadmap` entries (keep them registered to avoid Expo Router warnings until files are deleted in T017)
- [X] T016 Update `frontend/app/(app)/index.tsx` — change all `router.push('./roadmap')` → `router.push('./career')`, change all `router.push('./career-paths')` → `router.push('./career')`, rename the "Roadmap" quick-link label → "Career" (FR-010)
- [X] T017 Delete `frontend/app/(app)/career-paths.tsx` and `frontend/app/(app)/roadmap.tsx` — safe to delete only after T015 has set their `_layout.tsx` entries to `href: null`
- [X] T018 [P] Run TypeScript check in `frontend/` — `cd frontend && npx tsc --noEmit` — verify 0 errors; fix any type mismatches before marking complete
- [ ] T019 [P] Run manual QA against all 6 scenarios in `specs/007-unified-career-screen/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1
- **US1 (Phase 3)**: Depends on Phase 2 (T002 must exist) — can start immediately after
- **US2 (Phase 4)**: Depends on Phase 2 — independent of US1 (different JSX branch)
- **US3 (Phase 5)**: Depends on US2 (needs roadmap view header to exist)
- **Polish (Phase 6)**: Depends on all US phases complete

### User Story Dependencies

- **US1 (P1)**: Requires T002 only — the picker branch is self-contained
- **US2 (P1)**: Requires T002 only — the roadmap branch is self-contained
- **US3 (P2)**: Requires T010 (roadmap JSX) to have the header it attaches to

### Within Each User Story

- T003/T004/T005 are all `[P]` — lift independently in parallel
- T008/T009 are all `[P]` — lift independently in parallel
- T006 depends on T003/T004/T005 (needs constants + sub-components)
- T010 depends on T008/T009 (needs sub-components)
- T013/T014 depend on T010 (need the roadmap header to exist)
- T018/T019 are `[P]` — can run simultaneously after T017

---

## Parallel Execution Examples

### US1 — lift phase (T003/T004/T005 in parallel):

```
Task: "Lift TYPE_CONFIG/PATH_META/LEVELS/GENERATING_STEPS constants into career.tsx"
Task: "Lift GeneratingOverlay sub-component into career.tsx"
Task: "Lift SkillTags sub-component into career.tsx"
```

### US2 — lift phase (T008/T009 in parallel):

```
Task: "Lift CompletedRow + MilestoneCard sub-components into career.tsx"
Task: "Lift UpNextCard sub-component into career.tsx"
```

### Polish — validation (T018/T019 in parallel):

```
Task: "cd frontend && npx tsc --noEmit"
Task: "Run quickstart.md QA scenarios manually"
```

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Complete Phase 1 + 2 (T001–T002)
2. Complete Phase 3 (T003–T007)
3. Complete T015 + T016 (wire into tab bar + dashboard)
4. **STOP and VALIDATE**: new user sees picker, generates roadmap, roadmap renders
5. Ship / demo

### Full Delivery

1. Setup + Foundational → T001–T002
2. US1 → T003–T007 → test independently
3. US2 → T008–T012 → test independently
4. US3 → T013–T014 → test independently
5. Polish → T015–T019 → TypeScript clean + manual QA
6. Delete old files (T017) last, after tab bar is wired

---

## Notes

- No backend changes — API calls are unchanged (`getRoadmap`, `generateRoadmap`, `completeMilestone`, `getCareerPaths`)
- `[P]` = different files or independent sub-tasks, no shared dependency
- `career.tsx` is the only file edited across Phases 2–5; all sub-components are inlined (not extracted to separate files)
- Delete order matters: T015 (href:null) → T017 (delete files) — never reverse
- `isGenerating` flag cleared ONLY on generation success or failure, never on tab blur (FR-016)
- Error state renders instead of picker when fetch fails (FR-015) — do not fall back to picker
