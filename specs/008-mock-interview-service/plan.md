# Implementation Plan: Mock Interview Service

**Branch**: `feat/mock-interview-voice-answers` | **Date**: 2026-07-08 (amended 2026-07-09) | **Spec**: `specs/008-mock-interview-service/spec.md`

**Input**: Feature specification from `/specs/008-mock-interview-service/spec.md`

## Summary

Add a new `mock-interview-service` microservice (Spring Boot, Java 21, port 8005) plus its Expo/React Native frontend. A student picks a target role and difficulty; Claude generates 3–7 questions. The student answers one at a time and Claude scores each answer (0–10) with feedback. On completion Claude produces an overall score (0–100) and summary. Three named Claude prompts, two JPA entities in an isolated `mock_interview` schema, **eight** REST endpoints — the original seven plus `POST /transcribe` for voice answers. Frontend adds one tab and two detail screens, promotes "Mock Interviews" out of the home-screen Coming Soon list, and adds an optional mic recorder in the answer section backed by a self-hosted faster-whisper service.

## Technical Context

| | |
|---|---|
| **Language/Version** | Java 21 (backend), TypeScript (frontend) |
| **Primary Dependencies** | Spring Boot 3.3.6 (web, security, data-jpa, validation), Flyway, JJWT 0.12.5, springdoc 2.5.0; Expo SDK 54, Expo Router v3, `expo-av` (audio recorder) |
| **Storage** | PostgreSQL 16, isolated schema `mock_interview` (voice path adds none — audio is held in-memory only) |
| **Testing** | JUnit 5 + `@WebMvcTest` controller slices (incl. multipart `/transcribe`) + service unit tests; JaCoCo ≥ 70% |
| **Target Platform** | Docker container (backend) + sibling `whisper-service` container; iOS/Android via Expo (frontend) |
| **Project Type** | Mobile + API microservice |
| **AI** | Reasoning: Anthropic Claude (`claude-sonnet-4-6`), 3 named prompts, max-tokens 2048. Transcription: self-hosted faster-whisper (`small` model, CPU) — a non-reasoning STT utility, not added to the Claude "AI Inference" row of the Constitution (see gate below). |
| **Port** | 8005 (service); 9006 → 9000 (whisper-service container); nginx prefix `/mock-interview/` (no nginx change — `/transcribe` rides existing location with 180s timeout) |
| **Performance** | Session start ≤ 30s, answer eval ≤ 20s, complete ≤ 30s (Claude-bound); `/transcribe` target ≤ 30s end-to-end on CPU Whisper (best-effort — not enforced in v1) |

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I. Microservice Autonomy | PASS | Own `mock_interview` schema; `user_id` stored as plain UUID, no cross-schema FK. Whisper runs as a sibling `whisper-service` container (no shared DB; mock-interview-service talks to it over HTTP per documented contract). No third-party AI API key introduced. |
| II. Mobile-First API Contract | PASS | Uniform `{error,status}` error shape; JWT on all non-public endpoints; contract in `contracts/mock-interview-api.md` (extends with `POST /transcribe` multipart). The audio endpoint reuses the same ownership rules as `/answer` (404 / 409 / 503) and adds 422 for silent recordings (FR-016). |
| III. AI Prompt Integrity | PASS | 3 named prompt constants (`MOCK_INTERVIEW_QUESTIONS_V1`, `_ANSWER_V1`, `_SUMMARY_V1`); response shape validated with JSON-safety guard; 503 fallback; prompt name + latency logged at INFO. **Whisper is not a reasoning/inference call** — it is a speech-to-text utility service. The `WhisperTranscriptionService` mirrors Claude's discipline: named config constant `WHISPER_TRANSCRIBE_V1` analogue, JSON-safety guard on the response, 503 fallback, and prompt-name + latency logged at INFO. Claude remains the sole reasoning engine — no Whisper output is surfaced to the user without going through the same `/answer` → Claude evaluation path. **No constitution amendment required**: the Technology Constraints table's "AI Inference | Anthropic Claude API" row scopes the *reasoning* layer; faster-whisper is a transcription utility layer analogous to how nginx provides reverse-proxy utility. |
| IV. Test Coverage | PASS | Controller-slice (incl. multipart `/transcribe` with `MockMultipartFile`) + service unit tests; JaCoCo ≥ 70% enforced (config/security/Application excluded). |
| V. Observability & Security | PASS | `CorrelationIdFilter` copied; `/mock-interview/health` public; structured logs; no PII logged. Audio is held in-memory only for the duration of the Whisper call — never persisted to disk/DB/logs. Mic permission strings added to `app.json` for iOS/Android. |

