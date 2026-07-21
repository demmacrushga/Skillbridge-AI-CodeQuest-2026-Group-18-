# Research: Mock Interview Service

**Feature**: `008-mock-interview-service`
**Date**: 2026-07-08 (amended 2026-07-09 — added Decision 7)

---

## Decision 1 — Interview flow: one-by-one vs all-at-once

**Decision**: Questions are presented one at a time. The student submits each answer individually via `POST /mock-interview/sessions/{sessionId}/questions/{questionId}/answer`. Claude evaluates each answer immediately and returns `score` (0–10) and `feedback` before the student sees the next question.

**Rationale**: Simulates a real interview — the interviewer responds after each answer, not at the end. Per-answer feedback gives the student a feedback loop mid-session that keeps them engaged and aware of their performance trajectory. The all-at-once alternative delivers all feedback only after every question is answered, collapsing the interview into a form with no momentum.

**Alternatives considered**: All-at-once (collect all answers, submit once, one Claude call for all scores) — simpler backend but poor UX; degrades the interview to a form-filling exercise. Rejected.

---

## Decision 2 — Session completion: explicit `/complete` call vs auto-complete on last answer

**Decision**: Session completion is a deliberate, separate `POST /mock-interview/sessions/{sessionId}/complete` endpoint. Never triggered automatically when the last answer is submitted.

**Rationale**: Submitting the last answer takes ~5–7 s for Claude to evaluate it. Auto-completing on that same request would chain a second Claude call (for the overall summary), compounding total latency to 10–14 s in a single HTTP interaction. Splitting into two interactions keeps each step snappy. It also gives the student a deliberate "Complete Interview" action, matching the psychological close of a real interview.

**Alternatives considered**: Auto-complete triggered on the N-th answer — saves one round-trip but compounds Claude latency at the most emotionally significant moment of the session. Rejected.

---

## Decision 3 — Question count: Claude decides (3–7) vs fixed count

**Decision**: Claude decides how many questions to generate (3–7), guided by the `MOCK_INTERVIEW_QUESTIONS_V1` prompt. No floor or ceiling enforced server-side; whatever Claude returns is persisted.

**Rationale**: Matches the skill-gap-service pattern (Claude decides 3–7 gaps). Role complexity varies significantly — "Frontend Developer" does not need the same breadth as "Senior ML Engineer". A fixed count produces uniform sessions regardless of role depth, which is inaccurate.

**Alternatives considered**: Fixed count of 5 — deterministic and trivially checkable ("all answered" guard becomes `count == 5`), but over-questions junior candidates and under-covers senior roles. Rejected.

---

## Decision 4 — Prompt structure: three named constants vs one combined prompt

**Decision**: Three separate named prompt constants:
- `MOCK_INTERVIEW_QUESTIONS_V1` — generates question set for `targetRole` + `difficulty`; expects JSON array of `{ questionText, category, orderIndex }`.
- `MOCK_INTERVIEW_ANSWER_V1` — evaluates one answer in context; expects JSON object `{ "score": 0–10, "feedback": "..." }`.
- `MOCK_INTERVIEW_SUMMARY_V1` — generates overall session summary; expects JSON object `{ "overallScore": 0–100, "overallFeedback": "..." }`.

**Rationale**: Constitution III requires named prompt constants — no inline strings. Separate prompts are independently versioned and testable. Tuning answer evaluation does not risk regressing question generation.

**Alternatives considered**: One combined prompt with a `mode` discriminator — collapses three distinct AI tasks into one opaque string, violates prompt integrity principle, harder to tune independently. Rejected.

---

## Decision 5 — Session ownership enforcement: 404 vs 403

**Decision**: When a session belongs to a different user, return `404 Not Found`. No `403 Forbidden` for ownership failure.

**Rationale**: Consistent with the platform-wide pattern. `findByIdAndUserId` returns empty → `SessionNotFoundException` → 404. Returning 403 reveals that a resource with that ID exists, leaking existence to an unauthorized caller. 404 treats ownership as part of existence from the caller's perspective.

**Alternatives considered**: Return 403 — semantically clearer but leaks session existence. Rejected; consistent with skill-gap-service and portfolio-service.

---

## Decision 6 — Frontend state management: router params + API fetch vs in-memory bridge

**Decision**: Pass `sessionId` (and `questionId` where needed) as Expo Router params between screens. Each screen fetches its own data from the API on mount.

**Rationale**: The in-memory module state pattern (`extraction-state.ts` in portfolio) does not survive app backgrounding — if the OS suspends the app mid-interview, the module-level state is cleared. Interview session data is fully persisted server-side, so re-fetching on screen mount is cheap, reliable, and always consistent with the database truth.

**Alternatives considered**: In-memory state bridge — fragile across navigation stack pops/pushes and app lifecycle suspend/resume. Rejected.

