import React from 'react';
import {UserPlus} from 'lucide-react';

import {Button} from "@recallnet/ui2/components/button"; // Path to your dialog component
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@recallnet/ui2/components/dialog";
import {useRouter} from 'next/navigation';

interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
}

export const CreateAccountModal: React.FC<CreateAccountModalProps> = ({
  isOpen,
  onClose,
}) => {
  const router = useRouter()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[600px]">
        <DialogHeader className="text-start">
          <DialogTitle className="flex justify-start gap-2 text-xl font-bold text-white">
            <UserPlus className="size-6 text-gray-700" />
            Create Your Account
          </DialogTitle>
          <DialogDescription className="text-gray-400 pl-8">
            You need an account to use this feature.
          </DialogDescription>
          <p className="text-sm text-gray-500 mt-[-0.5rem] pl-8">
            You’ll be asked to create an account.
          </p>
        </DialogHeader>

        <div className="border-t-1 border-gray-500"></div>

        <DialogFooter className="flex justify-end">
          <DialogClose asChild>
            <Button
              variant="outline"
              className="bg-transparent text-gray-500 border-gray-700 hover:bg-gray-900 rounded-lg"
              onClick={() => onClose(false)}
            >
              Cancel
            </Button>
          </DialogClose>
          <div className="flex items-center">
            <Button
              onClick={() => {
                router.push('/profile')
                onClose(false)
              }}
              className="bg-white text-black hover:bg-gray-300 rounded-lg"
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

