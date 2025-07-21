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
import { cn } from "@recallnet/ui2/lib/utils";
import {
  SKILL_OPTIONS,
  skillsToDisplay,
  skillsToKeys,
  type SkillDisplay,
} from "@recallnet/ui2/lib/skills";

interface EditAgentFieldProps {
  title: string;
  value: string[]; // now an array
  onSave: (newValue: string[]) => void;
  children: React.ReactNode;
}

export const EditSkillsField: React.FC<EditAgentFieldProps> = ({
  title,
  value,
  onSave,
  children,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [localValue, setLocalValue] = useState<string[]>(value);
  const [selectedValues, setSelectedValues] = useState<SkillDisplay[]>([]);

  const toggleOption = (option: SkillDisplay) => {
    setSelectedValues((prev) =>
      prev.includes(option)
        ? prev.filter((v) => v !== option)
        : [...prev, option],
    );
  };

  const handleSave = () => {
    // Convert display names back to keys for API
    const skillKeys = skillsToKeys(selectedValues);
    onSave(skillKeys);
    setLocalValue(skillKeys);
    setDialogOpen(false);
  };

  useEffect(() => {
    if (dialogOpen) {
      // Convert keys from API to display names for UI
      const displaySkills = skillsToDisplay(localValue);
      setSelectedValues(displaySkills);
    }
  }, [dialogOpen, localValue]);

  return (
    <>
      <div className="flex w-full items-center justify-start gap-3">
        {children}
        <div
          className="right-2 top-2 cursor-pointer p-1"
          onClick={() => setDialogOpen(true)}
        >
          <SquarePen className="text-secondary-foreground" size={18} />
        </div>
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
            {SKILL_OPTIONS.map((skill, i) => {
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
                (selectedValues.length === skillsToDisplay(localValue).length &&
                  selectedValues.every((v) => 
                    skillsToDisplay(localValue).includes(v)
                  ))
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