---

## Decision 7 — Voice answers: transcription approach (added 2026-07-09)

**Decision**: Add a self-hosted faster-whisper service running as a sibling `whisper-service` docker container (CPU, `small` model). The mock-interview-service exposes a new `POST /mock-interview/sessions/{sessionId}/questions/{questionId}/transcribe` multipart endpoint that forwards audio in-memory to Whisper and returns `{ "transcript": string }`. The transcript populates the existing answer `TextInput` so the user can edit it before submitting through the unchanged `/answer` endpoint that drives Claude evaluation. Audio is never persisted (no disk, no DB column, no logs).

**Rationale**: Of the three candidate approaches, on-device STT (`@react-native-voice/voice`) would have forced the whole app off Expo Go onto `expo-dev-client` + prebuild/EAS — a large dev-workflow change for one feature. Third-party STT (OpenAI Whisper API / Deepgram) would have introduced a new paid external AI vendor and `OPENAI_API_KEY` secret, weakening Constitution I (microservice autonomy) for an educational app whose users have varied accents and where the value is voice quality. Self-hosted faster-whisper keeps Expo Go (audio recording works in Expo Go via `expo-av`), keeps Claude as the sole *reasoning* engine, and requires no new external API key — the same brain still grades every answer. The `small` model is the accuracy/CPU-time sweet spot for the AmaliTech student-base (mixed accents, technical vocabulary like "kubernetes", "JOIN"); CPU is fine because answers are sequential (one user, one question at a time) and the 20s answer budget is unaffected (transcription and Claude eval are separate HTTP calls). Discarding audio after transcription is privacy-positive and avoids adding a blob column or storage lifecycle management to the schema.

The two-step flow (transcribe → edit → submit) rather than one-shot was chosen deliberately: mis-transcriptions of technical terms must be correctable *before* the user is graded. Voice is an augmentation of US2 that funnels back into US2's existing endpoint — typed and spoken answers hit exactly the same Claude evaluation path.

**Alternatives considered**:

1. **On-device STT (`@react-native-voice/voice`)** — free, near-instant, no new service. Rejected: native module forces `expo-dev-client` + prebuild, reforming the dev workflow for the whole app. OS recognizers (Apple Speech / Google) vary materially across accents, especially for technical vocabulary — the property that matters most for mock-interview users.

2. **Third-party STT (OpenAI Whisper API)** — best quality, trivial to set up, $0.006/min. Rejected: adds a second paid external AI vendor + secret (`OPENAI_API_KEY`), aggravating Constitution I. Self-hosted Whisper matches quality at our scale without the vendor coupling or ongoing cost.

3. **Persist audio on the question** — `audioPath` column + playback in the report screen. Rejected for v1: adds storage/I/O management (cleanup on session delete = extra cascade work), grows DB, and the two-step flow already lets the user fix mistakes so playback adds little to no value on top of the corrected transcript.

4. **One-shot audio → score** — simpler UX (one round-trip) and one backend call. Rejected: a mis-transcribed term like "kubernetes" → "cooper netty's" would silently drive a Claude score against the wrong word; the user must see and correct the transcript before being graded.

**Constitution framing**: faster-whisper is a *speech-to-text utility* (audio processing), not "AI Inference" in the sense the Technology Constraints table reserves for Anthropic Claude as the reasoning engine. The `WhisperTranscriptionService` is disciplined exactly like `ClaudeInterviewService`: a named config analogue (`WHISPER_TRANSCRIBE_V1`), JSON-safety guard, 503 fallback, and INFO-level latency logging. No constitution amendment is required; if a future feature wants to use a *reasoning* model other than Claude, that would trigger the amendment path.

**Edge cases resolved post-MECE review**:

- **Silent recording**: Whisper returns the empty string → `/transcribe` rejects with `422 { "error": "No speech detected" }` (FR-016). The client surfaces "No speech was detected — please try again" and keeps the recorder usable. This prevents empty text from bouncing off `/answer` 400.
- **Mic permission denied at runtime**: the recorder UI is hidden; the typed answer `TextInput` remains the only path (FR-017). Voice is strictly optional — no crash, no blocked screen.
- **First-run misconfiguration**: optional `WHISPER_STARTUP_PROBE=true` makes the service WARN-log (without blocking startup) if `WHISPER_URL` is unreachable on boot, so a typo shows up before the first student records audio. Typed-answer path is unaffected.
- **Image reproducibility**: the `whisper-service` docker-compose entry pins to a digest (not `:latest`) so a breaking upstream change can't silently break local dev.
- **Frontend length cap**: `useInterviewRecorder` stops recording at ~5 min / ~24 MB on the device, below the 25 MB server limit, so the user gets feedback on the client before an upload-time 400.
