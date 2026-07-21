# Research: Unified Career Screen

No blocking unknowns. All patterns are established in the existing codebase.

## Decision: State-driven single screen (not tabs)

**Decision**: One `career.tsx` file; `roadmap: Roadmap | null` state drives which view renders.

**Rationale**: The two views are mutually exclusive — you either have a roadmap or you don't. A tab-switching mechanism would re-introduce the same UX split we're removing. Local state is cheaper and simpler than routing.

**Alternatives considered**:
- Keep two routes but navigate programmatically — rejected; still two screens, still potential flash between them.
- Use a modal sheet for the picker — rejected; overkill for an onboarding flow that only runs once.

---

## Decision: `useFocusEffect` for roadmap re-fetch

**Decision**: Wrap `fetchRoadmap()` in `useFocusEffect` so the roadmap refreshes whenever the user returns to the Career tab.

**Rationale**: Tab screens persist in Expo Router v3 — they're never unmounted, so `useEffect` only fires once. `useFocusEffect` fires on every tab visit. This is the established pattern in `skill-gap.tsx:114`.

**Alternatives considered**: None. The pattern is already proven in the codebase.

---

## Decision: Hide old routes with `href: null`, delete files last

**Decision**: In `_layout.tsx`, add `career` entry and set `href: null` on `career-paths` and `roadmap` before deleting the source files. Delete the files as the final task.

**Rationale**: Expo Router registers routes by filename. Deleting a file before removing its `<Tabs.Screen>` entry causes a build error. Hiding it first (`href: null`) is the safe migration order — same pattern used for `gap-report` and `portfolio-review`.

---

## Decision: `changingPath` boolean flag, not a separate route state

**Decision**: `const [changingPath, setChangingPath] = useState(false)` inside `CareerScreen`.

**Rationale**: The "Change Path" action is a temporary in-screen mode, not a navigation event. A separate `mode: 'picker' | 'roadmap'` enum was considered but is equivalent — the boolean is simpler because the default (picker for new users) is already encoded in `roadmap === null`.
