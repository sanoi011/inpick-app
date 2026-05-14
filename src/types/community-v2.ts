/**
 * 커뮤니티 v2 타입 정의 (네이버 카페 스타일).
 * 가이드: inpick-community-naver-cafe-style-dev-plan-20260514.md
 *
 * 기존 src/types/community.ts는 mock data (gallery/library 등) 용.
 * 본 파일은 DB 연동 실제 게시판 시스템용.
 */

export type BoardType =
  | "notice"
  | "estimate_share"
  | "design_share"
  | "apartment"
  | "commercial"
  | "materials"
  | "contractor_qna"
  | "review"
  | "general";

export type PostType =
  | "general"
  | "estimate_share"
  | "design_share"
  | "contractor_qna"
  | "review"
  | "admin_notice";

export type PostStatus = "draft" | "pending_review" | "published" | "hidden" | "reported" | "deleted";
export type Visibility = "public" | "members_only";
export type AuthorRole = "consumer" | "contractor" | "verified_contractor" | "admin";

export type CommentType = "comment" | "contractor_opinion" | "admin_reply" | "quote_interest";

export type QuoteOfferStatus =
  | "submitted"
  | "accepted_by_consumer"
  | "rejected_by_consumer"
  | "hidden_by_admin"
  | "converted_to_rfq";

export type QuoteOfferType = "rough_opinion" | "range_estimate" | "site_visit_required" | "rfq_invite";

