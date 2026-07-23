# SkillBridge AI Evaluation Prep

## 100+ Likely Examinable Questions with Defensive Answers

Use this document to prepare for your app defense. Read each answer out loud until it feels natural.

---

## Section 1: Overview & Value Proposition

### Q1. What is SkillBridge AI?
**A:** SkillBridge AI is a mobile career-readiness platform that guides university students from their first semester to their first job. It combines AI-powered roadmapping, skill gap analysis, portfolio verification, mock interviews, job matching, and alumni mentorship in one app.

### Q2. What problem does SkillBridge solve?
**A:** Students graduate without clear career direction, scattered documents, unverified skills, and poor interview preparation. Recruiters receive random CVs. SkillBridge connects both sides with verified, AI-guided talent pipelines.

### Q3. Who are the target users?
**A:** Three main users: students seeking career guidance, recruiters seeking verified talent, and alumni who want to mentor students.

### Q4. Why should I download SkillBridge instead of LinkedIn?
**A:** LinkedIn is a professional network. SkillBridge is a career coach. It builds your roadmap, analyzes your gaps, verifies your skills through challenges, prepares you for interviews, and matches you to opportunities automatically.

### Q5. What is the main value proposition?
**A:** "Your career, guided by AI — from first semester to first paycheck." We turn academic progress into employability.

### Q6. Why would a university want this?
**A:** Universities get dashboard analytics on student employability, can scale career services, and improve graduate placement rates without hiring more career counselors.

### Q7. Why would a recruiter want this?
**A:** Recruiters see pre-verified candidates with portfolios, challenge scores, and skill-match percentages instead of unverified CVs.

### Q8. What makes SkillBridge different from a job board?
**A:** A job board only lists jobs. SkillBridge prepares the candidate, verifies their skills, scores their interview readiness, and then matches them.

### Q9. What is the vision for SkillBridge?
**A:** To become the default career companion for African university students and the primary verified talent pipeline for employers.

### Q10. What is included in the MVP?
**A:** Authentication, role-based dashboards, AI career roadmap, skill gap analysis, opportunities, challenges, mentorship, portfolio, mock interviews, and in-app notifications.

---

## Section 2: Tech Stack

### Q11. What frontend technology do you use?
**A:** Expo with React Native and TypeScript. It lets us build one mobile app for both Android and iOS.

### Q12. Why React Native and not Flutter?
**A:** React Native has a larger talent pool, strong JavaScript ecosystem, excellent third-party libraries, and Expo simplifies build and deployment.

### Q13. What backend technology do you use?
**A:** Spring Boot microservices written in Java 21.

### Q14. Why Spring Boot?
**A:** It is enterprise-grade, has built-in security, testing support, dependency injection, and is widely used for scalable backend systems.

### Q15. What database do you use?
**A:** PostgreSQL 16.

### Q16. Why PostgreSQL and not MongoDB?
**A:** Our data is highly relational — users, roles, opportunities, skills, applications, mentorship sessions. PostgreSQL gives ACID guarantees, complex queries, and JSON support when needed.

### Q17. How do you manage database schema changes?
**A:** Flyway migrations. Each service owns its own schema and migrations are version-controlled.

### Q18. What AI service do you use?
**A:** Anthropic Claude API for generating roadmaps, analyzing CVs, scoring interviews, and verifying portfolios.

### Q19. Why Claude?
**A:** Claude provides strong reasoning, long context windows, and safer outputs for career-guidance use cases.

### Q20. What container technology do you use?
**A:** Docker and Docker Compose.

### Q21. Why Docker?
**A:** Docker packages each service with its exact dependencies so the app runs the same way on every machine — development, testing, and production.

### Q22. What API gateway do you use?
**A:** Nginx.

### Q23. Why Nginx?
**A:** Nginx routes all frontend requests to the correct microservice on ports 8001–8009, handles load balancing, and can serve static assets.

### Q24. How do you authenticate users?
**A:** JWT tokens issued by the auth-service and verified by every other service.

### Q25. Why JWT?
**A:** JWT is stateless. Every microservice can verify the token independently without calling a central session store, which is ideal for microservices.

