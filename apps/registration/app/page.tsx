"use client";

import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@recallnet/ui/components/shadcn/button";

import DeveloperProfileForm, {
  ProfileFormData,
} from "@/components/developer-profile-form";
import { SignInButton } from "@/components/sign-in-button";
import { useUserSession } from "@/hooks/useAuth";
import { removeLegacyWalletConnectLocalStorage } from "@/lib/utils";

/**
 * Homepage component for the registration application
 *
 * @returns The homepage with registration information and links
 */
export default function Home() {
  const session = useUserSession();
  const router = useRouter();
  const [registrationStep, setRegistrationStep] = useState<
    "welcome" | "profile"
  >("welcome");
  const [profileData, setProfileData] = useState<ProfileFormData>({
    name: "",
    email: "",
    website: "",
  });

  // Clean up legacy WalletConnect `localStorage` and old Recall testnet chain ID on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      removeLegacyWalletConnectLocalStorage(window.localStorage);
    }
  }, []);

  // Handle next button from profile form
  const handleProfileNext = (data: ProfileFormData) => {
    setProfileData(data);

    // Redirect directly to account page after profile completion
    router.push("/account");
  };

  // Handle back button from profile form
  const handleProfileBack = () => {
    setRegistrationStep("welcome");
  };

  // Get the appropriate button based on auth state
  const getAuthButton = () => {
    if (!session.isInitialized) {
      return (
        <Button
          className="w-full rounded-none bg-[#0057AD] py-5 transition-colors hover:bg-[#0066cc]"
          disabled
        >
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span className="font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-[#E9EDF1]">
            Loading...
          </span>
        </Button>
      );
    }

    if (!session.isAuthenticated) {
      return <SignInButton />;
    }

    if (session.isLoading) {
      return (
        <Button
          className="w-full rounded-none bg-[#0057AD] py-5 transition-colors hover:bg-[#0066cc]"
          disabled
        >
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span className="font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-[#E9EDF1]">
            Loading Profile...
          </span>
        </Button>
      );
    }

    return (
      <>
        {session.isProfileUpdated ? (
          <Button
            onClick={() => router.push("/account")}
            className="w-full rounded-none bg-[#0057AD] py-5 transition-colors hover:bg-[#0066cc]"
          >
            <span className="font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-[#E9EDF1]">
              Account
            </span>
          </Button>
        ) : (
          <Button
            onClick={() => setRegistrationStep("profile")}
            className="w-full rounded-none bg-[#0057AD] py-5 transition-colors hover:bg-[#0066cc]"
          >
            <span className="font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-[#E9EDF1]">
              Complete Your Profile
            </span>
          </Button>
        )}
        <div className="mt-4">
          <SignInButton />
        </div>
      </>
    );
  };

  // Render the main content
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#050507] py-8">
      <div className="container mx-auto flex max-w-6xl flex-col items-center justify-center px-4">
        {/* Conditionally render based on registration step */}
        {session.isInitialized &&
        session.isAuthenticated &&
        registrationStep === "profile" ? (
          <DeveloperProfileForm
            initialData={profileData}
            onBack={handleProfileBack}
            onNext={handleProfileNext}
          />
        ) : (
          <>
            {/* Hero image - improved centering */}
            <div className="mb-12 flex w-full items-center justify-center">
              <div className="relative flex h-[450px] w-full max-w-2xl items-center justify-center">
                <Image
                  src="/agents.png"
                  alt="Recall Agents"
                  fill
                  priority
                  className="mx-auto"
                  style={{
                    objectFit: "contain",
                    mixBlendMode: "screen",
                    objectPosition: "center center",
                  }}
                />
              </div>
            </div>

            {/* Content section */}
            <div className="flex w-full max-w-3xl flex-col items-center gap-14">
              {/* Title section */}
              <div className="text-center">
                <h1 className="mb-3 font-['Replica_LL',sans-serif] text-4xl font-bold text-[#E9EDF1] md:text-6xl">
                  Connect your Wallet
                </h1>
                <p className="mb-6 font-['Trim_Mono',monospace] text-xl font-semibold text-[#E9EDF1] md:text-2xl">
                  Developer & Agent Hub
                </p>
                <p className="mx-auto max-w-2xl font-['Replica_LL',sans-serif] text-lg tracking-wide text-[#596E89] md:text-xl">
                  Connect your wallet to access your API key, manage agents, and
                  join active competitions.
                </p>
              </div>

              {/* Button section */}
              <div className="flex w-full max-w-xl flex-col gap-5">
                <div className="w-full">{getAuthButton()}</div>
                <p className="text-center font-['Trim_Mono',monospace] text-sm tracking-wide text-[#596E89] md:text-base">
                  We use your Web3 wallet to verify your identity and protect
                  your API key.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
