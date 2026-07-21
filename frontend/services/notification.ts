import {
  type Notification,
  type UnreadCount,
  type ReadAllResult,
  type PushToken,
  type Preferences,
  type RegisterPushTokenPayload,
  type UpdatePreferencesPayload,
} from '@/types/notification';

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

export async function getMyNotifications(token: string): Promise<Notification[]> {
  return request<Notification[]>('/notification', token, { method: 'GET' });
}

export async function getUnreadCount(token: string): Promise<UnreadCount> {
  return request<UnreadCount>('/notification/unread-count', token, { method: 'GET' });
}

export async function markRead(token: string, notificationId: string): Promise<Notification> {
  return request<Notification>(`/notification/${notificationId}/read`, token, { method: 'POST' });
}

export async function markAllRead(token: string): Promise<ReadAllResult> {
  return request<ReadAllResult>('/notification/read-all', token, { method: 'POST' });
}

export async function registerPushToken(
  token: string,
  payload: RegisterPushTokenPayload
): Promise<PushToken> {
  return request<PushToken>('/notification/push-tokens', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deregisterPushToken(
  token: string,
  payload: RegisterPushTokenPayload
): Promise<void> {
  const res = await fetch(`${BASE_URL}/notification/push-tokens`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, message: body.error ?? body.message ?? 'Request failed' };
  }
}

export async function getPreferences(token: string): Promise<Preferences> {
  return request<Preferences>('/notification/preferences', token, { method: 'GET' });
}

export async function updatePreferences(
  token: string,
  payload: UpdatePreferencesPayload
): Promise<Preferences> {
  return request<Preferences>('/notification/preferences', token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
