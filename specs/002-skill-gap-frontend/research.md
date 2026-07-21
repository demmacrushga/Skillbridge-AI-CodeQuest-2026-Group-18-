# Research: Skill Gap Frontend Screens

**Feature**: `002-skill-gap-frontend`
**Date**: 2026-06-25

---

## 1. File Picking in Expo

**Decision**: Use `expo-document-picker` v13 (`npx expo install expo-document-picker`).

**Rationale**: Native integration with iOS Files/Android Storage Access Framework. The API returns a `DocumentPickerResult` with `uri`, `name`, `mimeType`, and `size`. This is the standard Expo approach for general document selection (not just images), which matches the PDF/DOCX requirement.

**Key API**:
```ts
import * as DocumentPicker from 'expo-document-picker';
const result = await DocumentPicker.getDocumentAsync({
  type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  copyToCacheDirectory: true, // required for fetch to read the file
});
if (result.canceled) return;
const asset = result.assets[0]; // { uri, name, mimeType, size }
```

**Alternatives considered**:
- `react-native-document-picker`: Third-party library, requires bare workflow. Rejected — project uses managed Expo SDK.
- `expo-image-picker`: Only for images/videos. Rejected — not suitable for documents.

---

## 2. Multipart/form-data Upload with fetch in Expo

**Decision**: Use the `FormData` global available in React Native with `fetch`.

**Rationale**: React Native ships a patched `FormData` that handles file URIs from `expo-document-picker`. No special library needed.

**Key pattern**:
```ts
const formData = new FormData();
formData.append('file', {
  uri: asset.uri,
  name: asset.name,
  type: asset.mimeType,
} as any); // RN extends FormData to accept this object shape
formData.append('targetRole', targetRole);

const res = await fetch(`${BASE_URL}/skill-gap/analyse`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` }, // NO Content-Type header — let fetch set multipart boundary
  body: formData,
});
```

**Important**: Do NOT set `Content-Type: multipart/form-data` manually — React Native's fetch sets the boundary automatically. Setting it manually breaks the request.

---

## 3. Stack Navigation Within a Tab (expo-router v6)

**Decision**: Use a nested Stack layout inside the Skills tab — `app/(app)/gap-report/_layout.tsx` with `<Stack>`.

**Rationale**: expo-router v6 supports nested layouts. A `gap-report/` subdirectory with its own `_layout.tsx` (Stack) allows the Gap Report detail screen to push on top of the Skills tab while keeping the tab bar hidden (via `tabBarStyle: { display: 'none' }` or `tabBarVisible: false` in screen options).

**Pattern**:
```
app/(app)/
  skill-gap.tsx          ← tab screen (index of Skills tab)
  gap-report/
    _layout.tsx          ← Stack navigator
    [reportId].tsx       ← detail screen
```

Access the detail from skill-gap.tsx: `router.push('/gap-report/${reportId}')`.

**Alternative considered**: Shared Stack wrapping the entire (app) layout. Rejected — would complicate the existing tab layout.

---

## 4. Long-running Request UX (15–30 second Claude latency)

**Decision**: Show a pulsing "Analysing your CV…" state with `Animated.loop` (same `usePulse` pattern used in `roadmap.tsx` and `index.tsx`).

**Rationale**: The existing codebase already has this pattern. Reuse it for consistency. The loading state should replace the upload form, not show a modal, to prevent accidental re-submission.

**Timeout**: Expo's default `fetch` timeout is the device's OS-level timeout (~60s on iOS, ~30s on Android). The backend sets `claude.read-timeout-ms: 120000` (2 min). This is fine for production; no custom timeout needed in the frontend for v1.

---

## 5. Opening Recommendation URLs

**Decision**: Use `expo-linking` (`Linking.openURL(url)`) which is already listed as a dependency (`expo-linking ~8.0.12`).

**Key pattern**:
```ts
import * as Linking from 'expo-linking';
if (url) await Linking.openURL(url);
```

Show the URL button as disabled/hidden if `url` is null.
