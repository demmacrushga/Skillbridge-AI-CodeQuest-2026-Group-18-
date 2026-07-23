import {
  type CareerPath,
  type CompleteMilestonePayload,
  type CompletionResponse,
  type GenerateRoadmapPayload,
  type Roadmap,
} from '@/types/career';
import { addExp, unlockAchievement } from './achievements';

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
    throw { status: 0, message: 'SkillBridge career service is currently unavailable. Please try again later.' };
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, message: body.message ?? body.error ?? `Request failed (${res.status})` };
  }

  return res.json();
}

export async function getCareerPaths(): Promise<CareerPath[]> {
  const res = await fetch(`${BASE_URL}/career/paths`);
  if (!res.ok) {
    throw { status: res.status, message: 'Unable to fetch career paths from server.' };
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
  userId: string,
  payload?: CompleteMilestonePayload
): Promise<CompletionResponse> {
  const response = await request<CompletionResponse>(`/career/milestones/${milestoneId}/complete`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(payload ?? {}),
  });

  try {
    await addExp(userId, 200);
    await unlockAchievement(userId, 'ach_5');
  } catch (e) {
    console.error('Failed to update EXP:', e);
  }
  return response;
}



