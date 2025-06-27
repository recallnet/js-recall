"use client";

import React from "react";

import { Button } from "@recallnet/ui/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui/components/shadcn/dialog";

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function UnsavedChangesModal({
  isOpen,
  onClose,
  onConfirm,
}: UnsavedChangesModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Unsaved Changes</DialogTitle>
          <DialogDescription className="text-gray-400">
            You have unsaved changes. Are you sure you want to leave? Your
            changes will be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Stay
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Leave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
