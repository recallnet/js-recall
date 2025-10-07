import React, { useEffect, useState } from "react";

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
import { Input } from "@recallnet/ui2/components/input";
import { Textarea } from "@recallnet/ui2/components/textarea";

import { EditButton } from "../edit-button";

interface EditAgentFieldProps {
  title: string;
  value: string;
  useTextarea?: boolean;
  onSave: (newValue: string) => Promise<void>;
  placeholder?: string;
  children: React.ReactNode;
}

export const EditAgentField: React.FC<EditAgentFieldProps> = ({
  title,
  value,
  onSave,
  placeholder = "",
  useTextarea = false,
  children,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [inputValue, setInputValue] = useState("");

  // Update localValue when the parent's value prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSave = async () => {
    try {
      await onSave(inputValue);
      // Only update local value and close dialog if save succeeds
      setLocalValue(inputValue);
      setDialogOpen(false);
    } catch {
      // Keep dialog open on error, the parent component will handle showing the error
      // Don't update localValue so it retains the last valid value
    }
  };

  useEffect(() => {
    if (dialogOpen) setInputValue(localValue);
  }, [dialogOpen, localValue]);

  return (
    <>
      <div className="flex w-full items-center gap-3">
        {children}
        <EditButton
          onClick={() => setDialogOpen(true)}
          className="right-2 top-2"
        />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogDescription className="hidden"></DialogDescription>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="min-w-70 mt-2 flex flex-col gap-2">
            {useTextarea ? (
              <Textarea
                placeholder={placeholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                autoFocus
              />
            ) : (
              <Input
                type="text"
                placeholder={placeholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                autoFocus
              />
            )}
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button className="text-secondary-foreground rounded border bg-transparent hover:bg-gray-900">
                Cancel
              </Button>
            </DialogClose>
            <Button
              className="rounded bg-white text-black hover:bg-gray-200"
              onClick={handleSave}
              disabled={!inputValue || inputValue === value}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
