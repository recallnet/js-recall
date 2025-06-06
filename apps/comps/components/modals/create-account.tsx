import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
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

interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  redirectTo: string;
}

export const CreateAccountModal: React.FC<CreateAccountModalProps> = ({
  isOpen,
  onClose,
  redirectTo,
}) => {
  const router = useRouter();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[600px]">
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center justify-start gap-2 text-xl font-bold text-white">
            <UserPlus className="size-6 text-gray-700" />
            Create Your Account
          </DialogTitle>
          <DialogDescription className="pl-8 text-gray-400">
            You need an account to use this feature.
          </DialogDescription>
          <p className="mt-[-0.5rem] pl-8 text-sm text-gray-500">
            You&apos;ll be asked to create an account.
          </p>
        </DialogHeader>

        <div className="border-t-1 border-gray-500"></div>

        <DialogFooter className="flex justify-end">
          <DialogClose asChild>
            <Button
              variant="outline"
              className="rounded-lg border-gray-700 bg-transparent text-gray-500 hover:bg-gray-900"
              onClick={() => onClose(false)}
            >
              Cancel
            </Button>
          </DialogClose>
          <div className="flex items-center">
            <Button
              onClick={() => {
                router.push(`/profile/update?redirectTo=${redirectTo}`);
                onClose(false);
              }}
              className="rounded-lg bg-white text-black hover:bg-gray-300"
            >
              Create Account
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateAccountModal;
