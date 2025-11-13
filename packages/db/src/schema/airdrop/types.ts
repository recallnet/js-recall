import { airdropAllocations, merkleMetadata, seasons } from "./defs.js";

export type AirdropAllocation = typeof airdropAllocations.$inferSelect;
export type NewAirdropAllocation = typeof airdropAllocations.$inferInsert;
export type MerkleMetadata = typeof merkleMetadata.$inferSelect;
export type Season = typeof seasons.$inferSelect;
export type NewSeason = typeof seasons.$inferInsert;
