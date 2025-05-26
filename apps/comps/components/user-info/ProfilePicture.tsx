import { useClickAway } from "@uidotdev/usehooks";
import { SquarePen } from "lucide-react";
import React, { useState } from "react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@recallnet/ui2/components/avatar";
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
import { Input } from "@recallnet/ui2/components/shadcn/input";
import { Skeleton } from "@recallnet/ui2/components/skeleton";
import { cn } from "@recallnet/ui2/lib/utils";

interface ProfilePictureProps {
  image?: string;
  isLoading?: boolean;
  onSave: (url: string) => Promise<void>;
}

export const ProfilePicture: React.FC<ProfilePictureProps> = ({
  image,
  isLoading,
  onSave,
}) => {
  const [showOverlay, setShowOverlay] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [url, setUrl] = useState(image || "");
  const [input, setInput] = useState(image || "");
  const [tappedOnce, setTappedOnce] = useState(false);
  const overlayRef = useClickAway<HTMLDivElement>(() => {
    if (showOverlay) {
      setShowOverlay(false);
      setTappedOnce(false);
    }
  });

  // Reset input when dialog opens
  React.useEffect(() => {
    if (dialogOpen) setInput(url);
  }, [dialogOpen, url]);

  const handleSave = async () => {
    await onSave(input);
    setUrl(input);
    setDialogOpen(false);
  };

  // Mobile tap handler: first tap shows overlay, second tap opens dialog
  const handleTap = () => {
    if (!showOverlay) {
      setShowOverlay(true);
      setTappedOnce(true);
    } else if (tappedOnce) {
      setDialogOpen(true);
      setTappedOnce(false);
    }
  };

  // Overlay content
  const overlay = (
    <div
      ref={overlayRef}
      className={cn(
        "bg-card absolute bottom-0 left-0 flex w-full cursor-pointer flex-col items-center justify-end transition-all duration-300",
        showOverlay ? "z-10 opacity-100" : "pointer-events-none h-0 opacity-0",
      )}
      style={{ minHeight: showOverlay ? 80 : undefined }}
      onClick={() => setDialogOpen(true)}
      tabIndex={0}
      aria-label="Change profile picture"
    >
      <div className="flex flex-col items-center py-4">
        <span className="flex gap-2 text-sm font-medium">
          <SquarePen className="text-secondary-foreground mr-2 inline-block" />
          Profile Picture URL
        </span>
        <span className="text-secondary-foreground mt-1 text-xs">
          Public PNG/JPEG
        </span>
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "group relative flex h-[256px] w-[256px] flex-col items-center justify-center overflow-hidden border transition-all duration-300",
        isLoading && "animate-pulse",
      )}
      onMouseEnter={() => setShowOverlay(true)}
      onMouseLeave={() => setShowOverlay(false)}
      onTouchEnd={handleTap}
      tabIndex={0}
      aria-label="Profile picture"
    >
      {isLoading ? (
        <Skeleton className="h-full w-full" />
      ) : (
        <Avatar className="h-full w-full">
          <AvatarImage
            src={url || "/agent-placeholder.png"}
            alt="Profile picture"
            className="h-full w-full object-cover"
          />
        </Avatar>
      )}
      {overlay}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Profile Picture URL</DialogTitle>
          </DialogHeader>
          <div className="mt-2 flex flex-col gap-2">
            <Input
              id="profile-url"
              type="url"
              placeholder="https://example.com/avatar.png"
              value={input}
              onChange={(e) => setInput(e.target.value)}
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
              disabled={!input || input === url}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
