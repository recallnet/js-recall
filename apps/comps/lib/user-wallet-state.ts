import { User } from "@/types";

export type UserWalletState =
  | { type: "only-embedded" }
  | {
      type: "external-linked";
      address: string;
      lastVerifiedAt: string;
    }
  | { type: "external-not-linked"; address: string }
  | { type: "unknown" };

export function userWalletState(user: User): UserWalletState {
  const { walletAddress, embeddedWalletAddress, walletLastVerifiedAt } = user;
  if (walletAddress !== embeddedWalletAddress && !walletLastVerifiedAt) {
    return {
      type: "external-not-linked",
      address: walletAddress,
    };
  } else if (walletAddress !== embeddedWalletAddress && walletLastVerifiedAt) {
    return {
      type: "external-linked",
      address: walletAddress,
      lastVerifiedAt: walletLastVerifiedAt,
    };
  } else if (walletAddress === embeddedWalletAddress) {
    return { type: "only-embedded" };
  } else {
    return { type: "unknown" };
  }
}