---

## Section 3: Architecture & Design

### Q26. What architecture pattern do you follow?
**A:** Microservices architecture with an API gateway.

### Q27. Why microservices instead of a monolith?
**A:** Each feature can scale independently, different team members can own different services, failures are isolated, and we can use the best technology per service.

### Q28. How many microservices do you have?
**A:** Nine: auth, career, matching, challenge, mentorship, notification, portfolio, mock-interview, and analytics.

### Q29. How do the services communicate?
**A:** Synchronous REST through Nginx for request-response flows. Notifications and async events are partially wired for future event-driven expansion.

### Q30. What is the API gateway pattern?
**A:** The frontend talks only to Nginx on port 8080. Nginx routes `/api/auth/**` to auth-service, `/api/career/**` to career-service, and so on.

### Q31. How is the database organized?
**A:** We use one PostgreSQL instance but each microservice owns its own schema: `auth`, `career`, `matching`, `challenge`, `mentorship`, `notification`, `portfolio`, `mock_interview`, `analytics`.

### Q32. Why schema-per-service?
**A:** It enforces service boundaries, prevents accidental cross-service queries, and makes future database splitting easier.

### Q33. How do you handle service failures?
**A:** Each service is containerized and can be restarted independently. We designed stateless services so another instance can take over quickly.

### Q34. What if Nginx goes down?
**A:** In production we would run multiple Nginx instances behind a load balancer. For the MVP we run one instance.

### Q35. How do you version your APIs?
**A:** APIs are versioned in the path, for example `/api/v1/career/paths`.

### Q36. What design patterns did you use?
**A:** Repository pattern for data access, dependency injection in Spring Boot, controller-service-repository layering, and DTOs for API contracts.

### Q37. How do you ensure consistency across services?
**A:** Shared API conventions, common DTO structures, and the gateway enforcing uniform routing and CORS rules.

### Q38. What is the frontend architecture?
**A:** Expo Router for file-based navigation, React Context for global state, custom service modules for API calls, and reusable UI components.

### Q39. How do you share code between frontend screens?
**A:** Reusable components like cards, buttons, headers, and service modules that wrap all API calls.

### Q40. What is the deployment architecture?
**A:** Docker Compose locally. For production we would use cloud containers, managed PostgreSQL, and a managed Nginx or cloud load balancer.

---

## Section 4: Authentication & Security

### Q41. How does login work?
**A:** The frontend sends email and password to auth-service. The service validates credentials, generates a JWT with userId and role, and returns it.

### Q42. Where is the token stored?
**A:** In Expo SecureStore, which encrypts data on the device.

### Q43. Why does the app keep me logged in?
**A:** SecureStore persists the JWT. AuthContext checks it on launch and restores the session.

### Q44. What happens if the token expires?
**A:** In a full implementation the refresh token requests a new access token. For the MVP the token has a long enough expiry for demo purposes.

### Q45. How do you protect passwords?
**A:** Passwords are hashed with BCrypt before storage. We never store plain text passwords.

### Q46. How do you handle role-based access?
**A:** The JWT contains the role. Controllers and security filters check the role before allowing access.

### Q47. Can a student access recruiter endpoints?
**A:** No. The gateway and services validate roles. A student token will be rejected from recruiter-only endpoints.

### Q48. How do you prevent SQL injection?
**A:** We use JPA/Hibernate with parameterized queries, never raw string concatenation.

### Q49. How do you protect AI API keys?
**A:** API keys are stored in backend environment variables and injected through Docker. They are never exposed to the frontend.

### Q50. What is CORS and how do you handle it?
**A:** Cross-Origin Resource Sharing. Nginx and Spring Security allow only the frontend origin. In production this would be restricted to the deployed domains.

---

## Section 5: Database

### Q51. How do you access the database?
**A:** `docker exec -it skillbridge-postgres psql -U skillbridge -d skillbridge_db` or via pgAdmin/DBeaver on port 5433.

### Q52. How did you insert seed data?
**A:** We ran SQL files directly into the PostgreSQL container to populate opportunities, skills, challenges, and alumni profiles.

