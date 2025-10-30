"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSwitchChain } from "wagmi";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";

import { SwitchChain } from "@/components/switch-chain";
import { useSafeAccount } from "@/hooks/useSafeWagmi";
import { config } from "@/config/public";

interface WrongNetworkModalProps {
  isOpen: boolean;
  currentChainId: number;
  expectedChainId: number;
}

/**
 * Modal that presents a wrong network warning and attempts to automatically
 * switch to the expected network when possible.
 */
export const WrongNetworkModal: React.FC<WrongNetworkModalProps> = ({
  isOpen,
  currentChainId,
  expectedChainId,
}) => {
  const { chain: currentChain, connector } = useSafeAccount();
  const { switchChainAsync } = useSwitchChain();

  const [showModal, setShowModal] = useState<boolean>(false);
  const [autoSwitching, setAutoSwitching] = useState<boolean>(false);
  const [autoSwitchErrorType, setAutoSwitchErrorType] = useState<
    "none" | "rejected" | "not_configured" | "failed" | "not_supported"
  >("none");
  const attemptedRef = useRef<boolean>(false);

  const expectedNetworkName = useMemo<string>(() => {
    // Expected chain comes from app configuration
    return config.blockchain.chain.name;
  }, []);

  const currentNetworkName = useMemo<string>(() => {
    if (currentChain?.name) return currentChain.name;
    return `Chain ID: ${currentChainId}`;
  }, [currentChain?.name, currentChainId]);

  function isUserRejected(error: unknown): boolean {
    if (typeof error === "object" && error !== null) {
      const e = error as Record<string, unknown>;
      const code = e["code"]; // EIP-1193 user rejected = 4001
      const name = e["name"];
      const message = e["message"];
      if (
        (typeof code === "number" && code === 4001) ||
        (typeof name === "string" && name.includes("UserRejected")) ||
        (typeof message === "string" && message.toLowerCase().includes("rejected"))
      ) {
        return true;
      }
    }
    return false;
  }

  function isChainNotConfigured(error: unknown): boolean {
    if (typeof error === "object" && error !== null) {
      const e = error as Record<string, unknown>;
      const name = typeof e["name"] === "string" ? (e["name"] as string) : "";
      const message =
        typeof e["message"] === "string" ? (e["message"] as string) : "";
      return (
        name.includes("ChainNotConfigured") ||
        name.includes("ChainNotConfiguredForConnector") ||
        message.toLowerCase().includes("chain not configured")
      );
    }
    return false;
  }

  useEffect(() => {
    // Attempt automatic network switch once when the modal logic mounts
    if (!isOpen) return;
    if (attemptedRef.current) return;

    attemptedRef.current = true;

    // If the connected wallet cannot programmatically switch, show modal
    const canProgrammaticallySwitch = Boolean(connector && (connector as unknown as { switchChain?: unknown }).switchChain !== undefined);
    if (!canProgrammaticallySwitch) {
      setAutoSwitchErrorType("not_supported");
      setShowModal(true);
      return;
    }

    setAutoSwitching(true);
    switchChainAsync({ chainId: expectedChainId })
      .then(() => {
        // Success: parent will stop rendering this component when chain changes
      })
      .catch((err: unknown) => {
        if (isUserRejected(err)) {
          setAutoSwitchErrorType("rejected");
        } else if (isChainNotConfigured(err)) {
          setAutoSwitchErrorType("not_configured");
        } else {
          setAutoSwitchErrorType("failed");
        }
        setShowModal(true);
      })
      .finally(() => setAutoSwitching(false));
  }, [connector, expectedChainId, isOpen, switchChainAsync]);

  // Hide dialog while auto switching to avoid flashing the modal
  if (!showModal || autoSwitching) {
    return null;
  }

  return (
    <Dialog open={isOpen && showModal} onOpenChange={() => {}}>
      <DialogContent
        className="w-full max-w-[600px] p-4 sm:p-6"
        showCloseButton={false}
      >
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center justify-start gap-2 text-xl font-bold text-white">
            <AlertTriangle className="size-6 text-yellow-500" />
            Wrong Network Connected
          </DialogTitle>
          <DialogDescription className="pl-8 text-gray-400">
            You need to switch to the correct network to continue.
          </DialogDescription>
          <p className="mt-[-0.5rem] pl-8 text-sm text-gray-500">
            Please switch to the expected network below.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
            <h4 className="mb-2 text-sm font-medium text-gray-300">
              Current Network:
            </h4>
            <div className="flex items-center justify-between">
              <div className="text-sm text-white">{currentNetworkName}</div>
              <span className="font-mono text-xs text-gray-400">
                Chain ID: {currentChainId}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
            <h4 className="mb-2 text-sm font-medium text-gray-300">
              Expected Network:
            </h4>
            <div className="flex items-center justify-between">
              <div className="text-sm text-white">{expectedNetworkName}</div>
              <span className="font-mono text-xs text-gray-400">
                Chain ID: {expectedChainId}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 text-sm text-gray-400">
            <ExternalLink className="mt-0.5 h-4 w-4" />
            <div className="space-y-1">
              {autoSwitchErrorType === "not_configured" && (
                <span>
                  The expected network is not configured in your wallet. Add it
                  in your wallet settings and try again.
                </span>
              )}
              {autoSwitchErrorType === "rejected" && (
                <span>
                  The switch request was rejected. Use the button below to try
                  again.
                </span>
              )}
              {autoSwitchErrorType === "not_supported" && (
                <span>
                  Your connected wallet does not support programmatic network
                  switching. Use the button below to switch.
                </span>
              )}
              {autoSwitchErrorType === "failed" && (
                <span>
                  Switching failed. Use the button below to try again.
                </span>
              )}
              {autoSwitchErrorType === "none" && (
                <span>
                  Click the button below to switch to the correct network.
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-3">
          <SwitchChain chainId={expectedChainId} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WrongNetworkModal;
