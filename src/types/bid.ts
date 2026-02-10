export interface PortfolioItem {
  id: string;
  title: string;
  description?: string;
  projectType?: string;
  completionDate?: string;
  imageUrls: string[];
  tags: string[];
}

export interface Review {
  id: string;
  contractorId: string;
  reviewerId?: string;
  rating: number;
  title?: string;
  content: string;
  isVerified: boolean;
  createdAt: string;
}

export interface ContractorProfile {
  id: string;
  companyName: string;
  representativeName: string;
  rating: number;
  reviewCount: number;
  completedProjects: number;
  experienceYears: number;
  portfolio: PortfolioItem[];
  recentReviews: Review[];
}

export type BidStatus = 'PENDING' | 'SELECTED' | 'REJECTED';

export interface BidInfo {
  id: string;
  estimateId: string;
  contractorId: string;
  contractor: ContractorProfile;
  bidAmount: number;
  discountRate?: number;
  estimatedDays: number;
  startAvailableDate: string;
  message?: string;
  attachments?: string[];
  status: BidStatus;
  createdAt: string;
}

// DB → 프론트엔드 변환
export function mapDbContractorProfile(db: Record<string, unknown>): ContractorProfile {
  const portfolio = (db.contractor_portfolio as Record<string, unknown>[] | undefined) || [];
  const reviews = (db.contractor_reviews as Record<string, unknown>[] | undefined) || [];
  const trades = (db.contractor_trades as Record<string, unknown>[] | undefined) || [];

  const totalExp = trades.length > 0
    ? Math.max(...trades.map((t) => (t.experience_years as number) || 0))
    : 0;

  return {
    id: db.id as string,
    companyName: (db.company_name as string) || '',
    representativeName: (db.contact_name as string) || '',
    rating: (db.rating as number) || 0,
    reviewCount: (db.total_reviews as number) || 0,
    completedProjects: (db.completed_projects as number) || 0,
    experienceYears: totalExp,
    portfolio: portfolio.map(mapDbPortfolio),
    recentReviews: reviews.map(mapDbReview),
  };
}

function mapDbPortfolio(db: Record<string, unknown>): PortfolioItem {
  return {
    id: db.id as string,
    title: (db.title as string) || '',
    description: db.description as string | undefined,
    projectType: db.project_type as string | undefined,
    completionDate: db.completion_date as string | undefined,
    imageUrls: (db.image_urls as string[]) || [],
    tags: (db.tags as string[]) || [],
  };
}

function mapDbReview(db: Record<string, unknown>): Review {
  return {
    id: db.id as string,
    contractorId: db.contractor_id as string,
    reviewerId: db.reviewer_id as string | undefined,
    rating: (db.rating as number) || 0,
    title: db.title as string | undefined,
    content: (db.content as string) || '',
    isVerified: (db.is_verified as boolean) || false,
    createdAt: db.created_at as string,
  };
}

export function mapDbBid(db: Record<string, unknown>): BidInfo {
  const contractor = db.specialty_contractors
    ? mapDbContractorProfile(db.specialty_contractors as Record<string, unknown>)
    : {
        id: db.contractor_id as string,
        companyName: '', representativeName: '', rating: 0,
        reviewCount: 0, completedProjects: 0, experienceYears: 0,
        portfolio: [], recentReviews: [],
      };

  return {
    id: db.id as string,
    estimateId: db.estimate_id as string,
    contractorId: db.contractor_id as string,
    contractor,
    bidAmount: (db.bid_amount as number) || 0,
    discountRate: db.discount_rate as number | undefined,
    estimatedDays: (db.estimated_days as number) || 0,
    startAvailableDate: (db.start_available_date as string) || '',
    message: db.message as string | undefined,
    attachments: db.attachments as string[] | undefined,
    status: mapBidStatus(db.status as string),
    createdAt: db.created_at as string,
  };
}

function mapBidStatus(s: string): BidStatus {
  switch (s) {
    case 'selected': return 'SELECTED';
    case 'rejected': return 'REJECTED';
    default: return 'PENDING';
  }
}

export const BID_STATUS_LABELS: Record<BidStatus, string> = {
  PENDING: '검토중',
  SELECTED: '선정',
  REJECTED: '미선정',
};

export const BID_STATUS_COLORS: Record<BidStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  SELECTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-gray-100 text-gray-500',
};
