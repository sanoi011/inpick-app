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
