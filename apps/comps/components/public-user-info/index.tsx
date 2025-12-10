import Link from "next/link";
import { ReactNode } from "react";

import { PublicUserProfile } from "@/rpc/router/public-user/get-public-profile";
import { displayAddress } from "@/utils/address";

import { ProfilePicture } from "../user-info/ProfilePicture";

/**
 * Field label component for consistent styling
 */
const FieldLabel = ({ children }: { children: ReactNode }) => (
  <span className="text-foreground content-center text-sm font-semibold">
    {children}
  </span>
);

/**
 * Field value component for consistent styling
 */
const FieldValue = ({ children }: { children: ReactNode }) => (
  <div className="text-secondary-foreground flex content-center items-center gap-2">
    {children}
  </div>
);

interface PublicUserInfoSectionProps {
  user: PublicUserProfile;
}

/**
 * Public user info section component
 * Displays user profile information without sensitive data (name, email)
 * Used on public profile pages
 */
export default function PublicUserInfoSection({
  user,
}: PublicUserInfoSectionProps) {
  return (
    <div className="flex w-full rounded-xl border">
      <ProfilePicture
        image={user.imageUrl ?? undefined}
        className="w-90 my-auto hidden sm:block sm:rounded-l-xl"
        fallbackData={{
          walletAddress: user.walletAddress,
          name: undefined,
        }}
        readOnly
      />
      <div className="flex w-full flex-col items-start justify-center gap-2 p-4 sm:border-l">
        <div className="flex items-center gap-3">
          <h2 className="text-secondary-foreground text-2xl font-bold">
            Anonymous User
          </h2>
        </div>

        <div className="grid w-full auto-rows-[minmax(theme(spacing.8),auto)] grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
          {user.metadata?.website && (
            <>
              <FieldLabel>Website</FieldLabel>
              <FieldValue>
                <Link
                  href={user.metadata.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate underline hover:text-gray-300"
                >
                  {user.metadata.website}
                </Link>
              </FieldValue>
            </>
          )}

          <FieldLabel>Wallet address</FieldLabel>
          <FieldValue>
            <span className="text-secondary-foreground font-mono">
              {displayAddress(user.walletAddress)}
            </span>
          </FieldValue>
        </div>
      </div>
    </div>
  );
}
