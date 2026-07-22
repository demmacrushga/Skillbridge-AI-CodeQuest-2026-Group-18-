import {
  type CareerPath,
  type CompleteMilestonePayload,
  type CompletionResponse,
  type GenerateRoadmapPayload,
  type Roadmap,
} from '@/types/career';

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
    throw { status: res.status, message: body.message ?? 'Request failed' };
  }

  return res.json();
}

export async function getCareerPaths(): Promise<CareerPath[]> {
  const res = await fetch(`${BASE_URL}/career/paths`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, message: body.message ?? 'Failed to load career paths' };
  }
  return res.json();
}

export async function generateRoadmap(
  accessToken: string,
  payload: GenerateRoadmapPayload
): Promise<Roadmap> {
  return request<Roadmap>('/career/roadmap/generate', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      role: payload.role ?? 'STUDENT',
    }),
  });
}

export async function getRoadmap(accessToken: string, userId: string): Promise<Roadmap> {
  return request<Roadmap>(`/career/roadmap/${userId}`, accessToken, {
    method: 'GET',
  });
}

export async function completeMilestone(
  accessToken: string,
  milestoneId: string,
  payload?: CompleteMilestonePayload
): Promise<CompletionResponse> {
  return request<CompletionResponse>(`/career/milestones/${milestoneId}/complete`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(payload ?? {}),
  });
}
