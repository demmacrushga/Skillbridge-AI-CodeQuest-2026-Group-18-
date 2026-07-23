# SkillBridge AI Demo Script

## Pre-Demo Setup

### Step 1: Start the backend
```bash
cd ~/skillbridge
docker compose up
```

### Step 2: Expose backend to phone
```bash
ngrok http 8080
```
Copy the HTTPS URL.

### Step 3: Start frontend
```bash
cd ~/skillbridge/frontend
EXPO_PUBLIC_API_URL=https://your-ngrok-url.ngrok-free.app npx expo start --tunnel
```

### Step 4: Reset test data
```bash
docker exec -i skillbridge-postgres psql -U skillbridge -d skillbridge_db < seed.sql
```

### Step 5: Test accounts

| Role | Email | Password |
|---|---|---|
| Student | student@demo.com | Demo123! |
| Recruiter | recruiter@demo.com | Demo123! |
| Alumni | alumni@demo.com | Demo123! |

Create these accounts first if they do not exist, or use the existing seeded accounts.

---

## Demo Flow

### Part 1: Open the App (1 minute)

**What to say:**
> "SkillBridge is a mobile career-readiness platform built with React Native, Spring Boot microservices, PostgreSQL, and Docker. Let me show you the three user journeys: student, recruiter, and alumni."

**What to do:**
1. Show the welcome screen with logo.
2. Tap **Get Started**.
3. Show role selection screen.

---

### Part 2: Student Journey (5 minutes)

#### 2.1 Register or Login as Student
1. Select **Student**.
2. Log in with the student test account.

**What to say:**
> "Students sign up and select their role. The app uses JWT tokens stored securely on the device for authentication."

#### 2.2 Student Home Dashboard
1. Show the home dashboard.
2. Point out the Quick Access grid.
3. Show the role badge.

**What to say:**
> "This is the student home. From here they can access every feature based on their role."

#### 2.3 Career Roadmap
1. Tap **Career Roadmap**.
2. Enter a career path, e.g., "Software Engineer".
3. Select academic level.
4. Tap **Generate Roadmap**.
5. Wait for AI response.
6. Show the generated roadmap with semesters and milestones.

**What to say:**
> "The AI generates a personalized semester-by-semester roadmap based on the student's career goal and academic level."

#### 2.4 Skill Gap Analysis
1. Go back to home.
2. Tap **Skill Gap**.
3. Type a target role, e.g., "Data Scientist".
4. Tap **Analyze Gap**.
5. Show the missing skills and recommendations.

**What to say:**
> "The AI compares the student's current skills against a target role and shows exactly what they need to learn."

#### 2.5 Opportunities
1. Go back to home.
2. Tap **Opportunities**.
3. Show the matched job postings.
4. Tap one card to expand.
5. Show the match score and required skills.
6. Tap **Apply** on a job without external URL.
7. Write a short pitch and submit.

**What to say:**
> "Opportunities are matched to the student's skills. They can apply directly, and the recruiter sees their verified portfolio."

#### 2.6 Challenges
1. Go back to home.
2. Tap **Challenges**.
3. Show the challenge list posted by recruiters.

**What to say:**
> "Recruiters post challenges. Students can submit solutions and get AI-verified scores."

#### 2.7 Mentorship
1. Go back to home.
2. Tap **Mentorship**.
3. Show the alumni search screen.
4. Tap on an alumni card.
5. Send a mentorship request.

**What to say:**
> "Students can find alumni mentors by industry and expertise, then send mentorship requests."

#### 2.8 Portfolio
1. Go back to home.
2. Tap **Portfolio**.
3. Show how they can add projects, certifications, and awards.

**What to say:**
> "The portfolio is what recruiters see. Items can be verified by AI to prove the student actually has the skills."

#### 2.9 Mock Interview
1. Go back to home.
2. Tap **Mock Interview**.
3. Start a new session.
4. Select a role, e.g., "Software Engineer".
5. Answer a question by typing.
6. Show the AI score and feedback.

**What to say:**
> "The AI mock interviewer asks role-specific questions and gives feedback on the student's answers."

---

### Part 3: Recruiter Journey (4 minutes)

#### 3.1 Log Out and Log In as Recruiter
1. Go to profile if there is a logout option, or clear SecureStore.
2. Log in as recruiter.

**What to say:**
> "Now let me show the recruiter side. Recruiters use SkillBridge to find pre-verified talent."

#### 3.2 Recruiter Dashboard
1. Show the recruiter dashboard.
2. Point out the stats: active jobs, total applicants, total posted.
3. Show the AI insights section.

**What to say:**
> "Recruiters get a dashboard with hiring analytics and AI insights about their applicants."

#### 3.3 Post a Job
1. Tap **Post a Job**.
2. Fill in title, company, description.
3. Add required skills.
4. Submit the posting.

**What to say:**
> "Recruiters post opportunities with required skills. The AI then matches candidates automatically."

#### 3.4 View Postings
1. Tap **View Postings**.
2. Show the newly created job.
3. Tap **View Applicants**.

**What to say:**
> "They can manage all their postings and see applicants."

#### 3.5 View Applicant Portfolio
1. Tap on an applicant.
2. Show the public portfolio.
3. Point out verified items.

**What to say:**
> "Instead of a plain CV, recruiters see a verified portfolio with projects, certifications, and AI-verified achievements."

---

### Part 4: Alumni Journey (3 minutes)

#### 4.1 Log In as Alumni
1. Log out recruiter.
2. Log in as alumni.

**What to say:**
> "Finally, the alumni educator journey. Alumni mentor current students."

#### 4.2 Alumni Dashboard
1. Show the alumni dashboard.
2. Point out active mentees, pending requests, and availability.

**What to say:**
> "Alumni see their mentorship stats and can manage their availability."

#### 4.3 Edit Mentor Profile
1. Tap **Edit** on the mentor profile card.
2. Add job title, company, industry, expertise, bio.
3. Toggle availability.
4. Save.

**What to say:**
> "Alumni set up their mentor profile so students can find them by expertise and industry."

#### 4.4 Manage Requests
1. Tap **Manage Requests**.
2. Show pending requests.
3. Accept a request.

**What to say:**
> "When students request mentorship, alumni can accept or decline. Accepted students become active mentees."

#### 4.5 Active Mentees
1. Tap **Active Mentees** tab.
2. Show the accepted student.

**What to say:**
> "Accepted mentees appear in the active list, making it easy for alumni to track who they are mentoring."

---

## Closing Statement (1 minute)

**What to say:**
> "SkillBridge connects students, recruiters, and alumni on one AI-powered platform. The backend is built with Spring Boot microservices, PostgreSQL, and Docker. The frontend is React Native with Expo. We have a working MVP with clear features for all three user roles, and a roadmap for the next iteration."

---

## What to Avoid During Demo

| Do NOT do | Why |
|---|---|
| Click change password | Not implemented |
| Click forgot password | Not implemented |
| Try voice interview | Not implemented |
| Try push notifications | Not supported in Expo Go |
| Try Google login | Not implemented |
| Try deleting account | Not implemented |
| Refresh the backend | Keep it running |
| Panic if something is slow | Say "the AI is generating a response" |

---

## Backup Plan

If the AI or backend is slow:
1. Skip the AI generation step.
2. Use pre-generated seed data.
3. Say: "The AI feature is architecturally integrated; for the demo I will show the pre-populated example."

If login fails:
1. Use a pre-created account.
2. If all fails, show the screens using the existing token on the device.

Good luck.
