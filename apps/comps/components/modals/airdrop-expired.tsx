"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";

import { Button } from "../staking/Button";

type AirdropExpiredModalProps = {
  isOpen: boolean;
  onClose: () => void;
  airdropName: string;
  expiredAt: Date;
  eligibleAmount: bigint;
};

/**
 * Modal displayed when a user has an airdrop claim that has recently expired
 */
export const AirdropExpiredModal: React.FC<AirdropExpiredModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="w-full max-w-[403px] overflow-hidden rounded-2xl border border-[#383838] bg-[#070707] p-0">
        {/* Hidden title for accessibility */}
        <DialogTitle className="sr-only">Airdrop Claim Expired</DialogTitle>

        {/* Red gradient background */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse 200px 200px at center 51px, rgba(180, 40, 40, 0.6) 0%, rgba(7, 7, 7, 0) 100%)",
          }}
        />

        <div className="relative flex flex-col items-center gap-12 overflow-hidden px-3 pb-3 pt-16">
          {/* Blurred coin illustration */}
          <div className="relative h-[175px] w-[166px]">
            <Image
              src="/airdrop-expired-coin.png"
              alt="Expired RECALL Coin"
              width={166}
              height={175}
              className="h-full w-full object-contain opacity-80 blur-[2px]"
              priority
            />
          </div>

          {/* Text content */}
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <h2 className="text-gray-6 text-3xl font-bold">
                Your claim has expired
              </h2>
              <p className="text-gray-5 max-w-[327px] text-base">
                You were eligible for a round of Airdrop rewards, but you did
                not qualify in time.
              </p>
              <p className="text-gray-6 max-w-[327px] text-base">
                You can still become eligible for the next round.
              </p>
            </div>
          </div>

          {/* Action button */}
          <Button asChild className="w-full">
            <Link href="/stake" onClick={onClose}>
              CHECK ELIGIBILITY
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
