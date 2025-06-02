"use client";

import React from "react";

import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import ProfileSkeleton from "@/components/profile-skeleton";
import { UpdateProfile } from "@/components/update-profile";
import UserAgentsSection from "@/components/user-agents";
import UserInfoSection from "@/components/user-info";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { UpdateProfileRequest } from "@/types/profile";

export default function ProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  const handleUpdateProfile = async (data: UpdateProfileRequest) => {
    try {
      await updateProfile.mutateAsync(data);
    } catch (error) {
      console.error("Failed to update profile:", error);
    }
  };

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <>
      <BreadcrumbNav
        items={[
          { label: "HOME", href: "/competitions" },
          { label: "USER PROFILE" },
        ]}
      />
      {!profile?.name ? (
        <UpdateProfile onSubmit={handleUpdateProfile} />
      ) : (
        <>
          <UserInfoSection
            user={profile}
            isLoading={isLoading}
            onSave={handleUpdateProfile}
          />
          <UserAgentsSection />
        </>
      )}
    </>
  );
}
