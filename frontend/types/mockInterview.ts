export type Difficulty = 'ENTRY' | 'MID' | 'SENIOR';
export type SessionStatus = 'IN_PROGRESS' | 'COMPLETED';
export type Category = 'TECHNICAL' | 'BEHAVIORAL' | 'SITUATIONAL' | 'OTHER';

export interface InterviewQuestion {
  id: string;
  questionText: string;
  category: Category;
  orderIndex: number;
  userAnswer: string | null;
  score: number | null;
  feedback: string | null;
  answeredAt: string | null;
}

export interface InterviewSession {
  id: string;
  targetRole: string;
  difficulty: Difficulty;
  status: SessionStatus;
  overallScore: number | null;
  overallFeedback: string | null;
  createdAt: string;
  completedAt: string | null;
  questions: InterviewQuestion[];
}

export interface SessionSummary {
  id: string;
  targetRole: string;
  difficulty: Difficulty;
  status: SessionStatus;
  overallScore: number | null;
  createdAt: string;
}

export interface StartSessionPayload {
  targetRole: string;
  difficulty: Difficulty;
}

export interface SubmitAnswerPayload {
  answer: string;
}
