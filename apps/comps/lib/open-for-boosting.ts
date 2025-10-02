import { RouterOutputs } from "@/rpc/router";

export function openForBoosting(competition: {
  status: RouterOutputs["competitions"]["listEnriched"]["competitions"][number]["status"];
  votingStartDate: Date | null;
  votingEndDate: Date | null;
}): boolean {
  if (competition.status !== "active" && competition.status !== "pending") {
    return false;
  }
  const now = new Date();
  if (!competition.votingStartDate || !competition.votingEndDate) {
    return false;
  }
  if (now < competition.votingStartDate || now > competition.votingEndDate) {
    return false;
  }
  return true;
}
