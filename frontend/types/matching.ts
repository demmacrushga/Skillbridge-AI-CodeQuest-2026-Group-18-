export type OpportunityType = 'INTERNSHIP' | 'ENTRY_LEVEL';

export interface SkillRequirement {
  skillName: string;
  required: boolean;
}

export interface Opportunity {
  id: string;
  title: string;
  companyName: string;
  description: string;
  location: string | null;
  opportunityType: OpportunityType;
  deadline: string | null;
  externalUrl: string | null;
  active: boolean;
  createdAt: string;
  requiredSkills: SkillRequirement[];
  applicantCount: number | null;
}

export interface Match {
  opportunity: Opportunity;
  matchScore: number;
  rank: number;
  applied: boolean;
}

export interface MatchList {
  matches: Match[];
}

export interface ApplicationResult {
  id: string;
  opportunityId: string;
  appliedAt: string;
  externalUrl: string | null;
}

export interface ApplicationWithOpportunity {
  id: string;
  appliedAt: string;
  opportunity: Opportunity;
}

export interface Applicant {
  studentId: string;
  appliedAt: string;
}

export interface PostOpportunityPayload {
  title: string;
  companyName: string;
  description: string;
  location?: string;
  opportunityType: OpportunityType;
  deadline?: string;
  externalUrl?: string;
  requiredSkills: SkillRequirement[];
}

export interface UpdateSkillsPayload {
  skills: string[];
}
