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

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader className="text-start">
          <DialogTitle>Are you sure you want to leave?</DialogTitle>
          <DialogDescription>
            You have unsaved changes. If you leave now, you&apos;ll lose all
            your progress.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            className="rounded-lg border-red-500 text-red-500 hover:bg-red-500/10"
            onClick={onConfirm}
          >
            Leave
          </Button>
          <DialogClose asChild>
            <Button variant="modal" className="rounded-lg" onClick={onClose}>
              Stay and Continue
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
