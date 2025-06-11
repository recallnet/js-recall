import React, {useState, useEffect} from "react";
import {SquarePen} from "lucide-react";
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
  value: string;
  onSave: (newValue: string) => void;
  placeholder?: string;
  children: React.ReactNode;
}

export const EditAgentField: React.FC<EditAgentFieldProps> = ({
  title,
  value,
  onSave,
  placeholder = "",
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
      <div className="flex gap-3 items-center w-fit">
        {children}
        <div
          className="top-2 right-2 cursor-pointer bg-card/70 rounded-full p-1"
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
          <div className="mt-2 flex flex-col gap-2">
            <Input
              type="text"
              placeholder={placeholder}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button className="bg-transparent border border-gray-700 rounded text-gray-300 hover:bg-gray-900">
                Cancel
              </Button>
            </DialogClose>
            <Button
              className="bg-white text-black hover:bg-gray-200 rounded"
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

