import { BadgeCheckIcon } from "lucide-react";

import { Button } from "@recallnet/ui2/components/button";
import { Tooltip } from "@recallnet/ui2/components/tooltip";

import { Clipboard } from "@/components/clipboard";
import { ProfileResponse } from "@/types/profile";
import { displayAddress } from "@/utils/address";

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

  // User has not linked a custom wallet because the wallet address (custom)
  // and embedded wallet (given to every user upon creation) are the same. So,
  // we let them link any custom wallet.
  if (customWalletAddress === embeddedWalletAddress) {
    return (
      <div className="text-secondary-foreground flex min-h-[40px] flex-wrap items-center gap-4">
        <Button onClick={onLinkWallet}>Connect wallet</Button>
      </div>
    );
  }

  // User has linked a custom wallet, but they may or may not have verified it
  // yet (this accounts for the pre-Privy user wallet address). We let them link
  // any wallet, or if they have already linked a wallet, we show it.
  //
  // Note: currently, we only allow for linking wallets, which is why we use the
  // last verified at timestamp. i.e., if it's been verified, then it's been
  // linked / stored in the backend.
  const displayWalletAddress = displayAddress(user.walletAddress, {
    numChars: 6,
  });
  return (
    <>
      <Clipboard
        text={displayWalletAddress}
        textOnCopy={user.walletAddress}
        className="text-secondary-foreground text-md w-full rounded-[10px] hover:text-gray-300"
      />
      {/* If a user has a custom wallet address stored in the db, we need them to officially
         verify/link it. If it's already been verified, we show a badge. */}
      {walletLastVerifiedAt ? (
        <Tooltip content="Wallet connected">
          <BadgeCheckIcon
            className="text-green-500 hover:text-green-700"
            strokeWidth={1}
          />
        </Tooltip>
      ) : customWalletAddress !== embeddedWalletAddress ? (
        <Button onClick={onLinkWallet}>Verify wallet</Button>
      ) : (
        <Button onClick={onLinkWallet}>Connect wallet</Button>
      )}
    </>
  );
}