export interface CommunityBoardV2 {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  boardType: BoardType;
  sortOrder: number;
  isActive: boolean;
  isPublic: boolean;
  allowUserPosts: boolean;
  allowComments: boolean;
  allowContractorReplies: boolean;
  requireAdminApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityProfileV2 {
  userId: string;
  displayName: string;
  roleLabel: string;
  avatarUrl: string | null;
  bio: string | null;
  regionLabel: string | null;
  isContractor: boolean;
  isVerifiedContractor: boolean;
  postCount: number;
  commentCount: number;
}

export interface CommunityPostV2 {
  id: string;
  boardId: string | null;
  boardSlug?: string;
  boardName?: string;
  authorId: string | null;
  authorRole: AuthorRole;
  authorProfile?: CommunityProfileV2 | null;
  title: string;
  content: string;
  status: PostStatus;
  visibility: Visibility;
  postType: PostType;
  projectMode: string | null;
  publicSnapshotId: string | null;
  regionLabel: string | null;
  areaLabel: string | null;
  buildingType: string | null;
  businessType: string | null;
  tags: string[];
  viewCount: number;
  commentCount: number;
  likeCount: number;
  bookmarkCount: number;
  quoteOfferCount: number;
  isPinned: boolean;
  isNotice: boolean;
  isDeleted: boolean;
  convertedRfqAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityCommentV2 {
  id: string;
  postId: string;
  parentId: string | null;
  authorId: string | null;
  authorRole: AuthorRole;
  authorProfile?: CommunityProfileV2 | null;
  content: string;
  commentType: CommentType;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityQuoteOfferV2 {
  id: string;
  postId: string;
  contractorId: string | null;
  contractorUserId: string | null;
  contractorProfile?: CommunityProfileV2 | null;
  offerStatus: QuoteOfferStatus;
  offerType: QuoteOfferType;
  amountMin: number | null;
  amountMax: number | null;
  amountFixed: number | null;
  message: string;
  suggestedScope: Record<string, unknown>;
  assumptions: string[];
  exclusions: string[];
  adminReviewStatus: string;
  convertedRfqId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityShareVisibilityV2 {
  showTotalAmount: boolean;
  showTradeSummary: boolean;
  showDetailedLines: boolean;
  showBrandSku: boolean;
  showDesignImages: boolean;
}

// ─── DB row → 타입 변환 ──────────────────────────────────
export function mapDbBoard(row: Record<string, unknown>): CommunityBoardV2 {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    boardType: (row.board_type as BoardType) ?? "general",
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Boolean(row.is_active),
    isPublic: Boolean(row.is_public),
    allowUserPosts: Boolean(row.allow_user_posts),
    allowComments: Boolean(row.allow_comments),
    allowContractorReplies: Boolean(row.allow_contractor_replies),
    requireAdminApproval: Boolean(row.require_admin_approval),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function mapDbPost(row: Record<string, unknown>): CommunityPostV2 {
  return {
    id: row.id as string,
    boardId: (row.board_id as string | null) ?? null,
    authorId: (row.author_id as string | null) ?? null,
    authorRole: (row.author_role as AuthorRole) ?? "consumer",
    title: row.title as string,
    content: row.content as string,
    status: (row.status as PostStatus) ?? "published",
    visibility: (row.visibility as Visibility) ?? "public",
    postType: (row.post_type as PostType) ?? "general",
    projectMode: (row.project_mode as string | null) ?? null,
    publicSnapshotId: (row.public_snapshot_id as string | null) ?? null,
    regionLabel: (row.region_label as string | null) ?? null,
    areaLabel: (row.area_label as string | null) ?? null,
    buildingType: (row.building_type as string | null) ?? null,
    businessType: (row.business_type as string | null) ?? null,
    tags: (row.tags as string[]) ?? [],
    viewCount: Number(row.view_count ?? 0),
    commentCount: Number(row.comment_count ?? 0),
    likeCount: Number(row.like_count ?? 0),
    bookmarkCount: Number(row.bookmark_count ?? 0),
    quoteOfferCount: Number(row.quote_offer_count ?? 0),
    isPinned: Boolean(row.is_pinned),
    isNotice: Boolean(row.is_notice),
    isDeleted: Boolean(row.is_deleted),
    convertedRfqAt: (row.converted_rfq_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function mapDbComment(row: Record<string, unknown>): CommunityCommentV2 {
  return {
    id: row.id as string,
    postId: row.post_id as string,
    parentId: (row.parent_id as string | null) ?? null,
    authorId: (row.author_id as string | null) ?? null,
    authorRole: (row.author_role as AuthorRole) ?? "consumer",
    content: row.content as string,
    commentType: (row.comment_type as CommentType) ?? "comment",
    isDeleted: Boolean(row.is_deleted),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function mapDbQuoteOffer(row: Record<string, unknown>): CommunityQuoteOfferV2 {
  return {
    id: row.id as string,
    postId: row.post_id as string,
    contractorId: (row.contractor_id as string | null) ?? null,
    contractorUserId: (row.contractor_user_id as string | null) ?? null,
    offerStatus: (row.offer_status as QuoteOfferStatus) ?? "submitted",
    offerType: (row.offer_type as QuoteOfferType) ?? "rough_opinion",
    amountMin: row.amount_min != null ? Number(row.amount_min) : null,
    amountMax: row.amount_max != null ? Number(row.amount_max) : null,
    amountFixed: row.amount_fixed != null ? Number(row.amount_fixed) : null,
    message: row.message as string,
    suggestedScope: (row.suggested_scope as Record<string, unknown>) ?? {},
    assumptions: (row.assumptions as string[]) ?? [],
    exclusions: (row.exclusions as string[]) ?? [],
    adminReviewStatus: (row.admin_review_status as string) ?? "not_required",
    convertedRfqId: (row.converted_rfq_id as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export const DEFAULT_VISIBILITY_V2: CommunityShareVisibilityV2 = {
  showTotalAmount: true,
  showTradeSummary: true,
  showDetailedLines: false,
  showBrandSku: false,
  showDesignImages: true,
};

export const BOARD_TYPE_LABELS_V2: Record<BoardType, string> = {
  notice: "공지",
  estimate_share: "견적 공유",
  design_share: "디자인 공유",
  apartment: "아파트",
  commercial: "상가·사무실",
  materials: "자재 질문",
  contractor_qna: "업체에게 물어보기",
  review: "시공 후기",
  general: "일반",
};

export const POST_STATUS_LABELS_V2: Record<PostStatus, string> = {
  draft: "초안",
  pending_review: "검토 대기",
  published: "게시됨",
  hidden: "숨김",
  reported: "신고됨",
  deleted: "삭제됨",
};
