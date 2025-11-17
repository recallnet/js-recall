"use client";

import React, { useMemo } from "react";
import { useAccount } from "wagmi";

import { attoValueToNumberValue } from "@recallnet/conversions/atto-conversions";

import { Recall } from "@/components/Recall";
import { AgentAvatar } from "@/components/agent-avatar";
import { useClaim } from "@/hooks/useClaim";
import type { ClaimOperationResult } from "@/hooks/useClaim";
import { formatAmount } from "@/utils/format";

import { ClaimButton } from "./ClaimButton";
import { Heading } from "./Heading";

type Claim = ClaimOperationResult["claims"][number];
type FormattedClaim = Claim & {
  formattedAmount: string;
  amountBigInt: bigint;
};

export const Rewards: React.FunctionComponent = () => {
  const { address } = useAccount();
  const {
    claims,
    notYetActiveClaims,
    totalClaimable,
    isClaimDataLoading,
    claimDataError,
  } = useClaim();

  const formattedClaims = useMemo<FormattedClaim[]>(() => {
    if (!claims || claims.length === 0) {
      return [];
    }

    return claims.map((claim: Claim) => {
      const amountBigInt = BigInt(claim.amount);
      const amountNumber = attoValueToNumberValue(amountBigInt);
      const formattedAmount = amountNumber
        ? formatAmount(amountNumber, 5, true)
        : "0.00000";

      return {
        ...claim,
        formattedAmount,
        amountBigInt,
      };
    });
  }, [claims]);

  const totalFormatted = useMemo(() => {
    if (totalClaimable === 0n) {
      return "0.00000";
    }

    const totalNumber = attoValueToNumberValue(totalClaimable);
    return totalNumber ? formatAmount(totalNumber, 5, true) : "0.00000";
  }, [totalClaimable]);

  if (!address) {
    return null;
  }

  if (isClaimDataLoading) {
    return (
      <div className="mb-8">
        <Heading text1="Arena" text2="Rewards" className="mb-2" />
        <p className="mb-4 text-sm text-gray-400">Loading rewards...</p>
      </div>
    );
  }

  if (claimDataError) {
    return (
      <div className="mb-8">
        <Heading text1="Arena" text2="Rewards" className="mb-2" />
        <p className="mb-4 text-sm text-red-400">
          Error loading rewards: {claimDataError.message}
        </p>
      </div>
    );
  }

  if (formattedClaims.length === 0) {
    const hasScheduledRewards = (notYetActiveClaims ?? []).length > 0;

    return (
      <div className="mb-8">
        <Heading text1="Arena" text2="Rewards" className="mb-2" />
        <p className="mb-4 text-sm text-gray-400">
          {hasScheduledRewards
            ? "Rewards will be claimable once the release window opens."
            : "No rewards available yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="mb-8 flex flex-col gap-4">
      <Heading text1="Arena" text2="Rewards" />
      <div className="border-gray-4 bg-gray-2 flex flex-col gap-2 rounded-lg border p-2">
        {/* Table */}
        <div className="overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-2 sticky top-0 z-10">
                <tr>
                  <th className="text-gray-6 px-4 py-3 text-left text-sm">
                    Agent
                  </th>
                  <th className="text-gray-6 px-4 py-3 text-left text-sm">
                    Comp.
                  </th>
                  <th className="text-gray-6 px-4 py-3 text-right text-sm">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {formattedClaims.map((claim, index) => (
                  <tr key={`${claim.merkleRoot}-${index}`}>
                    <td className="text-gray-5 px-4 py-3">
                      {claim.agent ? (
                        <div className="flex min-w-0 items-center gap-3">
                          <AgentAvatar
                            agent={{
                              id: claim.agent.id,
                              name: claim.agent.name,
                              imageUrl: claim.agent.imageUrl,
                            }}
                            size={32}
                          />
                          <span className="min-w-0 truncate text-sm">
                            {claim.agent.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm">—</span>
                      )}
                    </td>
                    <td className="text-gray-5 px-4 py-3">
                      <span className="truncate text-sm">
                        {claim.competition.name}
                      </span>
                    </td>
                    <td className="text-gray-6 px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Recall size="sm" backgroundClass="bg-white" />
                        <span className="font-mono text-sm font-semibold">
                          {claim.formattedAmount}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Total Row */}
        <div className="bg-gray-4 mt-4 flex items-center justify-between rounded-xl p-6">
          <span className="text-gray-5 text-xl">Total Rewards</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3">
              <Recall size="sm" backgroundClass="bg-white" />
              <span className="text-gray-6 font-mono text-lg font-semibold">
                {totalFormatted}
              </span>
            </div>
            <ClaimButton />
          </div>
        </div>
      </div>
    </div>
  );
};
