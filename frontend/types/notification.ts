export type NotificationType =
  | 'CHALLENGE_SCORED'
  | 'MENTORSHIP_REQUEST_RECEIVED'
  | 'MENTORSHIP_REQUEST_ACCEPTED'
  | 'MENTORSHIP_REQUEST_DECLINED'
  | 'MENTORSHIP_MESSAGE'
  | 'OPPORTUNITY_MATCH'
  | 'ROADMAP_MILESTONE'
  | 'SYSTEM';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface UnreadCount {
  unread: number;
}

export interface ReadAllResult {
  marked: number;
}

export interface PushToken {
  token: string;
  active: boolean;
  registeredAt: string;
}

export interface Preferences {
  pushEnabled: boolean;
  mutedTypes: NotificationType[];
}

export interface RegisterPushTokenPayload {
  token: string;
}

export interface UpdatePreferencesPayload {
  pushEnabled: boolean;
  mutedTypes: NotificationType[];
}
