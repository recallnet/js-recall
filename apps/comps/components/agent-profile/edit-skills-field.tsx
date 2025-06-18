import {SquarePen} from "lucide-react";
import React, {useEffect, useState} from "react";
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

interface EditAgentFieldProps {
  title: string;
  value: string[]; // now an array
  onSave: (newValue: string[]) => void;
  children: React.ReactNode;
}

const OPTIONS = [
  {
    value: '',
    title: 'Crypto Trading',
  },
  {
    value: '',
    title: 'Trading Investing',
  },
  {
    value: '',
    title: 'Sports Betting',
  },
  {
    value: '',
    title: 'Prediction Market',
  },
  {
    value: '',
    title: 'Other',
  },
  {
    value: '',
    title: 'Social & Chat',
  },
  {
    value: '',
    title: 'Art & Video Creation',
  },
  {
    value: '',
    title: 'Art & Video Creation',
  },
  {
    value: '',
    title: 'Programming / Coding',
  },
  {
    value: '',
    title: 'Deep Research',
  },
]

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
        : [...prev, option]
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
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="min-w-70 mt-2 flex flex-col gap-3">
            {OPTIONS.map(({value, title}) => (
              <label
                key={value}
                className="flex items-center gap-2 text-sm text-gray-300"
              >
                <Input
                  type="checkbox"
                  checked={selectedValues.includes(value)}
                  onChange={() => toggleOption(value)}
                  className="accent-white"
                />
                {title}
              </label>
            ))}
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

