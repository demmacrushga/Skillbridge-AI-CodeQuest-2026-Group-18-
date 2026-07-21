# Data Model: Mock Interview Service

> **Voice amendment (2026-07-09)**: No schema change. The `POST /transcribe` endpoint forwards audio in-memory to Whisper and returns text; only the resulting transcript text ever lands on `InterviewQuestion.userAnswer` — and only after the user submits it via the existing `/answer` endpoint. There is NO `audio_path` column, NO new table, and NO new Flyway migration.

## Schema

PostgreSQL schema: `mock_interview` (isolated; no cross-schema access per Constitution I).

---

## Entities

### InterviewSession

```
mock_interview.interview_sessions
├── id               UUID         PK, DEFAULT gen_random_uuid()
├── user_id          UUID         NOT NULL  (from JWT — no FK to auth schema)
├── target_role      VARCHAR(200) NOT NULL
├── difficulty       VARCHAR(20)  NOT NULL  ENTRY | MID | SENIOR
├── status           VARCHAR(20)  NOT NULL  DEFAULT 'IN_PROGRESS'
├── overall_score    INTEGER      NULLABLE  0–100, set on /complete
├── overall_feedback TEXT         NULLABLE, set on /complete
├── created_at       TIMESTAMPTZ  NOT NULL  DEFAULT NOW()
└── completed_at     TIMESTAMPTZ  NULLABLE, set on /complete
```

### InterviewQuestion

```
mock_interview.interview_questions
├── id            UUID         PK, DEFAULT gen_random_uuid()
├── session_id    UUID         NOT NULL  FK → interview_sessions(id) ON DELETE CASCADE
├── question_text TEXT         NOT NULL
├── category      VARCHAR(30)  NOT NULL  TECHNICAL | BEHAVIORAL | SITUATIONAL | OTHER
├── order_index   INTEGER      NOT NULL
├── user_answer   TEXT         NULLABLE, set when student submits
├── score         INTEGER      NULLABLE  0–10, set after Claude evaluation
├── feedback      TEXT         NULLABLE, set after Claude evaluation
└── answered_at   TIMESTAMPTZ  NULLABLE
```

---

## State Transitions

### Session

```
POST /mock-interview/sessions
        │
        ▼
   IN_PROGRESS ──(all questions answered + POST /complete)──► COMPLETED
                                                               sets overallScore,
                                                               overallFeedback,
                                                               completedAt

Guard: /complete with any unanswered question → 422
Guard: /complete on COMPLETED session → 409
```

### Question

```
[created on session start — all fields null]
        │
POST .../questions/{id}/answer
        ├── userAnswer already non-null → 409 (immutable once answered)
        └── session COMPLETED → 409
                │
                ▼
        Claude evaluates → score + feedback persisted
        answered_at = NOW()
```

---

## Flyway Migrations

### V1__create_schema.sql
```sql
CREATE SCHEMA IF NOT EXISTS mock_interview;
```

### V2__create_interview_sessions.sql
```sql
CREATE TABLE mock_interview.interview_sessions (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID         NOT NULL,
    target_role      VARCHAR(200) NOT NULL,
    difficulty       VARCHAR(20)  NOT NULL,
    status           VARCHAR(20)  NOT NULL DEFAULT 'IN_PROGRESS',
    overall_score    INTEGER,
    overall_feedback TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMPTZ
);

CREATE INDEX idx_interview_sessions_user_id
    ON mock_interview.interview_sessions(user_id);
```

### V3__create_interview_questions.sql
```sql
CREATE TABLE mock_interview.interview_questions (
    id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    UUID    NOT NULL
                      REFERENCES mock_interview.interview_sessions(id) ON DELETE CASCADE,
    question_text TEXT    NOT NULL,
    category      VARCHAR(30) NOT NULL,
    order_index   INTEGER NOT NULL,
    user_answer   TEXT,
    score         INTEGER,
    feedback      TEXT,
    answered_at   TIMESTAMPTZ
);

CREATE INDEX idx_interview_questions_session_id
    ON mock_interview.interview_questions(session_id);
```

---

## JPA Entities (sketch)

