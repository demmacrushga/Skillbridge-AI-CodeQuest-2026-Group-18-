export interface PortfolioItem {
  id: string;
  userId: string;
  itemType: string;
  title: string;
  description: string | null;
  externalUrl: string | null;
  verified: boolean;
  verificationStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  displayOrder: number;
  createdAt: string;
}

export interface CreatePortfolioItemPayload {
  itemType: string;
  title: string;
  description?: string;
  externalUrl?: string;
}

export interface UpdatePortfolioItemPayload {
  title?: string;
  description?: string;
  externalUrl?: string;
  displayOrder?: number;
}

export interface VerificationRequestResponse {
  id: string;
  portfolioItemId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewerNote: string | null;
  reviewSource: string;
  requestedAt: string;
  reviewedAt: string | null;
}

export interface ShareLinkResponse {
  shareToken: string;
  shareUrl: string;
  active: boolean;
  createdAt: string;
}

export interface ExtractedItem {
  itemType: string;
  title: string;
  description: string | null;
  externalUrl: string | null;
  confidence: number;
}

export interface BatchCreatePayload {
  items: CreatePortfolioItemPayload[];
}
