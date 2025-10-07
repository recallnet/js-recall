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
import { cn } from "@recallnet/ui2/lib/utils";

import { EditButton } from "../edit-button";

interface EditAgentFieldProps {
  title: string;
  value: string[]; // now an array
  onSave: (newValue: string[]) => void;
  children: React.ReactNode;
}

const SKILLS = [
  "Crypto Trading",
  "Social and Chat",
  "Traditional Investing",
  "Art & Video Creation",
  "Sports Betting",
  "Programming / Coding",
  "Prediction Markets",
  "Deep Research",
  "Other",
];

export const EditSkillsField: React.FC<EditAgentFieldProps> = ({
  title,
  value,
  onSave,
  children,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [localValue, setLocalValue] = useState<string[]>(value);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);

  const toggleOption = (option: string) => {
    setSelectedValues((prev) =>
      prev.includes(option)
        ? prev.filter((v) => v !== option)
        : [...prev, option],
    );
  };

  const handleSave = () => {
    onSave(selectedValues);
    setLocalValue(selectedValues);
    setDialogOpen(false);
  };

  useEffect(() => {
    if (dialogOpen) setSelectedValues(localValue);
  }, [dialogOpen, localValue]);

  return (
    <>
      <div className="flex w-full items-center justify-start gap-3">
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
            <DialogTitle className="text-lg font-normal text-gray-400">
              {title}
            </DialogTitle>
            <div className="text-secondary-foreground text-sm font-normal">
              Choose all that apply.
            </div>
          </DialogHeader>
          <div className="min-w-70 mt-2 grid grid-cols-2 gap-x-10 gap-y-5">
            {SKILLS.map((skill, i) => {
              const selected = selectedValues.includes(skill);
              return (
                <label
                  key={i}
                  className={cn(
                    "text-md flex items-center gap-2",
                    selected ? "text-white" : "text-slate-500",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleOption(skill)}
                    className={cn(
                      "h-5 w-5",
                      selected ? "accent-white" : "accent-transparent",
                    )}
                  />
                  {skill}
                </label>
              );
            })}
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
              disabled={
                selectedValues.length === 0 ||
                (selectedValues.length === localValue.length &&
                  selectedValues.every((v) => localValue.includes(v)))
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
