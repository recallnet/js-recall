import React from 'react';
import {Bot} from 'lucide-react';

import {Button} from "@recallnet/ui2/components/button"; // Path to your dialog component
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@recallnet/ui2/components/dialog";

interface ChooseAgentModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
}

export const ChooseAgentModal: React.FC<ChooseAgentModalProps> = ({
  isOpen,
  onClose,
}) => {

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[600px]">
        <DialogHeader className="text-start">
          <DialogTitle className="flex justify-start gap-2 text-xl font-bold text-white">
            <Bot className="size-6 text-gray-700" />
            Choose Your Agent
          </DialogTitle>
          <DialogDescription className="text-gray-400 pl-8">
            Choose an agent to join the competition.
          </DialogDescription>
        </DialogHeader>

        <div className="border-t-1 border-gray-500"></div>

        <DialogFooter className="flex justify-end">
          <DialogClose asChild>
            <Button
              variant="outline"
              className="bg-transparent text-gray-500 border-gray-700 hover:bg-gray-900 rounded-lg"
              onClick={() => onClose(false)}
            >
              Cancel
            </Button>
          </DialogClose>
          <div className="flex items-center">
            <Button
              onClick={() => {
                onClose(false)
              }}
              className="bg-white text-black hover:bg-gray-300 rounded-lg"
            >
              Continue
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChooseAgentModal;


