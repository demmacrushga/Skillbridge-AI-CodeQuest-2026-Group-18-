import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

console.log('[Auth] API base URL:', BASE_URL);

const KEYS = {
  accessToken: 'access_token',
  refreshToken: 'refresh_token',
} as const;

export type UserRole = 'STUDENT' | 'ALUMNI' | 'RECRUITER' | 'ADMIN';

export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  emailVerified: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserResponse;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface LoginPayload {
  email: string;
  password: string;
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  console.log(`[Auth] ${options.method ?? 'GET'} ${url}`);

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch (networkErr) {
    console.log('[Auth] Network error:', networkErr);
    throw { status: 0, message: 'SkillBridge server is currently unavailable. Please check your network connection.' };
  }

  console.log(`[Auth] Response ${res.status} ${res.statusText}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.log('[Auth] Error body:', body);
    throw { status: res.status, message: body.message ?? body.error ?? `Authentication request failed (${res.status})` };
  }

  return res.json();
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const normalizedPayload = {
    ...payload,
    email: payload.email.trim().toLowerCase(),
  };
  const data = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(normalizedPayload),
  });
  await SecureStore.setItemAsync(KEYS.accessToken, data.accessToken);
  await SecureStore.setItemAsync(KEYS.refreshToken, data.refreshToken);
  return data;
}

export async function register(payload: RegisterPayload): Promise<UserResponse> {
  const normalizedPayload = {
    ...payload,
    email: payload.email.trim().toLowerCase(),
  };
  return request<UserResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(normalizedPayload),
  });
}

export async function refreshTokens(): Promise<AuthResponse> {
  const refreshToken = await SecureStore.getItemAsync(KEYS.refreshToken);
  if (!refreshToken) throw { status: 401, message: 'No refresh token available' };

  const data = await request<AuthResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  await SecureStore.setItemAsync(KEYS.accessToken, data.accessToken);
  await SecureStore.setItemAsync(KEYS.refreshToken, data.refreshToken);
  return data;
}

export async function getMe(accessToken: string): Promise<UserResponse> {
  return request<UserResponse>('/auth/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function getStoredTokens() {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(KEYS.accessToken),
    SecureStore.getItemAsync(KEYS.refreshToken),
  ]);
  return { accessToken, refreshToken };
}

export async function clearTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.accessToken),
    SecureStore.deleteItemAsync(KEYS.refreshToken),
  ]);
}

export async function forgotPassword(email: string): Promise<void> {
  return request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
}



