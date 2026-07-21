# Setup Guide

This guide walks through setting up the full SkillBridge AI development environment from scratch. Follow it in order on a clean machine.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Clone the Repository](#clone-the-repository)
- [Environment Configuration](#environment-configuration)
- [Option A — Full Stack with Docker (Recommended)](#option-a--full-stack-with-docker-recommended)
- [Option B — Run Services Individually](#option-b--run-services-individually)
- [Frontend Setup](#frontend-setup)
- [Verify Everything is Running](#verify-everything-is-running)
- [Common Issues](#common-issues)

---

## Prerequisites

Install the following before starting:

| Tool | Version | Install |
|---|---|---|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Java JDK | 21 | [adoptium.net](https://adoptium.net) |
| Docker Desktop | Latest | [docker.com](https://www.docker.com/products/docker-desktop) |
| Git | Any recent | [git-scm.com](https://git-scm.com) |
| Expo Go (phone) | Latest | App Store / Google Play |

You will also need:
- An **Anthropic API key** from [console.anthropic.com](https://console.anthropic.com)
- A **Google OAuth 2.0 Client ID and Secret** from [console.cloud.google.com](https://console.cloud.google.com) (optional for local dev — standard email/password auth works without it)

---

## Clone the Repository

```bash
git clone https://github.com/knust-cs-group18/skillbridge-ai.git
cd skillbridge-ai
```

---

## Environment Configuration

Copy the environment template and fill in your values:

```bash
cp .env.example .env
```

Open `.env` in your editor and set the following:

```env
# Database
POSTGRES_HOST=postgres          # Use 'postgres' when running via Docker Compose
POSTGRES_PORT=5432
POSTGRES_USER=skillbridge
POSTGRES_PASSWORD=choose_a_strong_password
POSTGRES_DB=skillbridge_db

# Auth
JWT_SECRET=choose_a_random_string_at_least_32_characters_long
JWT_EXPIRY_HOURS=24
OAUTH_GOOGLE_CLIENT_ID=          # Optional for local dev
OAUTH_GOOGLE_CLIENT_SECRET=      # Optional for local dev

# AI
ANTHROPIC_API_KEY=sk-ant-...     # Required — get from console.anthropic.com

# Notifications
EXPO_ACCESS_TOKEN=               # Optional for local dev

# Ports (defaults are fine unless you have conflicts)
AUTH_SERVICE_PORT=8001
CAREER_SERVICE_PORT=8002
SKILL_GAP_SERVICE_PORT=8003
PORTFOLIO_SERVICE_PORT=8004
INTERVIEW_SERVICE_PORT=8005
MATCHING_SERVICE_PORT=8006
CHALLENGE_SERVICE_PORT=8007
MENTORSHIP_SERVICE_PORT=8008
NOTIFICATION_SERVICE_PORT=8009
```

> **Important:** Never commit your `.env` file. It is in `.gitignore` by default.

---

## Option A — Full Stack with Docker (Recommended)

This starts all nine microservices and a PostgreSQL instance in one command. This is the easiest way to get everything running.

### Start the full stack

```bash
docker-compose up --build
```

The first build will take several minutes as it downloads base images and builds each service. Subsequent starts are much faster.

### What happens on startup

1. PostgreSQL starts and creates the `skillbridge_db` database
2. Each Spring Boot service starts up and Flyway automatically runs any pending migrations
3. All services register their Swagger docs at `/swagger-ui/index.html`

### Verify it's running

```bash
# Check all containers are up
docker-compose ps

# Expected output — all services should show 'running'
NAME                        STATUS
skillbridge-postgres        running
skillbridge-auth            running
skillbridge-career          running
skillbridge-skill-gap       running
skillbridge-portfolio       running
skillbridge-interview       running
skillbridge-matching        running
skillbridge-challenge       running
skillbridge-mentorship      running
skillbridge-notification    running
```

### Stop everything

```bash
docker-compose down
```

### Stop and wipe the database (clean slate)

```bash
docker-compose down -v
```

---

## Option B — Run Services Individually

If you only need to work on one or two services, you can run them individually with a local PostgreSQL instance.

### 1. Start PostgreSQL locally

Make sure PostgreSQL 16 is installed and running, then create the database:

```sql
CREATE DATABASE skillbridge_db;
CREATE USER skillbridge WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE skillbridge_db TO skillbridge;
```

### 2. Update your `.env`

Change `POSTGRES_HOST` from `postgres` to `localhost`.

### 3. Run a service

```bash
cd backend/auth-service
./mvnw spring-boot:run
```

Repeat for any other service you need. Flyway will run migrations automatically on first startup.

---

## Frontend Setup

The frontend is set up separately regardless of whether you used Option A or B for the backend.

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Configure the API base URL

Create a `.env` file in the `frontend/` directory:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost
```

The API client in `services/api.ts` uses this to construct service URLs. When using Docker Compose, all services are accessible on `localhost` at their respective ports.

### 3. Start the Expo development server

```bash
npx expo start
```

You will see a QR code in the terminal.

### 4. Open the app

| Method | How |
|---|---|
| **Physical device (recommended)** | Install Expo Go from the App Store or Google Play, then scan the QR code |
| **Android emulator** | Press `a` in the terminal (requires Android Studio and an AVD set up) |
| **iOS simulator** | Press `i` in the terminal (requires Xcode, macOS only) |

---

## Verify Everything is Running

Once the backend is up and the frontend is started, confirm the following:

### Backend health checks

Open each of these in your browser — you should see the Swagger UI:

- Auth service: http://localhost:8001/swagger-ui/index.html
- Career service: http://localhost:8002/swagger-ui/index.html
- Skill gap service: http://localhost:8003/swagger-ui/index.html

### Quick API smoke test

```bash
# Register a test user
curl -X POST http://localhost:8001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234!",
    "firstName": "Test",
    "lastName": "User",
    "role": "STUDENT"
  }'

# Expected: 201 Created with user details
```

```bash
# Log in and get a token
curl -X POST http://localhost:8001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234!"
  }'

# Expected: 200 OK with accessToken and refreshToken
```

---

## Common Issues

### Port already in use

If a service fails to start because a port is in use:

```bash
# Find what's using the port (e.g., 8001)
lsof -i :8001          # macOS / Linux
netstat -ano | findstr 8001   # Windows

# Kill the process or change the port in .env
```

### Docker build fails — out of memory

Increase Docker Desktop's memory allocation:
- Open Docker Desktop → Settings → Resources
- Set Memory to at least **6 GB** (9 services running simultaneously is demanding)

### Flyway migration error on startup

This usually means a migration file was edited after it was already applied. Check the service logs:

```bash
docker-compose logs auth-service | grep -i flyway
```

If you see a checksum mismatch, the only clean fix is to wipe the database and start fresh:

```bash
docker-compose down -v
docker-compose up --build
```

### Frontend cannot reach the backend

- Confirm the backend services are running: `docker-compose ps`
- On a physical device, `localhost` refers to your phone, not your computer. Replace `localhost` with your machine's local IP address in `frontend/.env`:
  ```env
  EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x
  ```
  Find your IP with `ipconfig` (Windows) or `ifconfig` (macOS/Linux).

### Anthropic API errors

- Double-check your `ANTHROPIC_API_KEY` in `.env` — it should start with `sk-ant-`
- Check your account usage at [console.anthropic.com](https://console.anthropic.com) — free tier has rate limits
- Skill gap and interview services will fail gracefully with a 503 if the API is unreachable
