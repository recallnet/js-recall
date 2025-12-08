import { RouterOutputs } from "@/rpc/router";

export function openForBoosting(competition: {
  status: RouterOutputs["competitions"]["list"]["competitions"][number]["status"];
  boostStartDate: Date | null;
  boostEndDate: Date | null;
}): boolean {
  if (competition.status !== "active" && competition.status !== "pending") {
    return false;
  }
  const now = new Date();
  if (!competition.boostStartDate || !competition.boostEndDate) {
    return false;
  }
  if (now < competition.boostStartDate || now > competition.boostEndDate) {
    return false;
  }
  return true;
}
