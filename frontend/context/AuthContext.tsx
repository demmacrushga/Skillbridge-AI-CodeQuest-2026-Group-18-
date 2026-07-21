import React, { createContext, useContext, useEffect, useReducer } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import {
  login as apiLogin,
  register as apiRegister,
  refreshTokens,
  getMe,
  getStoredTokens,
  clearTokens,
  type LoginPayload,
  type RegisterPayload,
  type UserResponse,
} from '@/services/auth';
import { registerPushToken, deregisterPushToken } from '@/services/notification';

interface AuthState {
  user: UserResponse | null;
  accessToken: string | null;
  isLoading: boolean;
}

type AuthAction =
  | { type: 'LOADING' }
  | { type: 'AUTHENTICATED'; user: UserResponse; accessToken: string }
  | { type: 'UNAUTHENTICATED' };

function reducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOADING':
      return { ...state, isLoading: true };
    case 'AUTHENTICATED':
      return { user: action.user, accessToken: action.accessToken, isLoading: false };
    case 'UNAUTHENTICATED':
      return { user: null, accessToken: null, isLoading: false };
  }
}

interface AuthContextValue {
  state: AuthState;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    user: null,
    accessToken: null,
    isLoading: true,
  });

  useEffect(() => {
    async function rehydrate() {
      try {
        const { accessToken, refreshToken } = await getStoredTokens();
        if (!accessToken || !refreshToken) {
          dispatch({ type: 'UNAUTHENTICATED' });
          return;
        }
        try {
          const user = await getMe(accessToken);
          dispatch({ type: 'AUTHENTICATED', user, accessToken });
        } catch {
          const refreshed = await refreshTokens();
          dispatch({ type: 'AUTHENTICATED', user: refreshed.user, accessToken: refreshed.accessToken });
        }
      } catch {
        dispatch({ type: 'UNAUTHENTICATED' });
      }
    }
    rehydrate();
  }, []);

  async function registerPushTokenForUser(token: string) {
    try {
      const permission = await Notifications.requestPermissionsAsync() as { granted: boolean };
      if (!permission.granted) return;
      const expoToken = await Notifications.getExpoPushTokenAsync();
      await registerPushToken(token, { token: expoToken.data });
    } catch (err) {
      console.warn('[AuthContext] push token registration failed:', err);
    }
  }

  async function removePushTokenForUser(token: string) {
    try {
      const expoToken = await Notifications.getExpoPushTokenAsync();
      await deregisterPushToken(token, { token: expoToken.data });
    } catch (err) {
      console.warn('[AuthContext] push token deregistration failed:', err);
    }
  }

  async function login(payload: LoginPayload) {
    console.log('[AuthContext] login() called');
    const data = await apiLogin(payload);
    console.log('[AuthContext] login() success, user:', data.user.email);
    dispatch({ type: 'AUTHENTICATED', user: data.user, accessToken: data.accessToken });
    await registerPushTokenForUser(data.accessToken);
    router.replace('/(app)');
  }

  async function register(payload: RegisterPayload) {
    await apiRegister(payload);
    const data = await apiLogin({ email: payload.email, password: payload.password });
    dispatch({ type: 'AUTHENTICATED', user: data.user, accessToken: data.accessToken });
    await registerPushTokenForUser(data.accessToken);
    router.replace('/(app)');
  }

  async function logout() {
    if (state.accessToken) {
      await removePushTokenForUser(state.accessToken);
    }
    await clearTokens();
    dispatch({ type: 'UNAUTHENTICATED' });
    router.replace('/(auth)/welcome');
  }

  return (
    <AuthContext.Provider value={{ state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
