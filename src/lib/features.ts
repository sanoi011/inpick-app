/**
 * Product exposure switches.
 *
 * Contractor bidding is intentionally kept in source, but hidden unless an
 * explicit deployment opts back in. This keeps the project/estimate tooling
 * available while the marketplace flow is paused.
 */
export const CONTRACTOR_BIDDING_ENABLED =
  process.env.NEXT_PUBLIC_CONTRACTOR_BIDDING_ENABLED === "true";