### InterviewSession.java
```java
@Entity
@Table(name = "interview_sessions", schema = "mock_interview")
@Getter @Setter @NoArgsConstructor
public class InterviewSession {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(nullable = false) private UUID userId;
    @Column(nullable = false, length = 200) private String targetRole;
    @Column(nullable = false, length = 20) private String difficulty;
    @Column(nullable = false, length = 20) private String status = "IN_PROGRESS";
    @Column private Integer overallScore;
    @Column(columnDefinition = "TEXT") private String overallFeedback;
    @Column(nullable = false, updatable = false) private Instant createdAt = Instant.now();
    @Column private Instant completedAt;
    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    private List<InterviewQuestion> questions = new ArrayList<>();
}
```

### InterviewQuestion.java
```java
@Entity
@Table(name = "interview_questions", schema = "mock_interview")
@Getter @Setter @NoArgsConstructor
public class InterviewQuestion {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private InterviewSession session;
    @Column(columnDefinition = "TEXT", nullable = false) private String questionText;
    @Column(nullable = false, length = 30) private String category;
    @Column(nullable = false) private int orderIndex;
    @Column(columnDefinition = "TEXT") private String userAnswer;
    @Column private Integer score;
    @Column(columnDefinition = "TEXT") private String feedback;
    @Column private Instant answeredAt;
}
```

---

## Repositories

| Repository | Key methods |
|---|---|
| `InterviewSessionRepository` | `findByIdAndUserId(UUID, UUID)` — ownership-safe fetch |
| | `findByUserIdOrderByCreatedAtDesc(UUID)` — history list |
| `InterviewQuestionRepository` | `existsBySessionIdAndUserAnswerIsNull(UUID)` — guard for `/complete` |

---

## DTOs

### Request DTOs
| DTO | Fields | Validation |
|---|---|---|
| `StartSessionRequest` | `targetRole`, `difficulty` | `@NotBlank @Size(max=200)` on role; `@NotNull` + enum pattern on difficulty |
| `SubmitAnswerRequest` | `answer` | `@NotBlank @Size(max=5000)` |

**Voice-only**: `POST /transcribe` accepts `multipart/form-data` (part name `audio`), NOT a JSON DTO. Enforcement is at the controller via `MultipartFile` + size/mime checks (≤ 25 MB; `audio/mpeg` | `audio/m4a` | `audio/wav`), not bean validation.

### Response DTOs
| DTO | Fields | Used by |
|---|---|---|
| `SessionResponse` | id, targetRole, difficulty, status, overallScore, overallFeedback, createdAt, completedAt, `List<QuestionResponse>` | POST /sessions, GET /sessions/{id} |
| `SessionSummaryResponse` | id, targetRole, difficulty, status, overallScore, createdAt | GET /sessions list |
| `QuestionResponse` | id, questionText, category, orderIndex, userAnswer, score, feedback, answeredAt | nested in SessionResponse |
| `TranscribeResponse` (NEW — voice amendment) | `transcript: String` | POST /transcribe 200 response |

---

## Constraints Summary

| Rule | Layer |
|---|---|
| `difficulty` must be ENTRY, MID, or SENIOR | DTO |
| `targetRole` non-blank, max 200 chars | DTO |
| `answer` non-blank | DTO |
| `score` 0–10 / `overallScore` 0–100 | Service (never accepted from client) |
| Question may only be answered once | Service → 409 |
| `/complete` requires all questions answered | Service → 422 |
| `/complete` on COMPLETED session | Service → 409 |
| Answer on COMPLETED session | Service → 409 |
| `user_id` is never an FK to another schema | DB (Constitution I) |
| `/transcribe` audio ≤ 25 MB, `audio/mpeg`\|`audio/m4a`\|`audio/wav` | Controller → 400 |
| `/transcribe` on answered/completed question | Service → 409 (same guards as `/answer`) |
| `/transcribe` Whisper unavailable | Service → 503 (reuses `AiServiceException` shape) |
| `/transcribe` audio blob lifecycle | In-memory only — never persisted to disk/DB/logs (FR-014) |
| `/transcribe` empty/whitespace Whisper transcript | Service → 422 "No speech detected" (FR-016) |
| `/transcribe` mic permission denied on device | Frontend hides recorder UI; typed `TextInput` remains the only path (FR-017) |
| `/transcribe` frontend recording cap | Client-side ~5 min / ~24 MB; stops before the 25 MB server limit |
