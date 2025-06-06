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

export default function UpdateProfilePage() {
  const updateProfile = useUpdateProfile();
  const { isProfileUpdated } = useUserSession();
  const { redirect } = useRedirectTo("/profile");

  useEffect(() => {
    if (isProfileUpdated) {
      redirect();
    }
  }, [isProfileUpdated, redirect]);

  const handleUpdateProfile = async (data: UpdateProfileRequest) => {
    try {
      await updateProfile.mutateAsync(data);
      redirect();
    } catch (error) {
      console.error("Failed to update profile:", error);
    }
  };

  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <AuthGuard skeleton={<ProfileSkeleton />}>
        <BreadcrumbNav
          items={[
            { label: "HOME", href: "/competitions" },
            { label: "USER PROFILE" },
          ]}
        />
        <UpdateProfile onSubmit={handleUpdateProfile} />
      </AuthGuard>
    </Suspense>
  );
}
