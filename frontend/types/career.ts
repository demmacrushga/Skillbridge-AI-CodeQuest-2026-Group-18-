export type MilestoneType = 'SKILL' | 'PROJECT' | 'CERT' | 'EXPERIENCE';

export interface CareerPath {
  id: string;
  name: string;
  description: string | null;
}

export interface Milestone {
  id: string;
  semester: number;
  title: string;
  description: string | null;
  type: MilestoneType;
  order: number;
  completed: boolean;
}

export interface Roadmap {
  roadmapId: string;
  careerPath: string;
  progressPercent: number;
  milestones: Milestone[];
}

export interface GenerateRoadmapPayload {
  careerPath: string;
  academicLevel: string;
  currentSkills: string[];
}

export interface CompleteMilestonePayload {
  evidenceNote?: string;
}

export interface CompletionResponse {
  milestone: Milestone;
  progressPercent: number;
}
