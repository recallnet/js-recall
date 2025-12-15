import * as defs from "./defs.js";

/** Select type for eigenai.signature_submissions */
export type SelectSignatureSubmission =
  typeof defs.signatureSubmissions.$inferSelect;

/** Insert type for eigenai.signature_submissions */
export type InsertSignatureSubmission =
  typeof defs.signatureSubmissions.$inferInsert;

/** Select type for eigenai.agent_badge_status */
export type SelectAgentBadgeStatus = typeof defs.agentBadgeStatus.$inferSelect;

/** Insert type for eigenai.agent_badge_status */
export type InsertAgentBadgeStatus = typeof defs.agentBadgeStatus.$inferInsert;

/** Verification status enum values */
export const VERIFICATION_STATUS = defs.verificationStatus.enumValues;

/** Verification status union type */
export type VerificationStatus = (typeof VERIFICATION_STATUS)[number];
