"use client";

import React from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@recallnet/ui2/components/breadcrumb";

import { BackButton } from "@/components/back-button";
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
      <div className="mb-5 flex items-center gap-4">
        <BackButton />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/competitions">HOME</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>USER PROFILE</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      {!profile?.name ? (
        <UpdateProfile onSubmit={handleUpdateProfile} />
      ) : (
        <>
          <UserInfoSection
            user={profile}
            isLoading={isLoading}
            onSave={handleUpdateProfile}
          />
          <UserAgentsSection user={profile} isLoading={isLoading} />
        </>
      )}
    </>
  );
}
