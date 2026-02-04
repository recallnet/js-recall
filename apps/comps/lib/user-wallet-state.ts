import type { RouterOutputs } from "@/rpc/router";

export type UserWalletState =
  | { type: "only-embedded" }
  | {
      type: "external-linked";
      address: string;
      lastVerifiedAt: string;
    }
  | { type: "external-not-linked"; address: string }
  | { type: "unknown" };

export function userWalletState(
  user: RouterOutputs["user"]["getProfile"],
): UserWalletState {
  const { walletAddress, embeddedWalletAddress, walletLastVerifiedAt } = user;

  // Wallet-first user: no embedded wallet
  if (!embeddedWalletAddress) {
    return {
      type: "external-linked",
      address: walletAddress,
      lastVerifiedAt:
        walletLastVerifiedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  if (walletAddress !== embeddedWalletAddress && !walletLastVerifiedAt) {
    return {
      type: "external-not-linked",
      address: walletAddress,
    };
  } else if (walletAddress !== embeddedWalletAddress && walletLastVerifiedAt) {
    return {
      type: "external-linked",
      address: walletAddress,
      lastVerifiedAt: walletLastVerifiedAt.toISOString(),
    };
  } else if (walletAddress === embeddedWalletAddress) {
    return { type: "only-embedded" };
  } else {
    return { type: "unknown" };
  }
}
