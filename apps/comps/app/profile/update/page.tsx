"use client";

import React, { Suspense, useEffect } from "react";

import { AuthGuard } from "@/components/auth-guard";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import ProfileSkeleton from "@/components/profile-skeleton";
import { UpdateProfile } from "@/components/update-profile";
import { useRedirectTo } from "@/hooks/useRedirectTo";
import { useSession } from "@/hooks/useSession";
import { UpdateProfileRequest } from "@/types/profile";

function UpdateProfileView() {
  const session = useSession();
  const { redirect } = useRedirectTo("/profile");

  useEffect(() => {
    if (session.ready && session.backendUser?.name) {
      redirect();
    }
  }, [session, redirect]);

  if (!session.ready) {
    return <ProfileSkeleton />;
  }

  const handleUpdateProfile = async (data: UpdateProfileRequest) => {
    await session.updateBackendUser(data);
    redirect();
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
