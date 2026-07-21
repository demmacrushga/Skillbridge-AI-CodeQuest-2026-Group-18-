# Quickstart: Unified Career Screen

## Prerequisites

```bash
cd frontend && npx expo start
```

Backend running at localhost (or Expo Go with API_BASE_URL configured).

---

## Scenario 1 — New student (no roadmap)

1. Log in as a user who has not generated a roadmap.
2. Tap the **Career** tab.
3. **Expected**: Full career path picker renders — path grid, level selector (defaults to Level 200), skills input, disabled "Generate My Roadmap" button.
4. Select a career path card. **Expected**: Card highlights; generate button becomes active.
5. Tap "Generate My Roadmap". **Expected**: `GeneratingOverlay` appears (dark background, animated rings, step text).
6. Wait for generation (~30–60s). **Expected**: Roadmap view renders in-place; progress %, semester groups, Up Next card visible.
7. Switch to another tab and back. **Expected**: Career tab shows roadmap directly — picker does NOT flash.

---

## Scenario 2 — Returning student (has roadmap)

1. Log in as a user who already has a roadmap.
2. Tap the **Career** tab.
3. **Expected**: Roadmap renders immediately — NO picker shown, NO flash.
4. **Expected**: "Change Path" button visible in the roadmap header.

---

## Scenario 3 — Complete a milestone

1. (From Scenario 2) Find the "Up Next" card.
2. Type an evidence note and tap "Mark Complete".
3. **Expected**: Milestone moves to the completed row; progress % increases.

---

## Scenario 4 — Change career path

1. (From Scenario 2) Tap "Change Path" in the header.
2. **Expected**: Confirmation dialog: "Change Career Path — Your current roadmap will be replaced when you generate a new one." with Cancel and "Change Path" buttons.
3. Tap "Cancel". **Expected**: Dialog dismisses; roadmap remains visible.
4. Tap "Change Path" again → tap "Change Path" in dialog.
5. **Expected**: Screen transitions to the picker in-place (same tab, no navigation animation to a different screen).
6. Select a different career path and generate. **Expected**: New roadmap renders.

---

## Scenario 5 — Tab bar check

1. Observe the bottom tab bar.
2. **Expected**: Exactly 5 tabs — Home, Skills, Career, Portfolio, Profile.
3. No "Careers" or "Roadmap" tabs.

---

## Scenario 6 — Dashboard links

1. Go to the Home tab.
2. Tap "Roadmap" in the Quick Access grid. **Expected**: Navigates to the Career tab (unified screen).
3. Tap "Career Paths" in the Quick Access grid. **Expected**: Same Career tab.
4. If no roadmap: tap "Build your roadmap" card. **Expected**: Career tab with picker.

---

## TypeScript check

```bash
cd frontend && npx tsc --noEmit
```

**Expected**: 0 errors.
