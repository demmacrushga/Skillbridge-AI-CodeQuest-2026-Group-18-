import {
  type AlumniProfile,
  type AlumniSearchResult,
  type MentorshipPair,
  type MentorshipRequest,
  type SendMessagePayload,
  type SendRequestPayload,
  type Thread,
  type Message,
  type UpsertProfilePayload,
} from '@/types/mentorship';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

async function request<T>(path: string, accessToken: string, options: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...options.headers,
      },
    });
  } catch (err) {
    throw { status: 0, message: 'SkillBridge mentorship service is currently unavailable. Please check your network connection.' };
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, message: body.error ?? body.message ?? `Request failed (${res.status})` };
  }

  return res.json();
}

// ── US1: Alumni mentor profile ─────────────────────────────────────────
export async function getMyProfile(token: string): Promise<AlumniProfile> {
  return request<AlumniProfile>('/mentorship/profile', token, { method: 'GET' });
}

export async function upsertProfile(
  token: string,
  payload: UpsertProfilePayload
): Promise<AlumniProfile> {
  return request<AlumniProfile>('/mentorship/profile', token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// ── US2: Student searches alumni ───────────────────────────────────────
export async function searchAlumni(
  token: string,
  params: { interests?: string[]; industry?: string }
): Promise<AlumniSearchResult> {
  const query = new URLSearchParams();
  for (const interest of params.interests ?? []) {
    query.append('interest', interest);
  }
  if (params.industry) {
    query.append('industry', params.industry);
  }
  const qs = query.toString();
  return request<AlumniSearchResult>(`/mentorship/alumni${qs ? `?${qs}` : ''}`, token, {
    method: 'GET',
  });
}

// ── US3: Mentorship requests (student) ─────────────────────────────────
export async function sendRequest(
  token: string,
  payload: SendRequestPayload
): Promise<MentorshipRequest> {
  return request<MentorshipRequest>('/mentorship/requests', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMyRequests(token: string): Promise<MentorshipRequest[]> {
  return request<MentorshipRequest[]>('/mentorship/requests/mine', token, { method: 'GET' });
}

export async function cancelRequest(token: string, requestId: string): Promise<MentorshipRequest> {
  return request<MentorshipRequest>(`/mentorship/requests/${requestId}/cancel`, token, {
    method: 'POST',
  });
}

// ── US4: Respond to requests (alumni) ──────────────────────────────────
export async function getIncomingRequests(token: string): Promise<MentorshipRequest[]> {
  return request<MentorshipRequest[]>('/mentorship/requests/incoming', token, { method: 'GET' });
}

export async function acceptRequest(token: string, requestId: string): Promise<MentorshipPair> {
  return request<MentorshipPair>(`/mentorship/requests/${requestId}/accept`, token, {
    method: 'POST',
  });
}

export async function declineRequest(token: string, requestId: string): Promise<MentorshipRequest> {
  return request<MentorshipRequest>(`/mentorship/requests/${requestId}/decline`, token, {
    method: 'POST',
  });
}

// ── US5: Mentorship pairs ──────────────────────────────────────────────
export async function getMyPairs(token: string): Promise<MentorshipPair[]> {
  return request<MentorshipPair[]>('/mentorship/pairs/mine', token, { method: 'GET' });
}

export async function endPair(token: string, pairId: string): Promise<MentorshipPair> {
  return request<MentorshipPair>(`/mentorship/pairs/${pairId}/end`, token, { method: 'POST' });
}

// ── US6: Messaging ─────────────────────────────────────────────────────
export async function getThread(token: string, pairId: string): Promise<Thread> {
  return request<Thread>(`/mentorship/pairs/${pairId}/messages`, token, { method: 'GET' });
}

export async function sendMessage(
  token: string,
  pairId: string,
  payload: SendMessagePayload
): Promise<Message> {
  return request<Message>(`/mentorship/pairs/${pairId}/messages`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

