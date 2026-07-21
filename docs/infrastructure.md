# SkillBridge AI — Infrastructure & Microservice Design

> **Status:** Design decisions documented. Not yet implemented beyond Docker Compose + auth-service.
> Revisit when moving to staging/production or when a service needs to call another service.

---

## Service Discovery

**Decision: Docker Compose DNS (local/staging) → Kubernetes (production)**

Docker Compose automatically creates an internal network where every service is reachable by its container name. No additional tooling (Eureka, Consul) is needed.

```
auth-service    → http://auth-service:8001
career-service  → http://career-service:8002
skill-gap-service → http://skill-gap-service:8003
... etc.
```

In production, Kubernetes Service objects replace Docker Compose DNS — same pattern, no code changes needed in the services themselves.

**Why not Eureka:** Adds an extra service to run, extra dependency to manage, and solves a problem Docker Compose already solves. Revisit only if deploying to a non-container environment.

---

## Health Checks

**Decision: Spring Boot Actuator on every service**

Add `spring-boot-starter-actuator` to every service's `pom.xml`. Each service exposes:

```
GET /actuator/health       → {"status": "UP"}
GET /actuator/health/db    → Flyway/DataSource liveness
GET /actuator/info         → Service name, version
```

Docker Compose health check for every service (replace the `auth-service` example):

```yaml
auth-service:
  healthcheck:
    test: ["CMD", "wget", "-qO-", "http://localhost:8001/actuator/health"]
    interval: 30s
    timeout: 5s
    retries: 3
    start_period: 60s   # give Spring time to start
```

`application.yml` config (add to every service):

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info
  endpoint:
    health:
      show-details: when-authorized
