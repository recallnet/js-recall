"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@recallnet/ui2/components/button";

import { useSession } from "@/hooks/useSession";

export default function SignInOrConnectButton() {
  const { isAuthenticated, isWalletConnected, login, linkOrConnectWallet } =
    useSession();

  const router = useRouter();

  useEffect(() => {
    if (isWalletConnected) {
      router.refresh();
    }
  }, [isWalletConnected, router]);

  if (!isAuthenticated) {
    return (
      <Button size="lg" onClick={() => login()}>
        Sign in to start staking
      </Button>
    );
  }

  if (!isWalletConnected) {
    return (
      <Button size="lg" onClick={() => linkOrConnectWallet()}>
        Connect Wallet to start staking
      </Button>
    );
  }

  return null;
}
