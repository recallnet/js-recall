"use client";

import React from "react";

import { AuthGuard } from "@/components/auth-guard";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import ProfileSkeleton from "@/components/profile-skeleton";
import { UpdateProfile } from "@/components/update-profile";
import UserAgentsSection from "@/components/user-agents";
import UserInfoSection from "@/components/user-info";
import { useUserSession } from "@/hooks/useAuth";
import { useUpdateProfile } from "@/hooks/useProfile";
import { UpdateProfileRequest } from "@/types/profile";

export default function ProfilePage() {
  const { user } = useUserSession();
  const updateProfile = useUpdateProfile();

  const handleUpdateProfile = async (data: UpdateProfileRequest) => {
    try {
      await updateProfile.mutateAsync(data);
    } catch (error) {
      console.error("Failed to update profile:", error);
    }
  };

  return (
    <AuthGuard skeleton={<ProfileSkeleton />}>
      <BreadcrumbNav
        items={[
          { label: "HOME", href: "/competitions" },
          { label: "USER PROFILE" },
        ]}
      />
      {!user?.name ? (
        <UpdateProfile onSubmit={handleUpdateProfile} />
      ) : (
        <>
          <UserInfoSection user={user} onSave={handleUpdateProfile} />
          <UserAgentsSection />
        </>
      )}
    </AuthGuard>
  );
}
