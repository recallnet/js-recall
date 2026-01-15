"use client";

import { ArrowDown } from "lucide-react";
import React, { useMemo, useState } from "react";
import { useAccount } from "wagmi";

import { Tooltip } from "@recallnet/ui2/components/tooltip";

import { Recall } from "@/components/Recall";
import { ConvictionStakeModal } from "@/components/modals/ConvictionStakeModal";
import { useConvictionClaims } from "@/hooks/useConvictionClaims";
import type { FormattedConvictionClaim } from "@/hooks/useConvictionClaims";

import { Button } from "./Button";
import { Heading } from "./Heading";

export const ConvictionRewards: React.FunctionComponent = () => {
  const { address } = useAccount();
  const [selectedClaim, setSelectedClaim] =
    useState<FormattedConvictionClaim | null>(null);

  const { claims, totalFormatted, isLoading, error } = useConvictionClaims();

  const sortedClaims = useMemo(() => {
    return [...claims].sort((a, b) => a.airdrop - b.airdrop);
  }, [claims]);

  const activeClaim = useMemo(
    () => sortedClaims.find((claim) => claim.type === "available"),
    [sortedClaims],
  );

  const handleClaim = (claimToClaim: FormattedConvictionClaim) => {
    if (claimToClaim.type !== "available") return;

    if (claimToClaim.airdrop === 0) {
      window.open("https://claim.recall.network/", "_blank");
      return;
    }

    setSelectedClaim(claimToClaim);
  };

  if (!address) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="mb-8">
        <Heading text1="Conviction" text2="Rewards" className="mb-2" />
        <p className="text-gray-5 mb-4 text-sm">Loading rewards...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8">
        <Heading text1="Conviction" text2="Rewards" className="mb-2" />
        <p className="mb-4 text-sm text-red-400">
          Error loading rewards: {error.message}
        </p>
      </div>
    );
  }

  if (claims.length === 0) {
    return (
      <div className="mb-8">
        <Heading text1="Conviction" text2="Rewards" className="mb-4" />
        <div className="border-gray-4 bg-gray-2 px-auto flex flex-col gap-2 rounded-2xl border px-6 py-8">
          <p className="text-gray-5 text-sm">No pending rewards.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <Heading text1="Conviction" text2="Rewards" />
      <div className="border-gray-4 bg-gray-2 flex h-full min-h-0 flex-col gap-2 rounded-2xl border p-2">
        {/* Table */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-2 sticky top-0 z-10">
                <tr>
                  <th className="text-gray-6 px-4 py-2 text-left text-sm">
                    Airdrop
                  </th>
                  <th className="text-gray-6 px-4 py-2 text-left text-sm">
                    Action
                  </th>
                  <th className="text-gray-6 px-4 py-2 text-left text-sm">
                    Status
                  </th>
                  <th className="text-gray-6 px-4 py-2 text-right text-sm">
                    Amount
                  </th>
                  <th className="text-gray-6 px-4 py-2 text-right text-sm"></th>
                </tr>
              </thead>
              <tbody>
                {sortedClaims.map((claim, index) => (
                  <ConvictionRewardRow
                    key={`${claim.airdrop}-${index}`}
                    claim={claim}
                    onClaim={() => handleClaim(claim)}
                    isProcessing={false}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Summary Bar */}
        {activeClaim ? (
          <div className="bg-gray-3 border-gray-4 flex items-center justify-between rounded-xl border p-3">
            <div className="flex items-center gap-2">
              <span className="text-gray-5 text-xl font-semibold">
                {activeClaim.airdropName}
              </span>
              <span
                className={`text-xl ${
                  activeClaim.type === "available"
                    ? "text-[#FCD569]"
                    : "text-gray-5"
                }`}
              >
                {activeClaim.statusText}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3">
                <Recall size="md" backgroundClass="bg-white" />
                <span className="text-gray-6 font-mono text-2xl font-bold">
                  {totalFormatted}
                </span>
              </div>
              <Button
                onClick={() => {
                  if (activeClaim) handleClaim(activeClaim);
                }}
                disabled={!activeClaim}
                className="group relative flex items-center justify-center overflow-hidden transition-all"
              >
                <span className="flex items-center">
                  <span className="w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover:w-[3.5rem] group-hover:opacity-100">
                    CLAIM
                  </span>
                  <ArrowDown className="h-4 w-4 shrink-0 transition-transform duration-300" />
                </span>
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <ConvictionStakeModal
        isOpen={!!selectedClaim}
        onClose={() => setSelectedClaim(null)}
        claim={selectedClaim}
      />
    </div>
  );
};

type ConvictionRewardRowProps = {
  claim: FormattedConvictionClaim;
  onClaim: () => void;
  isProcessing: boolean;
};

const ConvictionRewardRow: React.FunctionComponent<
  ConvictionRewardRowProps
> = ({ claim }) => {
  const actionTextColor = useMemo(() => {
    if (claim.type === "available") {
      return "text-[#FCD569]";
    }

    return "text-gray-5";
  }, [claim.type]);

  const statusTextColor = useMemo(() => {
    if (claim.type === "available") {
      return "text-[#FCD569]";
    }
    return "text-gray-5";
  }, [claim.type]);

  return (
    <tr>
      <td className="text-gray-5 px-4 py-2">
        <span className="text-sm">{claim.airdropName}</span>
      </td>
      <td className="text-gray-5 px-4 py-2">
        <span className={`text-sm ${actionTextColor}`}>{claim.actionText}</span>
      </td>
      <td className="text-gray-5 px-4 py-2">
        <Tooltip content={claim.tooltipText}>
          <span className={`cursor-help text-sm ${statusTextColor}`}>
            {claim.statusText}
          </span>
        </Tooltip>
      </td>
      <td className="text-gray-6 px-4 py-2 text-right">
        <div className="flex items-center justify-end gap-2">
          <Recall size="sm" backgroundClass="bg-white" />
          <span className="font-mono text-sm font-semibold">
            {claim.formattedAmount}
          </span>
        </div>
      </td>
    </tr>
  );
};
