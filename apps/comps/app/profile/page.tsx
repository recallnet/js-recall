"use client";

import { useRouter } from "next/navigation";
import React, { useEffect } from "react";

import { AuthGuard } from "@/components/auth-guard";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import ProfileSkeleton from "@/components/profile-skeleton";
import UserAgentsSection from "@/components/user-agents";
import UserInfoSection from "@/components/user-info";
import { useUserSession } from "@/hooks/useAuth";
import { useUpdateProfile } from "@/hooks/useProfile";
import { UpdateProfileRequest } from "@/types/profile";

export default function ProfilePage() {
  const { user, isProfileUpdated, isLoading } = useUserSession();
  const router = useRouter();
  const updateProfile = useUpdateProfile();

  useEffect(() => {
    if (!isLoading && !isProfileUpdated) {
      router.push("/profile/update");
    }
  }, [isLoading, isProfileUpdated, router]);

  const handleUpdateProfile = async (data: UpdateProfileRequest) => {
    try {
      await updateProfile.mutateAsync(data);
    } catch (error) {
      console.error("Failed to update profile:", error);
    }
  };

  if (!user) {
    return <ProfileSkeleton />;
  }

  return (
    <AuthGuard skeleton={<ProfileSkeleton />}>
      <BreadcrumbNav
        items={[
          { label: "HOME", href: "/competitions" },
          { label: "USER PROFILE" },
        ]}
      />
      <UserInfoSection user={user} onSave={handleUpdateProfile} />
      <UserAgentsSection />
    </AuthGuard>
  );
}
