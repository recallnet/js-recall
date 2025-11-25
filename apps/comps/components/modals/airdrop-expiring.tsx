"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useMemo } from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";

import { Button } from "../staking/Button";

type AirdropExpiringModalProps = {
  isOpen: boolean;
  onClose: () => void;
  seasonName: string;
  expiresAt: Date;
  eligibleAmount: bigint;
};

/**
 * Modal displayed when a user has an airdrop claim that will expire soon
 */
export const AirdropExpiringModal: React.FC<AirdropExpiringModalProps> = ({
  isOpen,
  onClose,
  expiresAt,
}) => {
  const daysRemaining = useMemo(() => {
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  }, [expiresAt]);

  const timeText = useMemo(() => {
    if (daysRemaining === 0) {
      return "less than 1 day.";
    }
    if (daysRemaining === 1) {
      return "less than 1 day.";
    }
    return `${daysRemaining} days.`;
  }, [daysRemaining]);

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="w-full max-w-[500px] overflow-hidden rounded-2xl border border-[#383838] bg-[#070707] p-0">
        {/* Hidden title for accessibility */}
        <DialogTitle className="sr-only">Airdrop Expiring Soon</DialogTitle>

        <div className="flex flex-col items-center gap-12 overflow-hidden px-3 pb-3 pt-16">
          {/* Coin illustration with sparkles */}
          <div className="relative h-[200px] w-[200px]">
            {/* Sparkle decorations */}
            <Image
              src="/airdrop-sparkle.svg"
              alt=""
              width={48}
              height={48}
              className="absolute -left-2 top-3"
            />
            <Image
              src="/airdrop-sparkle.svg"
              alt=""
              width={34}
              height={34}
              className="absolute -left-8 top-[87px]"
            />
            <Image
              src="/airdrop-sparkle.svg"
              alt=""
              width={22}
              height={22}
              className="absolute right-6 top-0"
            />
            <Image
              src="/airdrop-sparkle.svg"
              alt=""
              width={19}
              height={19}
              className="absolute left-4 top-0"
            />

            {/* Main coin image */}
            <Image
              src="/airdrop-expiring-coins.png"
              alt="RECALL Coins"
              width={200}
              height={200}
              className="h-full w-full object-contain"
              priority
            />
          </div>

          {/* Text content */}
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <h2 className="text-gray-6 text-3xl font-bold">
                You&apos;re about to lose RECALL
              </h2>
              <p className="text-gray-5 max-w-[267px] text-base">
                You have an Airdrop Claim expiring in{" "}
                <span className="font-bold text-[#fcd569]">{timeText}</span>
                <br />
                Claim &amp; Stake now!
              </p>
            </div>
          </div>

          {/* Action button */}
          <Button asChild className="w-full">
            <Link href="/stake" onClick={onClose}>
              CLAIM &amp; STAKE
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
