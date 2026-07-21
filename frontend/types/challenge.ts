export interface Challenge {
  id: string;
  title: string;
  description: string;
  submissionFormat: string;
  deadline: string;
  active: boolean;
  createdAt: string;
  submissionCount: number | null;
}

export interface ChallengeListEntry {
  id: string;
  title: string;
  description: string;
  submissionFormat: string;
  deadline: string;
  createdAt: string;
  submitted: boolean;
}

export interface ChallengeList {
  challenges: ChallengeListEntry[];
}

export interface SubmissionResult {
  id: string;
  challengeId: string;
  submissionUrl: string;
  score: number | null;
  submittedAt: string;
}

export interface MySubmission {
  id: string;
  submissionUrl: string;
  score: number | null;
  submittedAt: string;
  challenge: Challenge;
}

export interface SubmissionReview {
  id: string;
  studentId: string;
  submissionUrl: string;
  score: number | null;
  submittedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  score: number;
}

export interface Leaderboard {
  challengeId: string;
  entries: LeaderboardEntry[];
}

export interface PostChallengePayload {
  title: string;
  description: string;
  submissionFormat: string;
  deadline: string;
}

export interface SubmitSolutionPayload {
  submissionUrl: string;
}

export interface ScoreSubmissionPayload {
  score: number;
}
