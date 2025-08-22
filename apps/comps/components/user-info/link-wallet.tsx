import { BadgeCheckIcon } from "lucide-react";

import { displayAddress } from "@recallnet/address-utils/display";
import { Button } from "@recallnet/ui2/components/button";
import { Tooltip } from "@recallnet/ui2/components/tooltip";

import { ProfileResponse } from "@/types/profile";

export default function LinkWallet({
  user,
  onLinkWallet,
}: {
  user: ProfileResponse["user"];
  onLinkWallet: () => void;
}) {
  const customWalletAddress = user.walletAddress;
  const embeddedWalletAddress = user.embeddedWalletAddress;
  const walletLastVerifiedAt = user.walletLastVerifiedAt;

  // Case 1: User has not linked a custom wallet, we let them link
  if (customWalletAddress === embeddedWalletAddress) {
    return (
      <div className="text-secondary-foreground flex min-h-[40px] flex-wrap items-center gap-4">
        <Button onClick={onLinkWallet}>Link wallet</Button>
      </div>
    );
  }

  return (
    <>
      <span className="text-secondary-foreground font-mono">
        {displayAddress(user.walletAddress)}
      </span>
      {walletLastVerifiedAt ? (
        <Tooltip
          content={<span className="text-green-500">Linked wallet</span>}
        >
          <BadgeCheckIcon
            className="text-green-500 hover:text-green-700"
            strokeWidth={1}
          />
        </Tooltip>
      ) : (
        <Tooltip
          content={<span className="text-gray-500">Wallet not linked</span>}
        >
          <BadgeCheckIcon
            className="text-gray-500 hover:text-gray-700"
            strokeWidth={1}
          />
        </Tooltip>
      )}
      {!walletLastVerifiedAt &&
        customWalletAddress !== embeddedWalletAddress && (
          <Button onClick={onLinkWallet}>Link wallet</Button>
        )}
    </>
  );
}
