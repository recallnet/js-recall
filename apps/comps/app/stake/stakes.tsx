"use client";

import React, { useState } from "react";

import { Button } from "@recallnet/ui2/components/button";

import StakeRecallModal from "@/components/modals/stake-recall";
import { ActiveStakes } from "@/components/staking/ActiveStakes";
import { ConvictionEligibility } from "@/components/staking/ConvictionEligibility";
import { ConvictionRewards } from "@/components/staking/ConvictionRewards";
import { InactiveStakes } from "@/components/staking/InactiveStakes";
import { Rewards } from "@/components/staking/Rewards";
import { StakeSummary } from "@/components/staking/StakeSummary";
import { StakeSkeleton } from "@/components/staking/stake-skeleton";
import { useUserStakes } from "@/hooks/staking";
import { useRecall } from "@/hooks/useRecall";
import { useSession } from "@/hooks/useSession";
import { useConviction } from "@/providers/conviction-provider";

import Landing from "./landing";

export default function Stakes() {
  const {
    isWalletConnected,
    isLoginToBackendPending,
    isUpdateBackendUserPending,
    isLinkWalletToBackendPending,
    user,
    backendUser,
  } = useSession();
  const { isConvictionEligible } = useConviction();
  const recall = useRecall();
  const { data: stakes, isLoading: stakesLoading } = useUserStakes();
  const [isStakeModalOpen, setIsStakeModalOpen] = useState(false);

  const hasBalance = !recall.isLoading && (recall.value ?? 0n) > 0n;
  const activeCount = stakes?.length ?? 0;
  const isLoading = recall.isLoading || stakesLoading;
  const hasBalanceNoStakes = hasBalance && activeCount === 0 && !isLoading;

  const pending =
    !user ||
    !backendUser ||
    isLoginToBackendPending ||
    isUpdateBackendUserPending ||
    isLinkWalletToBackendPending;

  if (pending) {
    return (
      <StakeSkeleton showConviction={true} showStakeToBoostCallout={true} />
    );
  } else if (!isWalletConnected) {
    return <Landing />;
  } else {
    return (
      <>
        <div className="mx-auto my-20 flex max-w-screen-xl flex-col gap-20 px-4 sm:px-6 lg:px-8">
          <StakeSummary onStakeClick={() => setIsStakeModalOpen(true)} />

          <ConvictionEligibility />

          {hasBalanceNoStakes && (
            <div className="mb-20">
              <div className="mb-10">
                <h2 className="text-primary-foreground mb-2 text-xl font-semibold">
                  Stake to get Boost!
                </h2>
                <p className="text-secondary-foreground text-sm">
                  It looks like you have some RECALL in your wallet - great!{" "}
                  <br />
                  Now, stake it so you can start getting Boost each competition.
                </p>
                <Button
                  onClick={() => setIsStakeModalOpen(true)}
                  className="mt-4"
                >
                  STAKE NOW
                </Button>
              </div>
            </div>
          )}

          <div className="flex max-h-[400px] flex-col gap-6 sm:flex-row">
            <div className="flex-1">
              <Rewards />
            </div>
            {isConvictionEligible && (
              <div className="flex-1">
                <ConvictionRewards />
              </div>
            )}
          </div>

          <ActiveStakes />

          <InactiveStakes />
        </div>

        {/* Stake Modal */}
        <StakeRecallModal
          isOpen={isStakeModalOpen}
          onClose={setIsStakeModalOpen}
        />
      </>
    );
  }
}
