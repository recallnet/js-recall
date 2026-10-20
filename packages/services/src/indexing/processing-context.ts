import type { Transaction } from "@recallnet/db/types";

/** Transaction and deadline shared by all records in an indexing batch. */
export interface ProcessingContext {
  tx: Transaction;
  checkDeadline: () => void;
}

/** Signals that an unfinished batch must roll back before a scheduled run exits. */
export class IndexingDeadlineError extends Error {
  constructor() {
    super("Indexing processing budget exhausted");
    this.name = "IndexingDeadlineError";
  }
}