**Gate evaluation**: No violations. The voice amendment introduces a non-reasoning transcription utility adjacent to (not replacing) Claude's reasoning layer; framed and disciplined accordingly. Complexity Tracking table below.

## Project Structure

### Documentation (this feature)
```text
specs/008-mock-interview-service/
├── plan.md              # This file
├── research.md          # 7 design decisions (incl. Decision 7 — voice STT)
├── data-model.md        # entities, migrations, DTOs (incl. TranscribeResponse)
├── quickstart.md        # end-to-end validation guide (incl. voice path)
├── contracts/
│   └── mock-interview-api.md   # + POST /transcribe
└── tasks.md             # generated by /speckit-tasks (not this command)
```

### Source Code
```text
backend/mock-interview-service/          # NEW — mirrors skill-gap-service
├── Dockerfile                           # two-stage Maven + JRE 21, EXPOSE 8005
├── pom.xml                              # skill-gap deps minus pdfbox/poi-ooxml
└── src/main/java/com/skillbridge/mockinterview/
    ├── MockInterviewServiceApplication.java
    ├── config/          # SecurityConfig, RestTemplateConfig, CorrelationIdFilter, StartupLogger
    ├── controller/      # MockInterviewController
    ├── dto/request/     # StartSessionRequest, SubmitAnswerRequest
    ├── dto/response/    # SessionResponse, SessionSummaryResponse, QuestionResponse
    │                    #   + TranscribeResponse (NEW — voice amendment)
    ├── entity/          # InterviewSession, InterviewQuestion (UNCHANGED — no audio column)
    ├── exception/       # AiServiceException (reused for Whisper failures), SessionNotFoundException,
    │                    #   SessionAlreadyCompletedException, SessionIncompleteException,
    │                    #   QuestionAlreadyAnsweredException, GlobalExceptionHandler
    ├── repository/      # InterviewSessionRepository, InterviewQuestionRepository
    ├── security/        # JwtAuthFilter, JwtService, JwtUserDetails  (copied)
    └── service/
        ├── ClaudeInterviewService.java        # 3 prompt methods + InterviewPrompts constants (UNCHANGED)
        ├── WhisperTranscriptionService.java   # NEW — voice amendment
        ├── WhisperTranscriptionServiceImpl.java # NEW — HTTP multipart to faster-whisper; JSON-safety guard; 503 fallback; INFO log "WHISPER_TRANSCRIBE_V1" + latency
        ├── MockInterviewService.java          # interface
        ├── MockInterviewServiceImpl.java
        └── dto/         # QuestionTemplate, AnswerEvaluationTemplate, SessionSummaryTemplate
    └── src/main/resources/
        ├── application.yml                    # schema=mock_interview, port 8005, max-tokens 2048
        │                                      #   + WHISPER_URL(http://whisper-service:9000), WHISPER_TIMEOUT_MS(60000),
        │                                      #   + spring.servlet.multipart.max-file-size=25MB, max-request-size=25MB
        └── db/migration/{V1,V2,V3}__*.sql     # UNCHANGED — no schema change for voice

frontend/
├── types/mockInterview.ts                     # NEW
├── services/mockInterview.ts                  # NEW — mirrors services/skillGap.ts (+ transcribeAnswer multipart helper)
├── hooks/useInterviewRecorder.ts              # NEW — voice amendment: expo-av recorder wrapper
├──                                             #   (5 min / 24 MB client-side cap; degrades to typed on mic-permission denial — FR-017)
├── app/(app)/mock-interview.tsx               # NEW — history + start flow (visible tab)
├── app/(app)/mock-interview-session.tsx       # NEW — one-question-at-a-time (hidden)
├──                                             #   + MODIFY (voice amendment) — add mic recorder UI under the answer TextInput
├── app/(app)/mock-interview-report/[sessionId].tsx  # NEW — results (hidden)
├── app/(app)/_layout.tsx                      # MODIFY — add tab + 2 hidden screens
├── app/(app)/index.tsx                        # MODIFY — Interview quick link, drop Coming Soon card
├── app.json                                   # MODIFY (voice amendment) — expo-av plugin entry + NSMicrophoneUsageDescription (iOS) + RECORD_AUDIO (Android)

# Infrastructure
docker-compose.yml                             # MODIFY — add mock-interview-service block, port 8005
│                                              #   + WHISPER_URL=http://whisper-service:9000 on mock-interview-service
│                                              #   + WHISPER_STARTUP_PROBE=true (WARN-log if unreachable without blocking startup)
│                                              #   + whisper-service block (image ahmadmughees/whisper-asr-webservice pinned to a
│                                              #       specific digest — not :latest — for reproducible local dev)
│                                              #       ports 9006:9000, env ASR_MODEL=small, ASR_ENGINE=faster_whisper
nginx/nginx.conf                               # MODIFY — upstream + /mock-interview/ location (180s timeouts — no nginx change for /transcribe)
.github/workflows/ci.yml                       # MODIFY — add matrix entry (whisper-service NOT in CI — backend tests mock the service)
```

