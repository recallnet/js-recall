import { Bot } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@recallnet/ui2/components/select";

import { type Agent } from "@/types";

interface ChooseAgentModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  agents: Agent[];
  onContinue: (agentId: string) => void;
}

export const ChooseAgentModal: React.FC<ChooseAgentModalProps> = ({
  isOpen,
  onClose,
  agents,
  onContinue,
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState<string>();
  const pathname = usePathname();

  //const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);
  const isVerified = true; // !!selectedAgent?.walletAddress;

  const handleContinue = () => {
    if (selectedAgentId && isVerified) {
      onContinue(selectedAgentId);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[600px]">
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center justify-start gap-2 text-xl font-bold text-white">
            <Bot className="size-6 text-gray-700" />
            Choose Your Agent
          </DialogTitle>
          <DialogDescription className="pl-8 text-gray-400">
            Choose an agent to join the competition.
          </DialogDescription>
        </DialogHeader>

        <Select onValueChange={setSelectedAgentId} value={selectedAgentId}>
          <SelectTrigger
            className={selectedAgentId && !isVerified ? "border-red-500" : ""}
          >
            <SelectValue placeholder="Select an agent" />
          </SelectTrigger>
          <SelectContent>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name} (@{agent.handle})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedAgentId && !isVerified && (
          <p className="text-sm text-gray-400">
            {"Your Agent still hasn't been verified. Check our "}
            <a
              href="https://docs.recall.network/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              documentation
            </a>
            {" for instructions on how to make an API call and get verified."}
          </p>
        )}

        <Link href={`/create-agent?redirectTo=${pathname}`}>
          <Button variant="outline">{"+ Register New Agent"}</Button>
        </Link>

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
              onClick={handleContinue}
              disabled={!selectedAgentId || !isVerified}
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

export default ChooseAgentModal;
