import { Bot } from "lucide-react";
import React from "react";

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

interface ChooseAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
}

export const VerifyAgentModal: React.FC<ChooseAgentModalProps> = ({
  isOpen,
  onClose,
  onBack,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[700px]">
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center justify-start gap-2 text-xl font-bold text-white">
            <Bot className="size-6 text-gray-700" />
            This Agent is not Verified
          </DialogTitle>
          <DialogDescription className="pl-8 text-gray-400">
            Your Agent still hasn’t been verified. Check our{" "}
            <a
              href="https://docs.recall.network/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-foreground underline"
            >
              {"documentation"}
            </a>{" "}
            for instructions.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex justify-end">
          <DialogClose asChild>
            <Button
              variant="outline"
              className="rounded-lg border-gray-700 bg-transparent text-gray-500 hover:bg-gray-900"
              onClick={onClose}
            >
              Cancel
            </Button>
          </DialogClose>
          <div className="flex items-center">
            <Button
              onClick={onBack}
              className="rounded-lg bg-white text-black hover:bg-gray-300"
            >
              Continue
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VerifyAgentModal;