```

**Priority:** Add to `auth-service` first (already built), then apply the same config when each new service is scaffolded.
    
---

## API Gateway

**Decision: Spring Cloud Gateway (deferred)**

The architecture doc specifies Nginx as the gateway. Nginx can route and terminate TLS, but it cannot:
- Validate JWTs (would need Lua scripts)
- Apply per-route circuit breakers
- Expose metrics natively in Spring's ecosystem

**Planned replacement:** A dedicated `gateway-service` using Spring Cloud Gateway.

```
gateway-service (port 80 / 443)
  ├── /auth/**        → auth-service:8001
  ├── /career/**      → career-service:8002
  ├── /skill-gap/**   → skill-gap-service:8003
  ├── /portfolio/**   → portfolio-service:8004
  ├── /interview/**   → interview-service:8005
  ├── /matching/**    → matching-service:8006
  ├── /challenge/**   → challenge-service:8007
  ├── /mentorship/**  → mentorship-service:8008
  └── /notifications/** → notification-service:8009
```

Gateway responsibilities:
- JWT validation on every request (other services can trust any request that reaches them)
- Rate limiting per user/IP
- Request logging with `traceId` injection
- CORS headers (remove from individual services)

**When to implement:** After at least 3 services are running and cross-service routing is needed.

`pom.xml` dependency for gateway:

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-gateway</artifactId>
</dependency>
```

---

## Circuit Breakers & Resilience

**Decision: Resilience4j (deferred)**

Three services make external calls that need protection:

| Service | External call | Risk |
|---|---|---|
| `career-service` | Anthropic Claude API (roadmap gen) | API timeout / quota |
| `skill-gap-service` | Anthropic Claude API (gap analysis) | API timeout / quota |
| `interview-service` | Anthropic Claude API (evaluation) | API timeout / quota |

Pattern to apply when implementing each AI-calling service:

```java
@CircuitBreaker(name = "claude-api", fallbackMethod = "roadmapFallback")
@TimeLimiter(name = "claude-api")
@Retry(name = "claude-api")
public CompletableFuture<RoadmapResponse> generateRoadmap(String prompt) {
    return CompletableFuture.supplyAsync(() -> claudeClient.complete(prompt));
}

private CompletableFuture<RoadmapResponse> roadmapFallback(String prompt, Exception ex) {
    // return a cached or generic roadmap
}
```

`application.yml` config template:

```yaml
resilience4j:
  circuitbreaker:
    instances:
      claude-api:
        failure-rate-threshold: 50
        wait-duration-in-open-state: 30s
        sliding-window-size: 10
  timelimiter:
    instances:
      claude-api:
        timeout-duration: 30s   # Claude can be slow on first token
  retry:
    instances:
      claude-api:
        max-attempts: 2
        wait-duration: 1s
```

`pom.xml` dependency:

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-circuitbreaker-resilience4j</artifactId>
</dependency>
```

---

## Distributed Tracing

**Decision: Micrometer Tracing + Zipkin (deferred)**

Every request gets a `traceId` + `spanId` that is propagated across all services via HTTP headers (`traceparent`). This lets you follow a single user request through the gateway → auth → career → Claude API in one view.

`pom.xml` dependencies (add to every service when tracing is needed):

```xml
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-tracing-bridge-brave</artifactId>
</dependency>
<dependency>
    <groupId>io.zipkin.reporter2</groupId>
    <artifactId>zipkin-reporter-brave</artifactId>
</dependency>
```

`application.yml`:

```yaml
management:
  tracing:
    sampling:
      probability: 1.0   # 100% in dev, lower in prod

logging:
  pattern:
    level: "%5p [${spring.application.name},%X{traceId:-},%X{spanId:-}]"
```

Zipkin UI container in `docker-compose.yml`:

```yaml
zipkin:
  image: openzipkin/zipkin:latest
  container_name: skillbridge-zipkin
  ports:
    - "9411:9411"
```

**When to implement:** When debugging cross-service request flows becomes painful. Typically after 3+ services are in place.

---

## Metrics & Monitoring

**Decision: Prometheus + Grafana (deferred — out of scope for academic project)**

Actuator's `/actuator/health` and `/actuator/info` are sufficient for the current phase. A full Prometheus + Grafana stack adds complexity the team doesn't need while building core features.

Revisit before any real production deployment.

---

## Inter-Service Communication

**Decision: Synchronous REST (implemented) + Event-driven optional for v2**

Per the architecture doc, services communicate via REST only in v1. The pattern:

- Services call each other through their Docker Compose DNS names
- All service-to-service calls must include the original JWT (`Authorization: Bearer <token>`)
- The receiving service validates the token locally (no auth-service call needed)

Example (career-service calling skill-gap-service):

```java
// RestTemplate or WebClient — always forward the token
HttpHeaders headers = new HttpHeaders();
headers.setBearerAuth(tokenFromRequestContext);
HttpEntity<?> request = new HttpEntity<>(headers);
ResponseEntity<GapReport> report = restTemplate.exchange(
    "http://skill-gap-service:8003/skill-gap/reports/{id}",
    HttpMethod.GET, request, GapReport.class, reportId);
```

---

## Current Docker Compose Services

| Service | Port | Status |
|---|---|---|
| `postgres` | 5432 | ✓ Running |
| `auth-service` | 8001 | ✓ Running |
| `career-service` | 8002 | Not started |
| `skill-gap-service` | 8003 | Not started |
| `portfolio-service` | 8004 | Not started |
| `interview-service` | 8005 | Not started |
| `matching-service` | 8006 | Not started |
| `challenge-service` | 8007 | Not started |
| `mentorship-service` | 8008 | Not started |
| `notification-service` | 8009 | Not started |
| `gateway-service` | 80 | Deferred |
| `zipkin` | 9411 | Deferred |

---

## JWT Token Contract (Cross-Service)

Every service validates JWTs locally using the shared `JWT_SECRET`. The token payload:

```json
{
  "sub":   "<user UUID>",
  "email": "user@example.com",
  "role":  "STUDENT",
  "iat":   1234567890,
  "exp":   1234654290
}
```

No service needs to call `auth-service` to validate a token. Add the JJWT dependency + a local `JwtValidator` utility class to each service that needs auth. **Do not duplicate the full `JwtService` — extract a shared validation-only utility.**

---

## Build Order (Dependency-First)

When building remaining services, implement in this order to respect data dependencies:

```
1. auth-service          ← done ✓
2. career-service        ← reads user's role/id from JWT only
3. skill-gap-service     ← reads user's id from JWT only
4. portfolio-service     ← reads user's id from JWT only
5. interview-service     ← reads user's id from JWT only
6. matching-service      ← reads opportunities, depends on skill-gap reports
7. challenge-service     ← independent, reads user's id
8. mentorship-service    ← reads alumni profiles
9. notification-service  ← triggered by all other services
10. gateway-service      ← routes to all services (last)
```
