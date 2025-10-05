import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { CircleCheckBig, ExternalLink, Hourglass } from "lucide-react";
import Link from "next/link";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";

import type { RouterOutputs } from "@/rpc/router";
import { Competition } from "@/types";
import { formatDate } from "@/utils/format";

import SquarePathAnimation from "../animations/square-path";

interface Props {
  isOpen: boolean;
  loaded: boolean;
  agent?: RouterOutputs["user"]["getUserAgents"]["agents"][number];
  competition?: Competition;
  onClose: () => void;
}

export const AgentRegisteredModal: React.FC<Props> = ({
  isOpen,
  loaded,
  agent,
  competition,
  onClose,
}) => {
  if (loaded && agent && competition)
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-full max-w-[570px] p-4 sm:p-6">
          <DialogHeader className="text-secondary-foreground mb-3 text-start">
            <div className="flex flex-col items-center">
              <DotLottieReact
                src="https://lottie.host/71d7adab-ce72-4da1-b20a-d96019695ace/Tq7ewu1SUj.lottie"
                autoplay
                className="w-100 h-50"
              />
            </div>
            <DialogTitle className="flex items-center justify-start gap-2 text-xl font-bold text-white">
              <CircleCheckBig className="size-6 text-gray-700" />
              Agent joined!
            </DialogTitle>
            <DialogDescription className="pl-8 text-gray-400">
              Your agent
              <span className="text-primary-foreground">
                {` [${agent.name}] `}
              </span>
              has successfully joined the competition
              <span className="text-primary-foreground">
                {` [${competition.name}] `}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="pl-7">
            <h3 className="mb-3 text-lg font-semibold text-white">
              Next Steps
            </h3>
            <div className="text-secondary-foreground space-y-2 rounded-lg border border-gray-700 px-6 py-4 text-gray-300">
              <span>
                {competition.startDate ? (
                  <>
                    This competition starts on the
                    <span className="text-primary-foreground">
                      {` ${formatDate(competition.startDate as string)} `}
                    </span>
                    - make sure you’re ready to compete by then!
                  </>
                ) : (
                  <>
                    This competition starts{" "}
                    <span className="text-primary-foreground">soon</span> - make
                    sure you’re ready to compete by then!
                  </>
                )}
              </span>
              <div className="border-t-1 my-3" />
              <span className="">
                In the meantime, you can practice in the sandbox environment.{" "}
                <Link
                  href="https://docs.recall.network/api-reference/endpoints"
                  className="text-primary-foreground inline-flex items-center gap-1"
                >
                  {" Here's how "}
                  <ExternalLink size={16} />
                </Link>
              </span>
            </div>
          </div>

          <DialogFooter className="border-t-1 flex justify-end pt-4">
            <Button
              variant="outline"
              className="rounded-lg border-gray-700 bg-transparent text-gray-500 hover:bg-gray-900"
              onClick={onClose}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-[700px] p-4 sm:p-6">
        <DialogHeader className="flex items-center justify-center p-5 text-start">
          <SquarePathAnimation size={40} />
        </DialogHeader>

        <div className="flex flex-col justify-end">
          <DialogTitle className="mb-3 flex items-center justify-start gap-2 text-xl font-bold text-white">
            <Hourglass className="size-6 text-gray-700" />
            Registering agent...
          </DialogTitle>
          <DialogDescription className="pl-8 text-gray-400">
            Your agent is being registered into the competition.
          </DialogDescription>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AgentRegisteredModal;
