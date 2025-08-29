import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import type {
  indexingEvents,
  stakeChanges,
  stakes,
} from "@/database/schema/indexing/defs.js";
import type { EventType } from "@/indexing/blockchain-types.js";

export type StakeRow = InferSelectModel<typeof stakes>;
export type IndexingEvent = InferSelectModel<typeof indexingEvents>;
export type StakeChangeRow = Omit<
  InferSelectModel<typeof stakeChanges>,
  "kind"
> & {
  kind: EventType;
};
export type StakeChangeInsert = Omit<
  InferInsertModel<typeof stakeChanges>,
  "kind"
> & {
  kind: EventType;
};
