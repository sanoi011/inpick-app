/**
 * INPICK Analytics — 이벤트 이름 enum (단일 진실원).
 * 가이드: c:\Users\user\Downloads\inpick-commercial-scope-admin-analytics-dev-plan-20260512.md §4-4
 *
 * 변경 시 supabase/migrations/20260512100000_analytics_events.sql의 seed도 함께 갱신.
 */

export const AnalyticsEvents = {
  // Identity
  SessionStarted: "session_started",
  SignupStarted: "signup_started",
  SignupCompleted: "signup_completed",
  LoginCompleted: "login_completed",
  OAuthStarted: "oauth_started",
  OAuthCompleted: "oauth_completed",

  // Workflow
  WorkflowStarted: "workflow_started",
  ProjectModeSelected: "project_mode_selected",
  ProjectCreated: "project_created",
  AddressSearched: "address_searched",
  FloorplanSelected: "floorplan_selected",
  QuickPhotoStarted: "quick_photo_started",
  CommercialSpecSubmitted: "commercial_spec_submitted",
  CommercialZoneUpdated: "commercial_zone_updated",

  // AI chat / image
  ChatMessageSent: "chat_message_sent",
  ChatResponseCompleted: "chat_response_completed",
  ChatExtractCompleted: "chat_extract_completed",
  ImageGenerationRequested: "image_generation_requested",
  ImageGenerationCompleted: "image_generation_completed",
  ImageGenerationFailed: "image_generation_failed",

  // Editable render / materials
  EditableRenderAnalyzed: "editable_render_analyzed",
  SurfaceSelected: "surface_selected",
  MaterialSearchOpened: "material_search_opened",
  MaterialApplied: "material_applied",

  // 연구용 행동 데이터 (2026-07-05 연구소 요구 항목 — 자재/디자인 선택 행동)
  //   개인식별정보는 제외, 익명 ID·세션 기준 집계만.
  DesignConceptSelected: "design_concept_selected",   // 시안 선택(비교/변경 포함)
  DesignConceptCompared: "design_concept_compared",   // 두 시안 비교
  MaterialCategoryOpened: "material_category_opened",  // 자재 카테고리 진입
  MaterialSelected: "material_selected",               // 자재 확정(최초/변경/최종)
  MaterialCompared: "material_compared",               // 자재 비교
  ProductClicked: "product_clicked",                   // 실구매 상품 클릭
  ProductBookmarked: "product_bookmarked",             // 찜/저장
  EstimateShared: "estimate_shared",                   // 공유
  SatisfactionSubmitted: "satisfaction_submitted",     // 만족도·피드백

  // Scope / estimate
  CommercialScopeCreated: "commercial_scope_created",
  CommercialScopeUpdated: "commercial_scope_updated",
  EstimateReadinessChanged: "estimate_readiness_changed",
  EstimateRequested: "estimate_requested",
  EstimateGenerated: "estimate_generated",
  EstimateFailed: "estimate_failed",

  // RFQ / contract
  RfqCreated: "rfq_created",
  BidReceived: "bid_received",
  BidViewed: "bid_viewed",
  ContractorSelected: "contractor_selected",
  ContractCreated: "contract_created",

  // Contractor
  ContractorSignupCompleted: "contractor_signup_completed",
  ContractorBidViewed: "contractor_bid_viewed",
  ContractorBidSubmitted: "contractor_bid_submitted",
  DrawingPackageViewed: "drawing_package_viewed",
  ProjectUpdateUploaded: "project_update_uploaded",

  // Admin
  AdminLoginCompleted: "admin_login_completed",
  AdminPageViewed: "admin_page_viewed",
  AdminUserViewed: "admin_user_viewed",
  AdminActionExecuted: "admin_action_executed",
  AdminExportDownloaded: "admin_export_downloaded",
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

export type ActorType = "anonymous" | "consumer" | "contractor" | "admin" | "system";

export type ProjectModeForAnalytics = "apartment" | "photo_only" | "commercial";
