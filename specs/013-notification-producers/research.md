# Research: Notification Producers

## Reconnaissance Findings

### Existing HTTP Client Patterns

- Most backend services (portfolio, skill-gap, career, mock-interview) use `RestTemplate` via a `RestTemplateConfig` with `SimpleClientHttpRequestFactory` timeouts.
- `notification-service` (012) uses `RestClient` (Spring 6.1 / Boot 3.3.6).
- All services run Spring Boot 3.3.6, so `RestClient` is available everywhere.

### Decision: Use RestClient for Producer NotificationClient

- **Chosen**: `RestClient` with `ClientHttpRequestFactorySettings` for 2s connect+read timeout.
- **Rationale**: Consistent with the newest service, fluent API, and avoids adding a `RestTemplateConfig` to services that don't already have one.
- **Alternative**: `RestTemplate` — already used elsewhere, but would require a new config class in challenge/mentorship/matching and is slightly more verbose.

### Service Call Sites (confirmed)

| Service | Method | Notification trigger point |
|---|---|---|
| challenge-service | `ChallengeServiceImpl.scoreSubmission()` | After `submissionRepository.save(submission)` |
| mentorship-service | `MentorshipServiceImpl.sendRequest()` | After `requestRepository.saveAndFlush(req)` |
| mentorship-service | `MentorshipServiceImpl.acceptRequest()` | After `pairRepository.save(pair)` |
| mentorship-service | `MentorshipServiceImpl.declineRequest()` | After `requestRepository.save(req)` |
| mentorship-service | `MentorshipServiceImpl.sendMessage()` | After `messageRepository.save(message)` |
| mentorship-service | `MentorshipServiceImpl.cancelRequest()` | Silent |
| matching-service | `MatchingServiceImpl.postOpportunity()` | After `opportunityRepository.save(opportunity)` |
| career-service | `CareerServiceImpl.completeMilestone()` | After `completionRepository.save(...)` and progress recompute |

### Fan-Out Data Source

- `matching-service` owns `StudentSkill` and `MatchScoringService.score(Opportunity, Set<String>)`.
- Distinct student ids are fetched from `studentSkillRepository` (no cross-service reads).
- Score threshold and cap are constants beside the call site.

### Failure Isolation Design

- No `depends_on: notification-service` in docker-compose.
- `NOTIFICATION_URL` unset → `NotificationClient` logs one INFO at startup and `notify()` is a no-op.
- Any exception during `notify()` is caught, logged as WARN, never rethrown, and never blocks the transaction.

## Open Questions

- None remaining. All call sites confirmed; all design decisions resolved.