**Structure Decision**: Mobile + API. Backend is a standalone Spring Boot service copying the skill-gap-service structure exactly (proven pattern, solo-builder simplicity per constitution). Frontend follows the established Expo Router file-based pattern with `sessionId` passed via router params (research Decision 6). Voice amendment adds a sibling `whisper-service` container (self-hosted faster-whisper, CPU, `small` model) and a non-reasoning `WhisperTranscriptionService` — chosen to keep Expo Go working (no native module) and to keep Claude as the sole reasoning engine (research Decision 7).

## Key Reuse

- **Backend scaffolding** copied verbatim from `backend/skill-gap-service/`: `CorrelationIdFilter`, `SecurityConfig`, `RestTemplateConfig`, `JwtAuthFilter`, `JwtService`, `JwtUserDetails`, `GlobalExceptionHandler` shape, `StartupLogger`.
- **Claude call pattern** from `skill-gap-service/.../service/ClaudeService.java` — including the JSON-safety guard (find first `[`/`{` before parsing) already hardened in that file. **`WhisperTranscriptionService` reuses the same guard + 503 fallback pattern.**
- **`AiServiceException` is reused** in the voice path to 503-wrap whisper failures — keeps the error shape consistent on the frontend (one error type for "external AI service down").
- **Frontend service** mirrors `frontend/services/skillGap.ts` (`request<T>()` helper, Bearer token, `{status,message}` throw). Voice amendment adds `transcribeAnswer()` using `FormData` + `fetch` (multipart) — same auth headers, same error throwing.
- **Frontend screen** mirrors `frontend/app/(app)/skill-gap.tsx` (`useFocusEffect` fetch, `usePulse` AI loading animation, optimistic delete). Voice amendment keeps the existing `TextInput` and `Submit Answer` button unchanged — the recorder only populates the text box state; the existing submit flow is reused unchanged.
- **Design tokens** from `frontend/constants/theme.ts`.

## Complexity Tracking

| Added complexity | Why justified |
|---|---|
| Sibling `whisper-service` container in docker-compose | Self-hosted STT kept to preserve Constitution I (microservice autonomy — no third-party key, no external API) while staying on Expo Go (no native module). Single container, no DB, restartable. Image pinned to a digest (not `:latest`) for reproducible local dev. |
| New `WhisperTranscriptionService` | Mirrors the disciplined Claude wrapper (named config analogue, JSON-safety guard, 503 fallback, INFO-log latency). Reuses `AiServiceException`. Localized to one package; the rest of the service is untouched. Returns 422 on empty transcript (FR-016) so silent recordings are surfaced cleanly instead of bouncing off `/answer` 400. |
| `expo-av` dep + app.json permissions | Required for any in-Expo-Go audio recording. Adds one plugin entry + two permission strings; isolated to the session screen via `useInterviewRecorder` hook. Recorder caps at 5 min / ~24 MB on the device, stops before the 25 MB server limit. Mic-permission denial hides the recorder and leaves typed answers as the only path (FR-017) — no crash. |
| New multipart `/transcribe` endpoint | One new controller method + 5 error branches shared with `/answer` (404/409/503 + 400-oversize + 422-empty). No schema migration; no new entity. |
| Optional `WHISPER_STARTUP_PROBE` log | WARN-logs (without blocking startup) if `WHISPER_URL` is unreachable on boot, so a misconfigured URL surfaces before the first student records audio. Typed-answer path is unaffected. |

No Constitution Check violations beyond the table above.
