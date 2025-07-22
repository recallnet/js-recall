"use client";

import { useRouter } from "next/navigation";
import React, { useEffect } from "react";

import { AuthGuard } from "@/components/auth-guard";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import ProfileSkeleton from "@/components/profile-skeleton";
import UserAgentsSection from "@/components/user-agents";
import UserCompetitionsSection from "@/components/user-competitions";
import UserInfoSection from "@/components/user-info";
import UserVotesSection from "@/components/user-votes";
import { useUserAgents } from "@/hooks";
import { useUserSession } from "@/hooks/useAuth";
import { useUpdateProfile } from "@/hooks/useProfile";
import { UpdateProfileRequest } from "@/types/profile";

export default function ProfilePage() {
  const session = useUserSession();
  const router = useRouter();
  const updateProfile = useUpdateProfile();
  const { data: agents, isLoading } = useUserAgents({ limit: 100 });

  useEffect(() => {
    if (!session.isInitialized) return;
    if (!session.isLoading && !session.isProfileUpdated) {
      router.push("/profile/update");
    }
  }, [session, router]);

  if (!session.isInitialized || isLoading) {
    return <ProfileSkeleton />;
  }

  const handleUpdateProfile = async (data: UpdateProfileRequest) => {
    await updateProfile.mutateAsync(data);
  };

  return (
    <AuthGuard skeleton={<ProfileSkeleton />}>
      <BreadcrumbNav
        items={[
          { label: "HOME", href: "/competitions" },
          { label: "USER PROFILE" },
        ]}
      />
      <UserInfoSection user={session.user!} onSave={handleUpdateProfile} />
      <UserCompetitionsSection />
      <UserAgentsSection agents={agents?.agents || []} />
      <UserVotesSection />
    </AuthGuard>
  );
}