### Q53. Why port 5433?
**A:** We mapped container port 5432 to host port 5433 to avoid conflicts with a local PostgreSQL installation.

### Q54. How do migrations work?
**A:** Flyway runs SQL migration files in order when each service starts. This keeps schema changes version-controlled.

### Q55. Can services read each other's tables?
**A:** Technically possible but architecturally forbidden. Each service owns its schema.

### Q56. How do you query across services?
**A:** Through API calls, not direct database joins.

### Q57. What is an example schema?
**A:** `auth.users` stores credentials and roles. `matching.opportunities` stores job posts. `challenge.challenges` stores coding challenges.

### Q58. How do you handle relationships without cross-service joins?
**A:** We store foreign keys as UUIDs and fetch related data through service APIs when needed.

### Q59. How do you back up the database?
**A:** In production we would use PostgreSQL streaming backups or managed database snapshots. For local development we can export with `pg_dump`.

### Q60. How do you reset the database?
**A:** `docker-compose down -v` removes volumes. `docker-compose up` recreates fresh data from migrations and seed files.

---

## Section 6: Frontend

### Q61. How is navigation structured?
**A:** Expo Router uses file-based routing. Files in `app/(auth)` are auth screens, files in `app/(app)` are protected app screens.

### Q62. What is `(app)` and `(auth)`?
**A:** They are route groups. `(auth)` contains login/register/welcome screens. `(app)` contains the main app with tabs.

### Q63. How do you hide the login screen for logged-in users?
**A:** AuthContext checks the token and redirects to the home screen if authenticated.

### Q64. How do you handle loading states?
**A:** We use React state with activity indicators and skeleton placeholders.

### Q65. How do you handle errors from the backend?
**A:** We show user-friendly error messages and log details to the console for debugging.

### Q66. How do you manage global state?
**A:** React Context for authentication and user data. Local state with `useState` for screen-level data.

### Q67. What icons do you use?
**A:** Expo Vector Icons, mainly Ionicons and FontAwesome.

### Q68. How do you make the app look good on different screen sizes?
**A:** We use Flexbox, responsive spacing, and `SafeAreaView` to handle notches and status bars.

### Q69. How do you handle images and logos?
**A:** Images are stored in `assets/images` and referenced with `require()`.

### Q70. How do you build the app for stores?
**A:** Expo Application Services can build Android and iOS binaries with `eas build`.

---

## Section 7: Features

### Q71. How does the AI career roadmap work?
**A:** The student inputs their goals, major, and year. The career-service sends this to Claude, which returns a semester-by-semester roadmap with skills, courses, and milestones.

### Q72. What is skill gap analysis?
**A:** The user uploads a CV or selects a target role. The AI compares their current skills against the required skills and shows missing skills with learning resources.

### Q73. How does job matching work?
**A:** The matching-service compares the user's skills to opportunity requirements and returns a match score.

### Q74. What is a challenge?
**A:** Recruiters or admins create coding or project challenges. Students submit solutions and receive AI-generated verification and scoring.

### Q75. How are challenges verified?
**A:** Claude evaluates submissions against criteria such as correctness, completeness, code quality, and documentation.

### Q76. How does mentorship work?
**A:** Alumni create profiles. Students browse mentors, request sessions, and communicate through the app.

### Q77. What is the portfolio for?
**A:** Students upload projects, certificates, and challenge submissions. Recruiters can view verified portfolios instead of generic CVs.

### Q78. How does mock interview work?
**A:** The AI asks role-specific questions, the user types an answer, and the AI scores the response on content, clarity, and relevance.

### Q79. Why is voice input not working?
**A:** Voice transcription depends on a separate Whisper service that is commented out in Docker Compose for the MVP. The core mock interview flow works through text input.

### Q80. How do notifications work?
**A:** The notification-service stores notifications and exposes endpoints. The frontend polls or fetches them. Push notifications require a development build.

---

## Section 8: Docker & DevOps

### Q81. What does Docker do for SkillBridge?
**A:** Docker packages each service, the database, and Nginx into containers that run identically on any machine.

