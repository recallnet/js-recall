import { SquarePen } from "lucide-react";
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

interface EditAgentFieldProps {
  title: string;
  value: string;
  useTextarea?: boolean;
  onSave: (newValue: string) => void;
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

  const handleSave = async () => {
    onSave(inputValue);
    setLocalValue(inputValue);
    setDialogOpen(false);
  };

  useEffect(() => {
    if (dialogOpen) setInputValue(localValue);
  }, [dialogOpen, localValue]);

  return (
    <>
      <div className="flex w-full items-center gap-3">
        {children}
        <div
          className="bg-card/70 right-2 top-2 cursor-pointer rounded-full p-1"
          onClick={() => setDialogOpen(true)}
        >
          <SquarePen className="text-secondary-foreground" size={18} />
        </div>
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
              disabled={!inputValue || inputValue === localValue}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
