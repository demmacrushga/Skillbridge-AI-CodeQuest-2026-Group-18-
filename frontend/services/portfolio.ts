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

export async function getMyPortfolio(accessToken: string): Promise<PortfolioItem[]> {
  return request<PortfolioItem[]>('/portfolio/mine', accessToken, { method: 'GET' });
}

export async function getPublicPortfolio(userId: string): Promise<PortfolioItem[]> {
  const res = await fetch(`${BASE_URL}/portfolio/${userId}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, message: body.message ?? 'Failed to load portfolio' };
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
    throw { status: res.status, message: body.message ?? 'Failed to delete item' };
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
  file: DocumentPickerAsset
): Promise<ExtractedItem[]> {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType ?? 'application/pdf',
  } as any);

  const res = await fetch(`${BASE_URL}/portfolio/extract`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, message: body.message ?? 'Extraction failed' };
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
