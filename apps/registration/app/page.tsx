"use client";

import { Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useAccount } from "wagmi";

import { Button } from "@recallnet/ui/components/shadcn/button";

import AgentRegistrationForm, {
  AgentFormData,
} from "@/components/agent-registration-form";
import { useAuthContext } from "@/components/auth-provider";
import DeveloperProfileForm, {
  ProfileFormData,
} from "@/components/developer-profile-form";
import { SignInButton } from "@/components/sign-in-button";

/**
 * Homepage component for the registration application
 *
 * @returns The homepage with registration information and links
 */
export default function Home() {
  const { address } = useAccount();
  const { isAuthenticated, isLoading } = useAuthContext();
  const [registrationStep, setRegistrationStep] = useState<
    "welcome" | "profile" | "agent"
  >("welcome");
  const [profileData, setProfileData] = useState<ProfileFormData>({
    name: "",
    email: "",
    website: "",
  });
  const [agentData, setAgentData] = useState<AgentFormData>({
    name: "",
    primarySkill: "",
    customSkill: "",
    repoUrl: "",
    description: "",
    avatar: "",
    twitter: "",
    telegram: "",
  });

  // Handle next button from profile form
  const handleProfileNext = (data: ProfileFormData) => {
    console.log("Profile data:", data);
    setProfileData(data);
    setRegistrationStep("agent");
  };

  // Handle back button from profile form
  const handleProfileBack = () => {
    setRegistrationStep("welcome");
  };

  // Handle next button from agent form
  const handleAgentNext = (data: AgentFormData) => {
    console.log("Agent data:", data);
    setAgentData(data);
    // Here you would typically save both profile and agent data and proceed to next step
    // For now, we'll just log it
  };

  // Handle back button from agent form
  const handleAgentBack = () => {
    setRegistrationStep("profile");
  };

  // Handle skip button from agent form
  const handleAgentSkip = () => {
    console.log("Agent registration skipped");
    // Here you would typically save profile data only and proceed to next step
    // For now, we'll just log it
  };

  // Get the appropriate button based on auth state
  const getAuthButton = () => {
    if (!address) {
      return <SignInButton useCustomStyling={true} />;
    }

    if (isLoading) {
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

    if (!isAuthenticated) {
      return <SignInButton useCustomStyling={true} />;
    }

    return (
      <Button
        onClick={() => setRegistrationStep("profile")}
        className="w-full rounded-none bg-[#0057AD] py-5 transition-colors hover:bg-[#0066cc]"
      >
        <span className="font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-[#E9EDF1]">
          Complete Your Profile
        </span>
      </Button>
    );
  };

  // Render the main content
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#050507] py-8">
      <div className="container mx-auto flex max-w-6xl flex-col items-center justify-center px-4">
        {/* Conditionally render based on registration step */}
        {isAuthenticated && registrationStep === "profile" ? (
          <DeveloperProfileForm
            initialData={profileData}
            onBack={handleProfileBack}
            onNext={handleProfileNext}
          />
        ) : isAuthenticated && registrationStep === "agent" ? (
          <AgentRegistrationForm
            initialData={agentData}
            onBack={handleAgentBack}
            onNext={handleAgentNext}
            onSkip={handleAgentSkip}
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
