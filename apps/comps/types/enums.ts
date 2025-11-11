import type { CompetitionStatus as CompetitionStatusDB } from "@recallnet/db/repositories/types";

export type CompetitionStatus = CompetitionStatusDB;

export enum CrossChainTradingType {
  DisallowAll = "disallowAll",
  DisallowXParent = "disallowXParent",
  Allow = "allow",
}
