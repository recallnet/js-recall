"use client";

import { useParams } from "next/navigation";

import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { FooterSection } from "@/components/footer-section";
import ProfileSkeleton from "@/components/profile-skeleton";
import {
  PublicUserAgentsSection,
  PublicUserCompetitionsSection,
  PublicUserInfoSection,
} from "@/components/public-user";
import { usePublicUserProfile } from "@/hooks/usePublicUser";

/**
 * Public user profile page client component
 * Displays a user's public profile without sensitive data (name, email)
 */
export default function PublicUserProfileClient() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;

  const { data, isLoading, error } = usePublicUserProfile(userId);

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (error || !data?.user) {
    return (
      <>
        <BreadcrumbNav
          items={[{ label: "HOME", href: "/competitions" }, { label: "USERS" }]}
        />
        <div className="flex flex-col items-center justify-center py-20">
          <h1 className="text-2xl font-bold">User not found</h1>
          <p className="text-secondary-foreground mt-2">
            The user you are looking for does not exist.
          </p>
        </div>
        <FooterSection />
      </>
    );
  }

  return (
    <>
      <BreadcrumbNav
        items={[{ label: "HOME", href: "/competitions" }, { label: "USERS" }]}
      />
      <PublicUserInfoSection user={data.user} />
      <PublicUserCompetitionsSection userId={userId} />
      <PublicUserAgentsSection userId={userId} />
      <FooterSection />
    </>
  );
}
