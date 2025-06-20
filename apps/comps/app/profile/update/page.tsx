"use client";

import React, { Suspense, useEffect } from "react";

import { AuthGuard } from "@/components/auth-guard";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import ProfileSkeleton from "@/components/profile-skeleton";
import { UpdateProfile } from "@/components/update-profile";
import { useUserSession } from "@/hooks/useAuth";
import { useUpdateProfile } from "@/hooks/useProfile";
import { useRedirectTo } from "@/hooks/useRedirectTo";
import { UpdateProfileRequest } from "@/types/profile";

function UpdateProfileView() {
  const updateProfile = useUpdateProfile();
  const session = useUserSession();
  const { redirect } = useRedirectTo("/profile");

  useEffect(() => {
    if (session.isInitialized && session.isProfileUpdated) {
      redirect();
    }
  }, [session, redirect]);

  if (!session.isInitialized) {
    return <ProfileSkeleton />;
  }

  const handleUpdateProfile = async (data: UpdateProfileRequest) => {
    try {
      await updateProfile.mutateAsync(data);
      redirect();
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
      <UpdateProfile onSubmit={handleUpdateProfile} />
    </AuthGuard>
  );
}

export default function UpdateProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <UpdateProfileView />
    </Suspense>
  );
}
