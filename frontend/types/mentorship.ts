export interface AlumniProfile {
  id: string;
  userId: string;
  currentRole: string | null;
  company: string | null;
  industry: string | null;
  careerInterests: string[];
  bio: string | null;
  available: boolean;
  updatedAt: string;
}

export interface AlumniSearchEntry {
  alumniId: string;
  currentRole: string | null;
  company: string | null;
  industry: string | null;
  careerInterests: string[];
  bio: string | null;
  matchingTags: number;
  updatedAt: string;
}

export interface AlumniSearchResult {
  alumni: AlumniSearchEntry[];
}

export interface MentorshipRequest {
  id: string;
  studentId: string;
  alumniId: string;
  message: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  createdAt: string;
  respondedAt: string | null;
}

export interface MentorshipPair {
  id: string;
  studentId: string;
  alumniId: string;
  status: 'ACTIVE' | 'ENDED';
  startedAt: string;
  endedAt: string | null;
}

export interface Message {
  id: string;
  pairId: string;
  senderId: string;
  body: string;
  sentAt: string;
  readAt: string | null;
}

export interface Thread {
  pairId: string;
  status: 'ACTIVE' | 'ENDED';
  messages: Message[];
}

export interface UpsertProfilePayload {
  currentRole?: string;
  company?: string;
  industry?: string;
  careerInterests: string[];
  bio?: string;
  available: boolean;
}

export interface SendRequestPayload {
  alumniId: string;
  message?: string;
}

export interface SendMessagePayload {
  body: string;
}
