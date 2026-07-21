# Authentication Service

**Runs on port 8001**

---

## What this service does

This is the front door of SkillBridge AI. Every user — students, alumni, recruiters, and admins — goes through this service to create an account and sign in. Once signed in, the user gets a token (a short string of characters) that proves who they are. Every other service in the platform reads that token to know who is making a request, without needing to ask this service again.

Think of it like a concert wristband: you show your ID at the gate once, get the wristband, and then every vendor inside just checks the wristband — they don't go back to the gate.

---

## User types

SkillBridge AI has four types of users. Each person can only be one type, and that type is baked into their token when they sign in.

| Type | Who they are |
|---|---|
| **Student** | A university student building their career profile |
| **Alumni** | A former student who has graduated and wants to mentor students |
| **Recruiter** | A company representative posting jobs and challenges |
| **Admin** | Platform staff who can review and override AI decisions |

> Admin accounts are created directly in the database — they cannot self-register through the app.

---

## How signing in works

When a user signs in, they receive two things:

**Access token** — proves who you are for the next 24 hours. Every request to the platform must include this in the header. When it expires, the user doesn't need to enter their password again — they use the refresh token instead.

**Refresh token** — a long-lived backup token stored securely on the device. When the access token expires, the app sends the refresh token to get a fresh access token automatically. Each time a refresh token is used, it is replaced with a brand new one — the old one stops working immediately. This limits the damage if a token is ever stolen.

---

## Endpoints

### Create an account

```
POST /auth/register
```

Send the new user's details. The `role` field determines what they can do on the platform.

```json
{
  "email": "abena@knust.edu.gh",
  "password": "SecurePass123!",
  "firstName": "Abena",
  "lastName": "Mensah",
  "role": "STUDENT"
}
```

When successful, the account is created but not yet verified. The `emailVerified` flag will be `false` — the platform doesn't block login on this in v1, but the flag is there for future use.

**On success (201)**
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "email": "abena@knust.edu.gh",
  "firstName": "Abena",
  "lastName": "Mensah",
  "role": "STUDENT",
  "emailVerified": false
}
```

**What can go wrong**
- `400` — email is badly formatted, password is too weak, or role is not one of the allowed values
- `409` — an account with that email already exists

---

### Sign in

```
POST /auth/login
```

```json
{
  "email": "abena@knust.edu.gh",
  "password": "SecurePass123!"
}
```

Returns both tokens and a summary of the user's account. The app should store both tokens securely on the device.

**On success (200)**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
  "expiresIn": 86400,
  "user": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "abena@knust.edu.gh",
    "role": "STUDENT"
  }
}
```

`expiresIn` is in seconds — 86400 means 24 hours.

**What can go wrong**
- `400` — email or password field is missing
- `401` — email doesn't exist or password is wrong

---

### Get a new access token

```
POST /auth/refresh
```

Call this when the access token has expired (any service returns `401`). Send the refresh token and get a fresh access token back. The old refresh token is immediately cancelled — the new one in the response is the only valid one going forward.

```json
{ "refreshToken": "eyJhbGciOiJIUzI1NiJ9..." }
```

**On success (200)** — a new access token and a new refresh token.

**What can go wrong**
- `401` — the refresh token has expired, has already been used, or was revoked (user will need to sign in again)

---

### Get the signed-in user's profile

```
GET /auth/me
Authorization: Bearer <access_token>
```

Returns the full profile of whoever owns the token. The app uses this on startup to restore the session without asking the user to sign in again.

**On success (200)** — full name, email, role, and email verification status.

**What can go wrong**
- `401` — the access token is missing, expired, or tampered with

---

## Important behaviours

**One role per user.** A person is either a student, alumni, recruiter, or admin — never more than one. The role is set at registration and cannot be changed through the app.

**Other services never call this one at runtime.** When a request arrives at any other service (career, portfolio, interviews, etc.), that service checks the token itself using a shared secret key. It doesn't make a network call to auth-service. This means auth-service going down doesn't break the rest of the platform for users who are already signed in.

**Refresh tokens are single-use.** Once a refresh token is used to get a new access token, it is cancelled and replaced. If the same refresh token is used twice, both it and the new one are revoked — this is a security measure to detect stolen tokens.
