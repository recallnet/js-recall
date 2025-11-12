import { airdropClaims, claimStatus, merkleMetadata } from "./defs.js";

export type AirdropClaim = typeof airdropClaims.$inferSelect;
export type NewAirdropClaim = typeof airdropClaims.$inferInsert;
export type MerkleMetadata = typeof merkleMetadata.$inferSelect;
export type ClaimStatus = typeof claimStatus.$inferSelect;
