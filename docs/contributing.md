# Contributing to SkillBridge AI

This document covers everything you need to know about contributing to the SkillBridge AI codebase as a member of Group 18.

---

## Table of Contents

- [Team Structure](#team-structure)
- [Module Ownership](#module-ownership)
- [Branching Strategy](#branching-strategy)
- [Commit Message Convention](#commit-message-convention)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Testing Requirements](#testing-requirements)
- [Definition of Done](#definition-of-done)

---

## Team Structure

Every member of Group 18 is a **full-stack developer**. There are no specialised roles. You are responsible for:

- The frontend screens for your assigned feature area
- The Spring Boot backend service(s) for that feature area
- The PostgreSQL schema and Flyway migrations for your service(s)
- Docker configuration for your service(s)
- API documentation (Swagger annotations)
- Unit and integration tests for your code

The consultant assigned to the group is the primary external point of contact. Internal decisions are made collectively, with everyone expected to participate in weekly sync meetings.

---

## Module Ownership

| Member | Backend Service(s) | Frontend Screens |
|---|---|---|
| Akomeah Hilda Okyem | auth-service | (auth)/ — login, register, onboarding |
| Frimpong Roselyn Kyerewa | career-service, skill-gap-service | (student)/roadmap, (student)/skill-gap |
| Mintah Louisa Afua | portfolio-service, interview-service | (student)/portfolio, (student)/interviews |
| Ampong Lordina Animah | matching-service, challenge-service | (student)/opportunities, (student)/challenges |
| Dziwornu Edith | mentorship-service, notification-service | (student)/mentorship, (admin)/, (recruiter)/ |

Ownership means you are the **primary developer** for that module. It does not mean others cannot review, fix bugs, or contribute to your area — it means you are the one accountable for it being complete and working.

---

## Branching Strategy

The `main` branch is the single source of truth. It should always be in a working, buildable state.

### Branch naming

```
feat/short-description          # New feature
fix/short-description           # Bug fix
docs/short-description          # Documentation only
test/short-description          # Adding or fixing tests
chore/short-description         # Tooling, config, dependencies
refactor/short-description      # Code refactoring without behaviour change
```

**Examples:**
```
feat/career-roadmap-generation
feat/cv-upload-and-parsing
fix/jwt-token-refresh-loop
docs/update-architecture-diagram
test/interview-service-unit-tests
```

### Rules

- **Never commit directly to `main`**. Always work on a branch.
- Branch off from the latest `main` at the start of every feature.
- Keep branches short-lived — open a PR as soon as your work is ready for review.
- Delete branches after they are merged.

---

## Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. This makes the git history readable and enables automated changelog generation.

### Format

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Types

| Type | When to use |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `test` | Adding or updating tests |
| `chore` | Build process, dependencies, tooling |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `style` | Formatting, missing semicolons — no logic change |
| `perf` | Performance improvement |

### Scope

Use the service or module name as the scope:

```
feat(career-service): implement AI roadmap generation endpoint
fix(auth-service): resolve refresh token rotation edge case
feat(frontend/roadmap): add milestone completion animation
docs(architecture): update service port map
test(portfolio-service): add verification workflow integration tests
```

### Rules

- Use the **imperative mood** in the description: "add feature" not "added feature"
- Keep the subject line under **72 characters**
- Reference issue or task numbers in the footer if applicable: `Closes #12`

---

## Pull Request Process

### Before opening a PR

1. Pull the latest `main` and rebase your branch:
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. Run all tests locally and confirm they pass:
   ```bash
   # Backend
   cd backend/your-service && ./mvnw test

   # Frontend
   cd frontend && npm test
   ```

3. Check that your code builds cleanly:
   ```bash
   # Backend
   cd backend/your-service && ./mvnw package -DskipTests

   # Frontend
   cd frontend && npx expo export
   ```

4. Make sure your Swagger annotations are up to date for any new or changed endpoints.

### PR description template

When you open a PR, fill out the following:

```markdown
## What this PR does
Brief description of the change and why it was needed.

## Type of change
- [ ] New feature
- [ ] Bug fix
- [ ] Documentation
- [ ] Test

## How to test
Steps to verify the change works as expected.

## Checklist
- [ ] Tests written and passing
- [ ] Swagger docs updated (if applicable)
- [ ] No hardcoded secrets or credentials
- [ ] Branch rebased on latest main
```

### Review requirements

- At least **one other group member** must review and approve before merging
- The CI pipeline must pass (lint, tests, build)
- Resolve all review comments before merging

### Merging

Use **Squash and Merge** for feature branches to keep the `main` history clean. The squashed commit message should follow the conventional commits format.

---

## Code Style

### Java (Spring Boot)

- Follow standard Java naming conventions: `camelCase` for variables and methods, `PascalCase` for classes
- Use `@RestController`, `@Service`, `@Repository` layering consistently
- Never put business logic in controllers — controllers call services; services call repositories
- All endpoints must have Swagger `@Operation` and `@ApiResponse` annotations
- Use constructor injection, not field injection (`@Autowired` on fields)
- Check style is enforced by Checkstyle — the CI will fail if violations are found

### TypeScript (React Native)

- All files use `.tsx` for components, `.ts` for non-JSX
- Use functional components only — no class components
- All props must be typed with explicit TypeScript interfaces
- No use of `any` — if you genuinely need a dynamic type, use `unknown` and narrow it
- ESLint is configured — run `npm run lint` before pushing

### General

- No commented-out code in PRs — delete it or move it to a GitHub issue
- No hardcoded strings that belong in constants or environment variables
- Write code for the person reading it next, not just for the machine running it

---

## Testing Requirements

### Backend

Each Spring Boot service must have:

- **Unit tests** for all service-layer methods using JUnit 5 and Mockito
- **Integration tests** for all controller endpoints using `@SpringBootTest` and MockMvc
- Minimum **70% line coverage** (enforced in CI via JaCoCo)

Test files live alongside the production code in `src/test/java/`.

### Frontend

- Unit tests for utility functions and custom hooks using Jest
- Component tests for key UI components using React Native Testing Library

### Running tests

```bash
# Backend unit + integration tests
cd backend/auth-service
./mvnw test

# Backend with coverage report
./mvnw verify
# Report: target/site/jacoco/index.html

# Frontend
cd frontend
npm test

# Watch mode
npm test -- --watch
```

---

## Definition of Done

A feature is not done until all of the following are true:

- [ ] The functional requirement(s) it addresses have passing acceptance criteria
- [ ] Unit tests written and passing locally
- [ ] Integration tests written and passing locally
- [ ] CI pipeline passes on the PR branch
- [ ] Swagger documentation updated for any new or modified endpoints
- [ ] Flyway migration added for any schema changes
- [ ] No hardcoded secrets, credentials, or localhost URLs
- [ ] PR reviewed and approved by at least one group member
- [ ] Branch merged and deleted
