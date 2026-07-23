import {
  type Applicant,
  type ApplicationResult,
  type ApplicationWithOpportunity,
  type MatchList,
  type Opportunity,
  type PostOpportunityPayload,
  type UpdateSkillsPayload,
} from '@/types/matching';

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
    throw { status: 0, message: 'SkillBridge matching service is currently unavailable. Please check your network connection.' };
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    let errMsg = body.message;
    if (!errMsg && Array.isArray(body.errors)) {
      errMsg = body.errors.map((e: any) => e.defaultMessage || e.message || JSON.stringify(e)).join(', ');
    }
    if (!errMsg || errMsg === 'Bad Request') {
      errMsg = body.error && body.error !== 'Bad Request' ? body.error : `Request failed (${res.status}). Please check all required fields.`;
    }
    throw { status: res.status, message: errMsg };
  }

  return res.json();
}

export async function postOpportunity(
  token: string,
  payload: PostOpportunityPayload
): Promise<Opportunity> {
  return request<Opportunity>('/matching/opportunities', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMatches(token: string): Promise<MatchList> {
  return request<MatchList>('/matching/opportunities', token, { method: 'GET' });
}

export async function apply(token: string, opportunityId: string): Promise<ApplicationResult> {
  return request<ApplicationResult>(`/matching/opportunities/${opportunityId}/apply`, token, {
    method: 'POST',
  });
}

export async function getApplications(token: string): Promise<ApplicationWithOpportunity[]> {
  return request<ApplicationWithOpportunity[]>('/matching/applications', token, { method: 'GET' });
}

export async function getSkills(token: string): Promise<string[]> {
  const res = await request<{ skills: string[] }>('/matching/profile/skills', token, {
    method: 'GET',
  });
  return res.skills;
}

export async function updateSkills(token: string, skills: string[]): Promise<string[]> {
  const payload: UpdateSkillsPayload = { skills };
  const res = await request<{ skills: string[] }>('/matching/profile/skills', token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return res.skills;
}

export async function getMyPostings(token: string): Promise<Opportunity[]> {
  return request<Opportunity[]>('/matching/opportunities/mine', token, { method: 'GET' });
}

export async function deactivate(token: string, opportunityId: string): Promise<Opportunity> {
  return request<Opportunity>(`/matching/opportunities/${opportunityId}/deactivate`, token, {
    method: 'POST',
  });
}

export async function getApplicants(token: string, opportunityId: string): Promise<Applicant[]> {
  return request<Applicant[]>(`/matching/opportunities/${opportunityId}/applications`, token, {
    method: 'GET',
  });
}



