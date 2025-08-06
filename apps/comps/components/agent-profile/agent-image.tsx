import { SquarePen } from "lucide-react";
import Image from "next/image";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";
import { cn } from "@recallnet/ui2/lib/utils";

import { ImageURLInput } from "../image-input/index";

export const AgentImage = ({
  agentImage,
  onSave,
}: {
  agentImage?: string;
  onSave: (imageUrl: string) => void;
}) => {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [image, setImage] = React.useState(
    agentImage || "/agent-placeholder.png",
  );
  const [inputImage, setInputImage] = React.useState("");
  const [invalidImage, setInvalidImage] = React.useState(false);

  const handleSave = async () => {
    onSave(inputImage);
    setImage(inputImage);
    setDialogOpen(false);
  };

  React.useEffect(() => {
    if (dialogOpen) setInputImage(inputImage);
  }, [dialogOpen, inputImage]);

  return (
    <>
      <div
        className="bg-card/70 group absolute z-10 flex h-full w-full cursor-pointer flex-col justify-end justify-center overflow-hidden opacity-0 transition-opacity duration-300 hover:opacity-100"
        onClick={() => setDialogOpen(true)}
      >
        <div className="bg-card flex h-1/4 w-full translate-y-20 flex-col items-center justify-start gap-1 px-3 pt-2 transition-all duration-700 group-hover:translate-y-0">
          <div className="flex items-center text-xs font-medium">
            <SquarePen className="mr-2 inline-block text-gray-500" size={17} />
            <span>Picture URL</span>
          </div>
          <span className="text-xs text-gray-500">Public image</span>
        </div>
      </div>

      <Image
        src={image}
        alt=""
        fill={!!agentImage}
        width={agentImage ? undefined : 50}
        height={agentImage ? undefined : 50}
        className={cn(agentImage ? "absolute z-0 object-cover" : "w-50 h-50")}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agent Picture URL</DialogTitle>
          </DialogHeader>
          <div className="mt-2 flex flex-col gap-2">
            <ImageURLInput
              id="profile-url"
              type="url"
              className="w-80"
              placeholder="https://example.com/avatar.png"
              value={inputImage}
              onChange={(e) => setInputImage(e.target.value)}
              autoFocus
              onValidationChange={setInvalidImage}
            />
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button className="rounded border bg-transparent text-gray-300 hover:bg-gray-900">
                Cancel
              </Button>
            </DialogClose>
            <Button
              className="rounded bg-white text-black hover:bg-gray-200"
              onClick={handleSave}
              disabled={!invalidImage}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
