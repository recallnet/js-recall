
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

export const AgentImage = ({agentImage, onSave}: {agentImage: string; onSave: (imageUrl: string) => void}) => {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [image, setImage] = React.useState(
    agentImage
  );
  const [inputImage, setInputImage] = React.useState("");

  const handleSave = async () => {
    onSave(inputImage)
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
          className="group absolute flex h-full w-full cursor-pointer flex-col justify-center overflow-hidden rounded-full opacity-0 transition-opacity duration-300 hover:opacity-100 bg-card/70 justify-end"
          onClick={() => setDialogOpen(true)}
        >
          <div
            className="h-1/2 w-full translate-y-20 transition-all duration-700 group-hover:translate-y-0 flex flex-col items-center justify-start gap-1 bg-card px-3 pt-2"
          >
            <div className="flex items-center text-xs font-medium">
              <SquarePen className="text-gray-500 mr-2 inline-block" size={17} />
              <span>Picture URL</span>
            </div>
            <span className="text-gray-500 text-xs">Public image</span>
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
              <Button className='bg-transparent border border-gray-700 rounded text-gray-300 hover:bg-gray-900'>Cancel</Button>
            </DialogClose>
            <Button
              className="bg-white text-black hover:bg-gray-200 rounded"
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
