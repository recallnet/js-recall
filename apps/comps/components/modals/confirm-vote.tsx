import { Bot } from "lucide-react";
import React, { useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";
import { cn } from "@recallnet/ui2/lib/utils";

import { VerificationBadge } from "../verification-badge";

interface ConfirmVoteModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  agentName: string;
  onVote: () => Promise<void>;
  isLoading?: boolean;
}

export const ConfirmVoteModal: React.FC<ConfirmVoteModalProps> = ({
  isOpen,
  onClose,
  agentName,
  onVote,
  isLoading = false,
}) => {
  const [voted, setVoted] = useState(false);

  const handleVote = async () => {
    await onVote();
    setVoted(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          "w-130 h-[220px] transition-all duration-300 ease-in-out",
          voted && "h-[340px]",
        )}
      >
        {!voted ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-start gap-2 text-xl font-bold text-white">
                <Bot className="size-6 text-gray-700" />
                Confirm your Vote
              </DialogTitle>
              <DialogDescription className="pl-8 text-left text-gray-400">
                <span>
                  You&apos;re about to vote for{" "}
                  <span className="text-primary-foreground font-semibold">
                    {agentName}
                  </span>
                  .
                </span>
                <span className="mt-2 block">
                  You only have one vote per competition.
                </span>
              </DialogDescription>
            </DialogHeader>

            <hr />

            <DialogFooter className="flex flex-row items-end justify-end">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                onClick={handleVote}
                className="w-28 rounded-lg px-4 font-mono text-sm font-semibold"
                disabled={isLoading}
              >
                {isLoading ? "Voting..." : "Vote!"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogTitle hidden />
            <div className="relative flex w-full flex-col items-center justify-between">
              <video
                src="/confetti.webm"
                className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2"
                autoPlay
                muted
                playsInline
              />
              <video
                src="/vote.webm"
                className="mx-auto mb-2 h-32 w-32"
                autoPlay
                loop
                muted
                playsInline
              />
              <div className="flex w-full flex-col gap-2">
                <div className="flex items-center gap-2">
                  <VerificationBadge className="stroke-[var(--color-secondary-foreground)]" />
                  <span className="text-lg font-bold">You&apos;ve Voted!</span>
                </div>
                <div className="pl-8">
                  <span className="text-secondary-foreground">
                    You have successfully voted for{" "}
                    <span className="text-primary-foreground font-semibold">
                      {agentName}
                    </span>
                    .
                  </span>
                </div>
              </div>
              <hr className="w-full" />
              <DialogFooter className="flex w-full items-end">
                <DialogClose asChild>
                  <Button variant="outline">Close</Button>
                </DialogClose>
              </DialogFooter>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmVoteModal;
