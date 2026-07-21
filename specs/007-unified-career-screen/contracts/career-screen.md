# UI Contract: Career Screen (`career.tsx`)

## States

### Loading
- Triggered: on mount and on tab focus (via `useFocusEffect`)
- Renders: centered `ActivityIndicator`
- Exits to: `Picker` (404 / null roadmap), `Roadmap` (valid roadmap), or `Error` (fetch failure)

### Error
- Condition: `fetchRoadmap()` threw a network or server error
- Renders: error icon + message + "Try Again" button
- MUST NOT render the Picker — a failed fetch does not mean the user has no roadmap
- Actions:
  - Tap "Try Again" → re-runs `fetchRoadmap()` → transitions to Loading
- Exits to: `Loading` (on retry)

### Picker
- Condition: `roadmap === null && !changingPath` OR `changingPath === true`
- Renders: `GeneratingOverlay` (during generation) OR full picker form (path grid + level + skills + generate button)
- Actions:
  - Select career path card → `selectedPath` state
  - Select academic level node → `level` state
  - Add/remove skills → `skills[]` state
  - Tap "Generate My Roadmap" → shows `GeneratingOverlay`, calls `generateRoadmap()`, then `fetchRoadmap()`, then transitions to Roadmap state
  - Generation error → `generateError` inline message, remains in Picker state (overlay dismissed)
- Tab switch during generation: `isGenerating` flag is NOT cleared on tab blur. On tab return, `useFocusEffect` re-runs `fetchRoadmap()`. If generation completed, roadmap loads and clears `isGenerating`. If still generating, overlay re-appears.
- Exits to: `Roadmap` (after successful generation)

### Roadmap
- Condition: `roadmap !== null && !changingPath`
- Renders: progress header, semester groups, Up Next card, completed rows, Change Path button in header
- Actions:
  - Tap "Mark Complete" on Up Next card → `completeMilestone()` → re-fetch
  - Tap "Change Path" → `Alert.alert` confirmation → on confirm: sets `changingPath = true`; on cancel: no change. The existing roadmap is NOT deleted on confirm — it is only replaced if a new generation succeeds.
  - Pull-to-refresh → `fetchRoadmap()`
- Exits to: `Picker` (on "Change Path" confirmed)

---

## Props / External Interface

`CareerScreen` takes no props — it reads `state.accessToken` and `state.user` from `useAuth()`.

---

## Navigation

No `router.push()` calls inside this screen — all actions are in-screen state transitions.

Called from:
- Tab bar (bottom navigation)
- `index.tsx` quick links via `router.push('./career')`

---

## State shape

```ts
const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [changingPath, setChangingPath] = useState(false);
// Picker-specific state (only active when picker is shown):
const [paths, setPaths] = useState<CareerPath[]>([]);
const [selectedPath, setSelectedPath] = useState<CareerPath | null>(null);
const [level, setLevel] = useState('Level 200');
const [skills, setSkills] = useState<string[]>([]);
const [isGenerating, setIsGenerating] = useState(false);
const [generateError, setGenerateError] = useState<string | null>(null);
```
