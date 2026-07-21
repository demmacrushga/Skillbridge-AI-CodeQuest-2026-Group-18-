# Quickstart: Mentorship Service Validation

End-to-end validation guide for `mentorship-service`. Contract details:
[`contracts/mentorship-api.md`](contracts/mentorship-api.md); entities:
[`data-model.md`](data-model.md).

## Prerequisites

- Docker + Docker Compose, `.env` populated (`POSTGRES_*`, `JWT_SECRET`)
- Two test accounts via auth-service: one `STUDENT`, one `ALUMNI`
  (register/login through `/auth/*` to obtain two access tokens)

```bash
docker-compose up --build -d postgres auth-service mentorship-service gateway
export STUDENT_TOKEN=...   # login as the STUDENT
export ALUMNI_TOKEN=...    # login as the ALUMNI
BASE=http://localhost:8080
```

## §1 Health & startup

```bash
curl -s $BASE/mentorship/health
# → {"status":"UP"}
docker logs skillbridge-mentorship | grep "Mentorship Service is running"
# Flyway: V1..V5 applied, no migration errors (SC-005)
```

## §2 Alumni profile (US1)

```bash
# Create
curl -s -X PUT $BASE/mentorship/profile -H "Authorization: Bearer $ALUMNI_TOKEN" \
  -H 'Content-Type: application/json' -d '{
    "currentRole":"Senior Backend Engineer","company":"Hubtel","industry":"Fintech",
    "careerInterests":["backend engineering","fintech","  FINTECH  "],
    "bio":"Class of 2019.","available":true}'
# → 200; careerInterests deduped case-insensitively to 2 tags, first casing kept

# Read back
curl -s $BASE/mentorship/profile -H "Authorization: Bearer $ALUMNI_TOKEN"       # → 200
# Role guard
curl -s -X PUT $BASE/mentorship/profile -H "Authorization: Bearer $STUDENT_TOKEN" -d '{}'  # → 403
# Validation
#   empty careerInterests → 400 with fieldErrors
```

## §3 Search & ranking hand-check (US2, SC-007)

Create a second alumni profile with tags `["fintech"]` only (different ALUMNI account, or
temporarily re-PUT). Then:

```bash
curl -s "$BASE/mentorship/alumni?interest=fintech&interest=backend%20engineering" \
  -H "Authorization: Bearer $STUDENT_TOKEN"
# Hand-check: profile with 2 matching tags ranks above the 1-tag profile;
# equal counts order by updatedAt DESC.
# No filters → all available profiles. Set "available":false on one → it disappears.
# RECRUITER token (if available) → 403.
```

## §4 Request lifecycle (US3 + US4)

```bash
# Send (studentId from JWT, alumniId from search result)
curl -s -X POST $BASE/mentorship/requests -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H 'Content-Type: application/json' -d '{"alumniId":"<ALUMNI_USER_ID>","message":"Hi!"}'
# → 201 status PENDING

# Duplicate while pending → 409
# Unknown/unavailable alumniId → 404

# Student cancels the pending request → PENDING deadlock escape hatch
curl -s -X POST $BASE/mentorship/requests/<REQ_ID>/cancel -H "Authorization: Bearer $STUDENT_TOKEN"
# → 200 CANCELLED; cancel again → 409; re-send to same alumnus → 201 (new PENDING)

# Alumni inbox
curl -s $BASE/mentorship/requests/incoming -H "Authorization: Bearer $ALUMNI_TOKEN"
# → 200, contains the pending request

# Decline path first (repeat send afterwards to verify FR-007 re-request):
curl -s -X POST $BASE/mentorship/requests/<REQ_ID>/decline -H "Authorization: Bearer $ALUMNI_TOKEN"
# → 200 DECLINED; decline again → 409; student re-sends → 201 (new PENDING)

# Accept the new request:
curl -s -X POST $BASE/mentorship/requests/<REQ_ID2>/accept -H "Authorization: Bearer $ALUMNI_TOKEN"
# → 200 PairResponse status ACTIVE
# Accept again → 409. Accept with a different alumni's token → 404 (no ownership leakage).

# Student's view
curl -s $BASE/mentorship/requests/mine -H "Authorization: Bearer $STUDENT_TOKEN"
# → both requests, newest first, statuses DECLINED + ACCEPTED
```

## §5 Messaging & read receipts (US5)

```bash
PAIR=<PAIR_ID>   # from the accept response or GET /mentorship/pairs/mine

# Student sends
curl -s -X POST $BASE/mentorship/pairs/$PAIR/messages \
  -H "Authorization: Bearer $STUDENT_TOKEN" -H 'Content-Type: application/json' \
  -d '{"body":"Thanks for accepting!"}'
# → 201, readAt null

# Alumni reads the thread → message now has readAt stamped
curl -s $BASE/mentorship/pairs/$PAIR/messages -H "Authorization: Bearer $ALUMNI_TOKEN"
# Re-fetch as student: readAt visible and stable (set once)

# Guards: blank body → 400; non-participant token → 404
```

## §6 Ending a pair (US6)

```bash
curl -s -X POST $BASE/mentorship/pairs/$PAIR/end -H "Authorization: Bearer $STUDENT_TOKEN"
# → 200 ENDED + endedAt
# End again → 200 unchanged (idempotent)
# New message on ended pair → 409; GET thread still → 200 (history preserved)
curl -s $BASE/mentorship/pairs/mine -H "Authorization: Bearer $ALUMNI_TOKEN"
# → pair listed with status ENDED
```

## §7 Backend test suite

```bash
cd backend/mentorship-service && ./mvnw verify
# All controller-slice + service unit tests green; JaCoCo ≥ 70% (SC-003/SC-004)
```

## §8 Mobile QA (SC-006)

1. Log in as STUDENT → home shows "Mentorship" QuickLink → opens `mentorship` screen.
2. Search by an interest tag → results ranked as in §3 → send a request with a note.
3. Log in as ALUMNI → QuickLink routes to `mentorship-manage` → edit profile, toggle
   availability → incoming request visible → accept.
4. Both sides: pair appears under "My mentorships"; exchange messages both directions;
   unread indicator clears after opening the thread.
5. Either side ends the mentorship → composer disabled with an "ended" notice, history
   still readable; ended pair remains in the list.
6. Full journey (search → request → accept → message → end) completes without leaving
   the app — SC-006 satisfied.
