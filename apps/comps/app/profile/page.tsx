"use client";

import { usePathname, useRouter } from "next/navigation";
import React, { useEffect } from "react";

import { AuthGuard } from "@/components/auth-guard";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { FooterSection } from "@/components/footer-section";
import ProfileSkeleton from "@/components/profile-skeleton";
import UserAgentsSection from "@/components/user-agents";
import UserCompetitionsSection from "@/components/user-competitions";
import UserInfoSection from "@/components/user-info";
import UserVotesSection from "@/components/user-votes";
import { useUserAgents } from "@/hooks";
import { useUserSession } from "@/hooks/useAuth";
import { usePrivyAuth } from "@/hooks/usePrivyAuth";
import { useUpdateProfile } from "@/hooks/useProfile";
import { UpdateProfileRequest } from "@/types/profile";

export default function ProfilePage() {
  const session = useUserSession();
  const router = useRouter();
  const pathname = usePathname();
  const updateProfile = useUpdateProfile();
  const { linkWallet } = usePrivyAuth();
  const { data: agents, isLoading } = useUserAgents({ limit: 100 });

  useEffect(() => {
    if (!session.isInitialized) return;
    // Only redirect when necessary; avoid pushing to the same route
    if (
      !session.isLoading &&
      !session.isProfileUpdated &&
      pathname !== "/profile/update"
    ) {
      router.push("/profile/update");
    }
  }, [session, pathname, router]);

  if (!session.isInitialized || isLoading) {
    return <ProfileSkeleton />;
  }

  const handleUpdateProfile = async (data: UpdateProfileRequest) => {
    await updateProfile.mutateAsync(data);
  };

  const handleLinkWallet = async () => {
    linkWallet();
  };

  return (
    <AuthGuard skeleton={<ProfileSkeleton />}>
      <BreadcrumbNav
        items={[
          { label: "HOME", href: "/competitions" },
          { label: "USER PROFILE" },
        ]}
      />
      <UserInfoSection
        user={session.user!}
        onSave={handleUpdateProfile}
        onLinkWallet={handleLinkWallet}
      />
      <UserCompetitionsSection />
      <UserAgentsSection agents={agents?.agents || []} />
      <UserVotesSection />
      <FooterSection />
    </AuthGuard>
  );
}
