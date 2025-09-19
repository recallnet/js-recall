import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import type { indexingEvents, stakeChanges, stakes } from "./defs.js";

export type StakeRow = InferSelectModel<typeof stakes>;
export type IndexingEvent = InferSelectModel<typeof indexingEvents>;
export type StakeChangeRow = InferSelectModel<typeof stakeChanges>;
export type StakeChangeInsert = InferInsertModel<typeof stakeChanges>;
