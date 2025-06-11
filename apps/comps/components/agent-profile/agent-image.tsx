
import {SquarePen} from "lucide-react";
import React from "react";
import {Button} from "@recallnet/ui2/components/button";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";
import {Input} from "@recallnet/ui2/components/input";
import MirrorImage from "@/components/mirror-image";
import {useUpdateAgent} from "@/hooks";
import {Agent} from "@/types";

export const AgentImage = ({agent}: {agent: Agent}) => {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [image, setImage] = React.useState(
    agent?.imageUrl || "/agent-placeholder.png",
  );
  const [inputImage, setInputImage] = React.useState("");
  const updateAgent = useUpdateAgent();

  const handleSave = async () => {
    if (!agent) return;

    try {
      await updateAgent.mutateAsync({
        agentId: agent.id,
        params: {
          imageUrl: inputImage,
        },
      });
    } catch (error) {
      console.error("Failed to update agent:", error);
    }

    setImage(inputImage);
    setDialogOpen(false);
  };

  React.useEffect(() => {
    if (dialogOpen) setInputImage(inputImage);
  }, [dialogOpen, inputImage]);

  return (
    <>
      <MirrorImage image={image} width={160} height={160}>
        <div
          className="bg-card absolute flex h-full w-full cursor-pointer flex-col justify-center overflow-hidden rounded-full px-3 opacity-0 transition-all duration-300 hover:opacity-100"
          onClick={() => setDialogOpen(true)}
        >
          <div className="flex items-center gap-2 px-2 py-4">
            <SquarePen className="text-secondary-foreground mr-2 inline-block" />
            <span className="text-xs font-medium">Agent Picture URL</span>
          </div>
        </div>
      </MirrorImage>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agent Picture URL</DialogTitle>
          </DialogHeader>
          <div className="mt-2 flex flex-col gap-2">
            <Input
              id="profile-url"
              type="url"
              placeholder="https://example.com/avatar.png"
              value={inputImage}
              onChange={(e) => setInputImage(e.target.value)}
              autoFocus
            />
            <span className="text-secondary-foreground mt-1 text-xs">
              Public PNG/JPG · Square ≥ 256 × 256 px
            </span>
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="modal"
              onClick={handleSave}
              disabled={!inputImage || inputImage === image}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
