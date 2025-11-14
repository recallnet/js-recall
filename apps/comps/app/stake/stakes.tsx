"use client";

import React, { useState } from "react";

import { Button } from "@recallnet/ui2/components/button";

import StakeRecallModal from "@/components/modals/stake-recall";
import { ActiveStakes } from "@/components/staking/ActiveStakes";
import { InactiveStakes } from "@/components/staking/InactiveStakes";
import { StakeSummary } from "@/components/staking/StakeSummary";
import { StakeSkeleton } from "@/components/staking/stake-skeleton";
import { config } from "@/config/public";
import { useUserStakes } from "@/hooks/staking";
import { useRecall } from "@/hooks/useRecall";
import { useSession } from "@/hooks/useSession";

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
  const recall = useRecall();
  const { data: stakes, isLoading: stakesLoading } = useUserStakes();
  const [isStakeModalOpen, setIsStakeModalOpen] = useState(false);

  const hasBalance = !recall.isLoading && (recall.value ?? 0n) > 0n;
  const activeCount = stakes?.length ?? 0;
  const isLoading = recall.isLoading || stakesLoading;
  const isZeroState = !hasBalance && activeCount === 0 && !isLoading;
  const hasBalanceNoStakes = hasBalance && activeCount === 0 && !isLoading;

  const pending =
    !user ||
    !backendUser ||
    isLoginToBackendPending ||
    isUpdateBackendUserPending ||
    isLinkWalletToBackendPending;

  if (!config.publicFlags.tge) {
    return null;
  } else if (pending) {
    return <StakeSkeleton />;
  } else if (!isWalletConnected) {
    return <Landing />;
  } else {
    return (
      <>
        <div className="mx-auto my-20 max-w-screen-xl px-4 sm:px-6 lg:px-8">
          <StakeSummary onStakeClick={() => setIsStakeModalOpen(true)} />

          {isZeroState ? (
            <div className="mb-16">
              <div className="mb-10">
                <h2 className="text-primary-foreground mb-2 text-xl font-semibold">
                  Acquire RECALL to get started.
                </h2>
                <p className="text-secondary-foreground text-sm">
                  You need RECALL to Stake and start getting Boost.
                </p>
              </div>

              <div>
                <h2 className="text-primary-foreground mb-2 text-xl">
                  Active Stakes
                </h2>
                <p className="text-secondary-foreground text-sm">
                  No active stakes yet. Stake to earn Boost.
                </p>
              </div>
            </div>
          ) : hasBalanceNoStakes ? (
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

              <div>
                <h2 className="text-primary-foreground mb-2 text-xl">
                  Active Stakes
                </h2>
                <p className="text-secondary-foreground text-sm">
                  No active stakes yet. Stake to earn Boost.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Missing Out Section */}
              <div className="mb-20">
                <h2 className="text-primary-foreground mb-2 text-xl font-bold">
                  More Stakes = more Boost!
                </h2>
                <p className="text-secondary-foreground text-base">
                  With more RECALL, you can Boost your favorite agents even
                  further!
                </p>
              </div>

              <ActiveStakes />

              <hr className="my-8" />

              <InactiveStakes />
            </>
          )}
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
