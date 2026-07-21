import {
  type Challenge,
  type ChallengeList,
  type Leaderboard,
  type MySubmission,
  type PostChallengePayload,
  type ScoreSubmissionPayload,
  type SubmissionResult,
  type SubmissionReview,
  type SubmitSolutionPayload,
} from '@/types/challenge';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

async function request<T>(path: string, accessToken: string, options: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, message: body.error ?? body.message ?? 'Request failed' };
  }

  return res.json();
}

// ── US1: Recruiter posts a challenge ───────────────────────────────────
export async function postChallenge(
  token: string,
  payload: PostChallengePayload
): Promise<Challenge> {
  return request<Challenge>('/challenge', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── US2: Browse active challenges ──────────────────────────────────────
export async function getChallenges(token: string): Promise<ChallengeList> {
  return request<ChallengeList>('/challenge', token, { method: 'GET' });
}

// ── US3: Submit a solution ─────────────────────────────────────────────
export async function submit(
  token: string,
  challengeId: string,
  payload: SubmitSolutionPayload
): Promise<SubmissionResult> {
  return request<SubmissionResult>(`/challenge/${challengeId}/submissions`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── US4: My submissions ────────────────────────────────────────────────
export async function getMySubmissions(token: string): Promise<MySubmission[]> {
  return request<MySubmission[]>('/challenge/my-submissions', token, { method: 'GET' });
}

// ── US5: Score submissions (recruiter) ─────────────────────────────────
export async function getSubmissions(token: string, challengeId: string): Promise<SubmissionReview[]> {
  return request<SubmissionReview[]>(`/challenge/${challengeId}/submissions`, token, {
    method: 'GET',
  });
}

export async function scoreSubmission(
  token: string,
  challengeId: string,
  submissionId: string,
  payload: ScoreSubmissionPayload
): Promise<SubmissionReview> {
  return request<SubmissionReview>(
    `/challenge/${challengeId}/submissions/${submissionId}/score`,
    token,
    { method: 'POST', body: JSON.stringify(payload) }
  );
}

// ── US6: Leaderboard ───────────────────────────────────────────────────
export async function getLeaderboard(token: string, challengeId: string): Promise<Leaderboard> {
  return request<Leaderboard>(`/challenge/${challengeId}/leaderboard`, token, { method: 'GET' });
}

// ── US7: Recruiter management ──────────────────────────────────────────
export async function getMyChallenges(token: string): Promise<Challenge[]> {
  return request<Challenge[]>('/challenge/mine', token, { method: 'GET' });
}

export async function deactivate(token: string, challengeId: string): Promise<Challenge> {
  return request<Challenge>(`/challenge/${challengeId}/deactivate`, token, { method: 'POST' });
}
