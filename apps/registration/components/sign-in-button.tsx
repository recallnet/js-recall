"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { LogOut } from "lucide-react";

import { Button } from "@recallnet/ui/components/shadcn/button";

import { useLogout, useUserSession } from "../hooks";

/**
 * SignIn button component that matches the comps app pattern exactly
 * Simple ConnectButton.Custom implementation without complex logout dialogs
 */
export function SignInButton() {
  const logout = useLogout();
  const session = useUserSession();

  const handleLogout = async () => {
    logout.mutate();
  };

  if (!session.isInitialized) {
    return null;
  }

  const { user } = session;

  // Show authenticated state with simple logout
  if (user) {
    return (
      <Button
        variant="outline"
        onClick={handleLogout}
        disabled={logout.isPending}
        className="w-full rounded-none border border-[#303846] bg-transparent py-5 transition-colors hover:bg-[#0e1218]"
      >
        <div className="flex items-center justify-center space-x-2">
          <LogOut className="h-4 w-4" />
          <span className="font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-[#596E89]">
            {logout.isPending
              ? "Logging Out..."
              : `Log Out (${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)})`}
          </span>
        </div>
      </Button>
    );
  }

  // Show connect/sign-in button using RainbowKit - matches comps app exactly
  return (
    <ConnectButton.Custom>
      {({ openConnectModal }) => (
        <Button
          onClick={openConnectModal}
          className="w-full rounded-none bg-[#0057AD] py-5 transition-colors hover:bg-[#0066cc]"
        >
          <span className="font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-[#E9EDF1]">
            Connect Wallet
          </span>
        </Button>
      )}
    </ConnectButton.Custom>
  );
}
