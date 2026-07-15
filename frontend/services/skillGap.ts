import { DocumentPickerAsset } from 'expo-document-picker';
import { type GapReport } from '@/types/skillGap';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

async function request<T>(path: string, accessToken: string, options: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, message: body.message ?? body.error ?? 'Request failed' };
  }

  return res.json();
}

export async function analyseCV(
  token: string,
  asset: DocumentPickerAsset,
  targetRole: string
): Promise<GapReport> {
  const formData = new FormData();
  formData.append('file', {
    uri: asset.uri,
    name: asset.name,
    type: asset.mimeType ?? 'application/pdf',
  } as any);
  formData.append('targetRole', targetRole);

  // Do NOT set Content-Type — fetch sets the multipart boundary automatically
  return request<GapReport>('/skill-gap/analyse', token, {
    method: 'POST',
    body: formData,
  });
}

export async function getReports(token: string): Promise<GapReport[]> {
  return request<GapReport[]>('/skill-gap/reports', token, { method: 'GET' });
}

export async function getReport(token: string, reportId: string): Promise<GapReport> {
  return request<GapReport>(`/skill-gap/reports/${reportId}`, token, { method: 'GET' });
}

export async function deleteReport(token: string, reportId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/skill-gap/reports/${reportId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, message: body.error ?? body.message ?? 'Delete failed' };
  }
}
