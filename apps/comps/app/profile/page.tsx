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
import { useSession } from "@/hooks/useSession";
import { UpdateProfileRequest } from "@/types/profile";

export default function ProfilePage() {
  const { ready, isPending, backendUser, updateBackendUser, linkWallet } =
    useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { data: agents, isLoading } = useUserAgents({ limit: 100 });

  useEffect(() => {
    if (!ready) return;
    // Only redirect when necessary; avoid pushing to the same route
    if (!isPending && !backendUser?.name && pathname !== "/profile/update") {
      router.push("/profile/update");
    }
  }, [ready, isPending, backendUser, pathname, router]);

  if (!ready || isLoading) {
    return <ProfileSkeleton />;
  }

  const handleUpdateProfile = async (data: UpdateProfileRequest) => {
    await updateBackendUser(data);
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
        user={backendUser!}
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
