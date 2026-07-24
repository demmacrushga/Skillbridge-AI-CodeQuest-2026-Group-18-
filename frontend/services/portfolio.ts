import {
  type CreatePortfolioItemPayload,
  type PortfolioItem,
  type ShareLinkResponse,
  type UpdatePortfolioItemPayload,
  type VerificationRequestResponse,
  type ExtractedItem,
  type BatchCreatePayload,
} from '@/types/portfolio';
import { DocumentPickerAsset } from 'expo-document-picker';

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
    throw { status: 0, message: 'SkillBridge portfolio service is currently unavailable. Please check your network connection.' };
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, message: body.message ?? body.error ?? `Request failed (${res.status})` };
  }

  return res.json();
}

export async function getMyPortfolio(accessToken: string): Promise<PortfolioItem[]> {
  return request<PortfolioItem[]>('/portfolio/mine', accessToken, { method: 'GET' });
}

export async function getPublicPortfolio(userId: string): Promise<PortfolioItem[]> {
  const res = await fetch(`${BASE_URL}/portfolio/${userId}`);
  if (!res.ok) {
    throw { status: res.status, message: 'Unable to fetch public portfolio from server.' };
  }
  return res.json();
}

export async function createPortfolioItem(
  accessToken: string,
  payload: CreatePortfolioItemPayload
): Promise<PortfolioItem> {
  return request<PortfolioItem>('/portfolio/items', accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updatePortfolioItem(
  accessToken: string,
  itemId: string,
  payload: UpdatePortfolioItemPayload
): Promise<PortfolioItem> {
  return request<PortfolioItem>(`/portfolio/items/${itemId}`, accessToken, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deletePortfolioItem(accessToken: string, itemId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/portfolio/items/${itemId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, message: body.message ?? body.error ?? 'Failed to delete portfolio item.' };
  }
}

export async function requestVerification(
  accessToken: string,
  itemId: string
): Promise<VerificationRequestResponse> {
  return request<VerificationRequestResponse>(
    `/portfolio/items/${itemId}/verify`,
    accessToken,
    { method: 'POST' }
  );
}

export async function generateShareLink(accessToken: string): Promise<ShareLinkResponse> {
  return request<ShareLinkResponse>('/portfolio/share', accessToken, { method: 'POST' });
}

export async function extractFromCV(
  accessToken: string,
  file: DocumentPickerAsset | { uri: string; name: string; mimeType?: string; type?: string }
): Promise<ExtractedItem[]> {
  const formData = new FormData();
  const f = file as any;
  formData.append('file', {
    uri: f.uri,
    name: f.name || 'resume.pdf',
    type: f.mimeType || f.type || 'application/pdf',
  } as any);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/portfolio/extract`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
  } catch (err) {
    throw { status: 0, message: 'SkillBridge portfolio AI service is currently unavailable. Please check your network connection.' };
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, message: body.message ?? body.error ?? 'Failed to extract portfolio points from CV.' };
  }
  return res.json();
}

export async function extractFromUrl(
  accessToken: string,
  url: string
): Promise<ExtractedItem[]> {
  return request<ExtractedItem[]>('/portfolio/extract-url', accessToken, {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export async function batchCreateItems(
  accessToken: string,
  payload: BatchCreatePayload
): Promise<PortfolioItem[]> {
  return request<PortfolioItem[]>('/portfolio/items/batch', accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}


