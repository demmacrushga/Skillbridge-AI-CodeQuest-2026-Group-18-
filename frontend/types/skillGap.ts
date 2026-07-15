export interface RecommendationResponse {
  id: string;
  type: string;
  title: string;
  url: string | null;
}

export interface SkillGapItem {
  id: string;
  skillName: string;
  importanceRank: number;
  description: string;
  recommendations: RecommendationResponse[];
}

export interface GapReport {
  reportId: string;
  targetRole: string;
  gaps: SkillGapItem[];
  createdAt?: string;
}
