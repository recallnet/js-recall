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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";
import { Skeleton } from "@recallnet/ui2/components/skeleton";
import { cn } from "@recallnet/ui2/lib/utils";

import { Identicon } from "../identicon/index";
import { ImageURLInput } from "../image-input/index";

interface ProfilePictureProps {
  image?: string;
  isLoading?: boolean;
  onSave?: (url: string) => Promise<void>;
  className?: string;
  /** User info for generating fallback display */
  fallbackData?: {
    walletAddress?: string;
    name?: string;
  };
  /** When true, disables editing functionality */
  readOnly?: boolean;
}

export const ProfilePicture: React.FC<ProfilePictureProps> = ({
  image,
  isLoading,
  onSave,
  className,
  fallbackData,
  readOnly = false,
}) => {
  const [showOverlay, setShowOverlay] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [imageValid, setImageValid] = useState(false);
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
    if (onSave) {
      await onSave(input);
    }
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
      <div className="flex flex-col items-center gap-1 px-2 py-4">
        <div className="flex items-center gap-2">
          <SquarePen size={16} className="text-secondary-foreground" />
          <span className="text-xs font-medium">Profile Picture URL</span>
        </div>
        <span className="text-secondary-foreground text-xs">
          Public PNG/JPEG
        </span>
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "group relative flex h-[256px] w-[256px] flex-col items-center justify-center overflow-hidden transition-all duration-300",
        isLoading && "animate-pulse",
        className,
      )}
      onMouseEnter={() => !readOnly && setShowOverlay(true)}
      onMouseLeave={() => !readOnly && setShowOverlay(false)}
      onTouchEnd={!readOnly ? handleTap : undefined}
      tabIndex={0}
      aria-label="Profile picture"
    >
      {isLoading ? (
        <Skeleton className="h-full w-full" />
      ) : (
        <Avatar className="h-full w-full">
          <AvatarImage
            src={url}
            alt="Profile picture"
            className="h-full w-full object-cover"
          />
          <AvatarFallback className="h-full w-full">
            <Identicon
              size={296}
              className="rounded-none"
              bgClassName="bg-muted"
              // Note: these are are in the same order as the navbar fallback identicon
              address={
                fallbackData?.walletAddress || fallbackData?.name || "User"
              }
            />
          </AvatarFallback>
        </Avatar>
      )}
      {!readOnly && overlay}
      {!readOnly && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Profile Picture URL</DialogTitle>
            </DialogHeader>
            <div className="mt-2 flex flex-col gap-2">
              <ImageURLInput
                id="profile-url"
                type="url"
                placeholder="https://example.com/avatar.png"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoFocus
                onValidationChange={setImageValid}
                sublabel={
                  <span className="text-secondary-foreground mt-1 text-xs">
                    Public PNG/JPG · Square ≥ 256 × 256 px
                  </span>
                }
              />
            </div>
            <DialogFooter className="mt-4">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                variant="modal"
                onClick={handleSave}
                disabled={!imageValid}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