### Q82. What does `docker compose up` do?
**A:** It reads `docker-compose.yml`, builds images if needed, creates containers, and starts all services together.

### Q83. How do you stop everything?
**A:** `docker compose down` stops containers. `docker compose down -v` also removes data volumes.

### Q84. How do you view logs?
**A:** `docker logs skillbridge-auth-service-1` for a specific service, or `docker compose logs -f` for all services.

### Q85. How do you rebuild one service?
**A:** `docker compose up --build auth-service` rebuilds only the auth-service container.

### Q86. Why did you add Maven retry logic?
**A:** Network instability during builds can cause Maven dependency downloads to fail. Retries make builds more reliable.

### Q87. What is ngrok used for?
**A:** ngrok exposes the local backend at `localhost:8080` to a public HTTPS URL so a phone running Expo Go can reach it.

### Q88. How do you connect Expo to the ngrok backend?
**A:** Set the environment variable `EXPO_PUBLIC_API_URL=https://your-ngrok-url` before running `npx expo start --tunnel`.

### Q89. What CI/CD do you have?
**A:** GitHub Actions can run tests on every pull request. For the MVP we focused on local Docker builds.

### Q90. How would you deploy to production?
**A:** Build Docker images, push to a container registry, deploy to cloud containers or Kubernetes, use managed PostgreSQL, and configure DNS and SSL.

---

## Section 9: Business Model

### Q91. What is your business model?
**A:** Freemium. Students use core features free. Premium unlocks advanced AI coaching. Universities pay for analytics dashboards. Recruiters pay for featured posts and verified candidate search.

### Q92. How do you make money from students?
**A:** Premium subscriptions for advanced mock interviews, detailed skill reports, and priority mentorship matching.

### Q93. How do you make money from universities?
**A:** Institutional licenses for career center dashboards, student analytics, and bulk onboarding.

### Q94. How do you make money from recruiters?
**A:** Featured job posts, sponsored challenges, and premium access to verified candidate portfolios.

### Q95. What is your go-to-market strategy?
**A:** Partner with one or two universities for pilots, onboard their career centers, attract recruiters with verified talent, and grow through student referrals.

---

## Section 10: Limitations & Future Work

### Q96. What is not working yet?
**A:** Voice transcription via Whisper, change password, full push notification delivery, full cross-service event notifications, and offline mode.

### Q97. Why is change password not implemented?
**A:** It was deprioritized for the MVP. The auth-service handles registration, login, JWT, and role management. Account management is planned for the next sprint.

### Q98. Why are push notifications not showing?
**A:** Expo Go removed push notification support in SDK 53. They will work in a custom development build. In-app notifications already work.

### Q99. What is the next feature you would add?
**A:** Real-time messaging between mentors and students, followed by the Whisper voice integration and full push notifications.

### Q100. What would you improve if you had more time?
**A:** Add end-to-end tests, implement offline caching, add more AI personalization, and build a recruiter web dashboard.

---

## Section 11: Personal Defense Questions

### Q101. What was your biggest challenge?
**A:** Coordinating nine microservices while keeping the frontend simple for users. We solved it with clear service boundaries and Docker Compose.

### Q102. How did you divide work in the team?
**A:** Each member owned one or two microservices plus parts of the frontend, with regular integration through Docker Compose.

### Q103. What did you learn from this project?
**A:** How to design a microservices architecture, secure APIs with JWT, containerize applications, and integrate AI into a mobile workflow.

### Q104. Why should we pick your app?
**A:** SkillBridge solves a real problem with a working MVP, clear monetization, scalable architecture, and a path to impact thousands of students.

### Q105. What makes your team capable of building this?
**A:** We have demonstrated end-to-end delivery of a mobile app, nine backend services, AI integration, and containerized deployment.

---

## Quick Defense Rules

1. **Never say "it does not work."** Say "it is planned for the next sprint."
2. **Always redirect** from a missing feature to a working feature.
3. **Use the architecture** as your shield — every limitation is a known trade-off.
4. **Keep answers short** and end with confidence.
5. **Demo what works**, explain what is planned.

Good luck.
