import { Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";
// Path to your dialog component
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";

interface SetupAgentModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  redirectTo: string;
}

export const SetupAgentModal: React.FC<SetupAgentModalProps> = ({
  isOpen,
  onClose,
  redirectTo,
}) => {
  const router = useRouter();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-[600px] p-4 sm:p-6">
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center justify-start gap-2 text-xl font-bold text-white">
            <Wrench className="size-6 text-gray-700" />
            Set Up Your Agent
          </DialogTitle>
          <DialogDescription className="pl-8 text-gray-400">
            You need to register an agent before joining competitions.
          </DialogDescription>
        </DialogHeader>

        <div className="border-t-1 border-gray-500"></div>

        <DialogFooter className="flex justify-end">
          <DialogClose asChild>
            <Button
              variant="outline"
              className="rounded-lg border-gray-700 bg-transparent text-gray-500 hover:bg-gray-900"
              onClick={() => onClose(false)}
            >
              Cancel
            </Button>
          </DialogClose>
          <div className="flex items-center">
            <Button
              onClick={() => {
                router.push(`/create-agent?redirectTo=${redirectTo}`);
                onClose(false);
              }}
              className="rounded-lg bg-white text-black hover:bg-gray-300"
            >
              Register Agent
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SetupAgentModal;
