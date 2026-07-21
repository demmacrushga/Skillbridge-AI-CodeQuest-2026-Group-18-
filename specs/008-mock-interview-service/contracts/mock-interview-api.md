# API Contract: Mock Interview Service

**Base URL** (via nginx gateway): `http://localhost:8080`
**Controller base path**: `/mock-interview`
**Auth**: Bearer JWT on all endpoints except `/health`.

> **Voice amendment**: All endpoints accept JSON except `POST .../transcribe`, which accepts `multipart/form-data` (audio file). Error shape is identical across both.

**Uniform error shape** (Constitution II):
```json
{ "error": "string", "status": 400 }
```

---

## GET /mock-interview/health

Public. No auth.

**200**
```json
{ "status": "UP" }
```

---

## POST /mock-interview/sessions

Start a session. Claude generates 3–7 questions.

**Request**
```json
{ "targetRole": "Backend Developer", "difficulty": "ENTRY" }
```
- `targetRole` — required, non-blank, max 200 chars
- `difficulty` — required, one of `ENTRY` | `MID` | `SENIOR`

**201**
```json
{
  "id": "uuid",
  "targetRole": "Backend Developer",
  "difficulty": "ENTRY",
  "status": "IN_PROGRESS",
  "overallScore": null,
  "overallFeedback": null,
  "createdAt": "2026-07-08T10:00:00Z",
  "completedAt": null,
  "questions": [
    {
      "id": "uuid",
      "questionText": "Explain the difference between REST and GraphQL.",
      "category": "TECHNICAL",
      "orderIndex": 1,
      "userAnswer": null,
      "score": null,
      "feedback": null,
      "answeredAt": null
    }
  ]
}
```

**Errors**: 400 (blank role / invalid or wrong-case difficulty), 401, 503 (Claude unavailable **or returned zero questions**)

---

## GET /mock-interview/sessions

List the caller's sessions, newest first. No `questions` array in the summary.

**200**
```json
[
  {
    "id": "uuid",
    "targetRole": "Backend Developer",
    "difficulty": "ENTRY",
    "status": "COMPLETED",
    "overallScore": 72,
    "createdAt": "2026-07-08T10:00:00Z"
  }
]
```
Empty array `[]` when the caller has no sessions (no distinction between never-created and all-deleted in v1).

**Errors**: 401

---

## GET /mock-interview/sessions/{sessionId}

Full session including all questions, answers, scores, feedback (same shape as POST /sessions response).

**Resuming**: This is the resume mechanism for an interrupted interview. The client resumes at the question with the lowest `orderIndex` whose `userAnswer` is `null`. If none, all questions are answered and the client should offer `/complete`.

**Errors**: 401, 404 (not found or not owned by caller)

---

## POST /mock-interview/sessions/{sessionId}/questions/{questionId}/answer

Submit an answer. Claude evaluates it.

**Request**
```json
{ "answer": "I would use REST for simple CRUD operations because..." }
```
- `answer` — required, non-blank, max 5000 chars

**200**
```json
{
  "id": "uuid",
  "questionText": "Explain the difference between REST and GraphQL.",
  "category": "TECHNICAL",
  "orderIndex": 1,
  "userAnswer": "I would use REST for simple CRUD operations because...",
  "score": 7,
  "feedback": "Good grasp of REST fundamentals. Missing: GraphQL's type system and query flexibility.",
  "answeredAt": "2026-07-08T10:05:00Z"
}
```

**Errors**: 400 (blank answer), 401, 404 (session/question not found or not owned), 409 (question already answered, or session already completed), 503 (Claude unavailable)

---

## POST /mock-interview/sessions/{sessionId}/questions/{questionId}/transcribe

Transcribe a spoken answer. Audio is forwarded in-memory to a self-hosted faster-whisper service; the transcript text is returned to the client. **No audio is persisted** — the client must then submit the (possibly edited) transcript text via the existing `POST .../answer` endpoint to drive Claude evaluation.

This is a non-reasoning speech-to-text utility endpoint added by the voice amendment (FR-014/015). It reuses the ownership and immutability guards of `/answer` so a voice user cannot bypass them.

**Request** — `multipart/form-data`:
- Part `audio` (required): binary audio, `audio/mpeg` | `audio/m4a` | `audio/wav`, max 25 MB.

**200**
```json
{ "transcript": "I would use REST for simple CRUD operations because..." }
```
`transcript` is non-empty. The client populates the same `TextInput` used for typed answers so the user can edit any mis-transcribed words (e.g. technical terms) before tapping **Submit Answer**.

**Errors**: 400 (missing part / oversize / wrong mimetype), 401, 404 (session/question not found or not owned), 409 (question already answered, or session already completed), 422 (no speech detected — `{"error":"No speech detected","status":422}` when Whisper returns empty/whitespace-only), 503 (Whisper unavailable — `{"error":"AI service unavailable, try again later","status":503}`)

---

## POST /mock-interview/sessions/{sessionId}/complete

Complete the session. Claude generates the overall score and summary. No request body.

**200**
```json
{
  "id": "uuid",
  "targetRole": "Backend Developer",
  "difficulty": "ENTRY",
  "status": "COMPLETED",
  "overallScore": 68,
  "overallFeedback": "You demonstrated solid REST understanding... Focus on system design for your next practice.",
  "createdAt": "2026-07-08T10:00:00Z",
  "completedAt": "2026-07-08T10:20:00Z",
  "questions": [ /* full list with scores + feedback */ ]
}
```

**Errors**: 401, 404, 409 (already completed), 422 (not all questions answered), 503 (Claude unavailable)

---

## DELETE /mock-interview/sessions/{sessionId}

Delete a session; questions cascade-delete.

**204** — no body

**Errors**: 401, 404 (not found or not owned)
