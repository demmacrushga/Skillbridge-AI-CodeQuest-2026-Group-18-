# Quickstart: Notification Producers

## Prerequisites

- `notification-service` (012) is running and reachable at `http://notification-service:8009` inside Docker or `http://localhost:8009` locally.
- `INTERNAL_SERVICE_TOKEN` is set identically for all services.
- (Optional) Docker running the full stack. If Docker is unavailable, use local service startup and port `8009`.

## Validate Each Producer

### 1. challenge-service — CHALLENGE_SCORED

1. Post a challenge as a recruiter.
2. Submit a solution as a student.
3. As the recruiter, score the submission:
   ```
   POST /challenge/{challengeId}/submissions/{submissionId}/score
   ```
4. As the student, fetch inbox:
   ```
   GET /notification
   ```
   Expected: one `CHALLENGE_SCORED` entry with challenge title and score.
5. Stop `notification-service` and re-score. Expected: scoring still returns 200.

### 2. mentorship-service — MENTORSHIP_REQUEST_RECEIVED

1. Student sends a mentorship request to an alumnus.
2. Alumnus fetches inbox:
   ```
   GET /notification
   ```
   Expected: one `MENTORSHIP_REQUEST_RECEIVED` entry.

### 3. mentorship-service — MENTORSHIP_REQUEST_ACCEPTED

1. Alumnus accepts the request.
2. Student fetches inbox.
   Expected: one `MENTORSHIP_REQUEST_ACCEPTED` entry.

### 4. mentorship-service — MENTORSHIP_REQUEST_DECLINED

1. Alumnus declines a fresh request.
2. Student fetches inbox.
   Expected: one `MENTORSHIP_REQUEST_DECLINED` entry.

### 5. mentorship-service — MENTORSHIP_MESSAGE

1. Either participant sends a message in an active pair.
2. The other participant fetches inbox.
   Expected: one `MENTORSHIP_MESSAGE` entry with a preview of the message body.
3. Sender fetches inbox.
   Expected: no self-notification.

### 6. matching-service — OPPORTUNITY_MATCH

1. Create two student skill profiles, one that scores ≥ 50.00 against an opportunity and one below.
2. Recruiter posts an opportunity.
3. Both students fetch inbox.
   Expected: only the qualifying student sees `OPPORTUNITY_MATCH` with the computed percentage.

### 7. career-service — ROADMAP_MILESTONE

1. Student generates a roadmap.
2. Student completes a milestone.
3. Student fetches inbox.
   Expected: one `ROADMAP_MILESTONE` entry with the milestone title and progress percentage.

## Failure Isolation Quick Check

Stop `notification-service` and repeat any producer operation. All public endpoints must return exactly the same status and body as before, with a warning log in the producer service.

## Notes

- Notification sends are best-effort and non-blocking. No retry, no queue, no message broker in v1.
- `cancelRequest` and opportunity/challenge deactivation are deliberately silent.
- `SYSTEM` notifications are reserved for manual operator announcements; no producer emits them.
