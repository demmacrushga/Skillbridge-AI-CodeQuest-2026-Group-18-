import {
  type InterviewSession,
  type InterviewQuestion,
  type SessionSummary,
  type StartSessionPayload,
  type SubmitAnswerPayload,
} from '@/types/mockInterview';

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

type TranscribeResponse = { transcript: string };

export async function transcribeAnswer(
  token: string,
  sessionId: string,
  questionId: string,
  audioUri: string,
  contentType: string,
): Promise<string> {
  const fd = new FormData();
  fd.append('audio', {
    uri: audioUri,
    name: 'answer.m4a',
    type: contentType,
  } as unknown as Blob);

  const res = await fetch(
    `${BASE_URL}/mock-interview/sessions/${sessionId}/questions/${questionId}/transcribe`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    },
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, message: body.error ?? body.message ?? 'Transcription failed' };
  }

  const data = (await res.json()) as TranscribeResponse;
  return data.transcript;
}

export async function startSession(
  token: string,
  payload: StartSessionPayload
): Promise<InterviewSession> {
  return request<InterviewSession>('/mock-interview/sessions', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function submitAnswer(
  token: string,
  sessionId: string,
  questionId: string,
  payload: SubmitAnswerPayload
): Promise<InterviewQuestion> {
  return request<InterviewQuestion>(
    `/mock-interview/sessions/${sessionId}/questions/${questionId}/answer`,
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function completeSession(
  token: string,
  sessionId: string
): Promise<InterviewSession> {
  return request<InterviewSession>(
    `/mock-interview/sessions/${sessionId}/complete`,
    token,
    { method: 'POST' }
  );
}

export async function getSessions(token: string): Promise<SessionSummary[]> {
  return request<SessionSummary[]>('/mock-interview/sessions', token, { method: 'GET' });
}

export async function getSession(token: string, sessionId: string): Promise<InterviewSession> {
  return request<InterviewSession>(`/mock-interview/sessions/${sessionId}`, token, {
    method: 'GET',
  });
}

export async function deleteSession(token: string, sessionId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/mock-interview/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, message: body.error ?? body.message ?? 'Delete failed' };
  }
}
