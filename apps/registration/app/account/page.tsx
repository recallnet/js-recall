"use client";

import { ArrowLeft, Edit3, Plus, Save, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { displayAddress } from "@recallnet/address-utils/display";
import { toast } from "@recallnet/ui/components/toast";

import RecallLogo from "@/components/recall-logo";
import { useUserAgents } from "@/hooks/useAgents";
import { useUserSession } from "@/hooks/useAuth";
import { useCompetitions } from "@/hooks/useCompetitions";
import { useUpdateProfile } from "@/hooks/useProfile";
import { Competition } from "@/types/competition";

/**
 * Account page component
 *
 * Displays the user's profile information, registered agents, and available competitions
 *
 * @returns Account page component
 */
export default function AccountPage() {
  const session = useUserSession();
  const router = useRouter();
  const { data: agentsData, isLoading: agentsLoading } = useUserAgents();
  const {
    data: upcomingCompetitionsData,
    isLoading: upcomingCompetitionsLoading,
  } = useCompetitions({ status: "pending" });
  const updateProfileMutation = useUpdateProfile();

  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    imageUrl: "",
    website: "",
  });

  // Redirect to home if not authenticated
  useEffect(() => {
    if (session.isInitialized && !session.isAuthenticated) {
      router.push("/");
    }
  }, [session, router]);

  // Profile edit handlers
  const handleStartEditProfile = () => {
    if (session.isInitialized && session.user) {
      setIsEditingProfile(true);
      const metadata = session.user.metadata;
      setProfileForm({
        name: session.user.name || "",
        email: session.user.email || "",
        imageUrl: session.user.imageUrl || "",
        website:
          metadata &&
          typeof metadata === "object" &&
          "website" in metadata &&
          typeof metadata.website === "string"
            ? metadata.website
            : "",
      });
    }
  };

  const handleSaveProfile = async () => {
    if (!session.isInitialized || !session.user) return;

    try {
      await updateProfileMutation.mutateAsync({
        name: profileForm.name.trim() || undefined,
        email: profileForm.email.trim() || undefined,
        imageUrl: profileForm.imageUrl.trim() || undefined,
        metadata: {
          website: profileForm.website.trim() || undefined,
        },
      });

      toast("Profile updated successfully");
      setIsEditingProfile(false);
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast("Failed to update profile");
    }
  };

  const handleCancelEditProfile = () => {
    setIsEditingProfile(false);
    setProfileForm({
      name: "",
      email: "",
      imageUrl: "",
      website: "",
    });
  };

  // Show loading state
  if (!session.isInitialized || session.isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#050507] py-8">
        <div className="text-center">
          <div className="mb-4 text-2xl font-bold text-white">Loading...</div>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!session.isAuthenticated) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#050507] py-8">
        <div className="text-center">
          <div className="mb-4 text-2xl font-bold text-white">
            Please connect your wallet to view your account
          </div>
        </div>
      </div>
    );
  }

  const { user } = session;

  // When user is authenticated and profile is complete, show the account page
  return (
    <div className="flex min-h-screen w-full flex-col bg-[#050507] py-8">
      {/* Header section */}
      <div className="container mx-auto px-4 sm:px-8 md:px-12 lg:px-24 xl:px-36">
        <div className="flex w-full flex-col gap-8 md:gap-12">
          {/* Recall logo and header section */}
          <div className="flex flex-col gap-8 md:gap-12">
            <div className="flex items-center justify-between">
              <RecallLogo color="#D2D9E1" />
              <Link
                href="/"
                className="flex items-center gap-2 text-[#6D85A4] transition-colors hover:text-[#0057AD]"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider">
                  Back to Home
                </span>
              </Link>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
              <div className="flex flex-1 flex-col gap-3">
                <div>
                  <div className="flex items-center gap-4">
                    {user?.imageUrl && (
                      <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-[#1a1a1a] md:h-20 md:w-20">
                        <img
                          src={user.imageUrl}
                          alt={user.name || "Profile"}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <h1 className="font-['Replica_LL',sans-serif] text-3xl font-bold text-[#E9EDF1] md:text-4xl lg:text-5xl">
                      {user?.name || "Developer Profile"}
                    </h1>
                  </div>
                  {!isEditingProfile && (
                    <button
                      onClick={handleStartEditProfile}
                      className="mt-2 inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[#6D85A4] transition-colors hover:bg-[#1a1a1a] hover:text-[#0057AD]"
                      title="Edit profile"
                    >
                      <Edit3 className="h-3 w-3" />
                      Edit Profile
                    </button>
                  )}
                </div>

                {isEditingProfile ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#D2D9E1]">
                          Name
                        </label>
                        <input
                          type="text"
                          value={profileForm.name}
                          onChange={(e) =>
                            setProfileForm((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          placeholder="Enter your name..."
                          className="w-full rounded border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-[#6D85A4] focus:border-[#0057AD] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#D2D9E1]">
                          Email
                        </label>
                        <input
                          type="email"
                          value={profileForm.email}
                          onChange={(e) =>
                            setProfileForm((prev) => ({
                              ...prev,
                              email: e.target.value,
                            }))
                          }
                          placeholder="Enter your email..."
                          className="w-full rounded border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-[#6D85A4] focus:border-[#0057AD] focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#D2D9E1]">
                          Profile Image URL
                        </label>
                        <input
                          type="url"
                          value={profileForm.imageUrl}
                          onChange={(e) =>
                            setProfileForm((prev) => ({
                              ...prev,
                              imageUrl: e.target.value,
                            }))
                          }
                          placeholder="https://example.com/image.jpg"
                          className="w-full rounded border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-[#6D85A4] focus:border-[#0057AD] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#D2D9E1]">
                          Website
                        </label>
                        <input
                          type="url"
                          value={profileForm.website}
                          onChange={(e) =>
                            setProfileForm((prev) => ({
                              ...prev,
                              website: e.target.value,
                            }))
                          }
                          placeholder="https://your-website.com"
                          className="w-full rounded border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-[#6D85A4] focus:border-[#0057AD] focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveProfile}
                        disabled={updateProfileMutation.isPending}
                        className="flex items-center gap-1 rounded bg-[#0057AD] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0066cc] disabled:opacity-50"
                      >
                        <Save className="h-3 w-3" />
                        {updateProfileMutation.isPending ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={handleCancelEditProfile}
                        className="flex items-center gap-1 rounded border border-[#2a2a2a] px-3 py-1.5 text-xs font-medium text-[#D2D9E1] transition-colors hover:bg-[#1a1a1a]"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-['Replica_LL',sans-serif] text-sm text-[#6D85A4]">
                        {user?.email || "No email set"}
                      </span>
                    </div>
                    {user?.metadata &&
                      typeof user.metadata === "object" &&
                      "website" in user.metadata &&
                      typeof user.metadata.website === "string" && (
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#6D85A4]">
                            Website
                          </label>
                          <a
                            href={user.metadata.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-[#0057AD] hover:underline"
                          >
                            {user.metadata.website}
                          </a>
                        </div>
                      )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* User Agents Section */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-['Replica_LL',sans-serif] text-2xl font-bold text-[#E9EDF1]">
                Your Agents
              </h2>
              {agentsData && agentsData.agents.length > 0 && (
                <Link
                  href="/create-agent"
                  className="flex items-center gap-2 bg-[#0057AD] px-4 py-2 font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-white hover:bg-[#0066cc]"
                >
                  <Plus className="h-4 w-4" />
                  Add Agent
                </Link>
              )}
            </div>

            {agentsLoading ? (
              <div className="text-[#596E89]">Loading agents...</div>
            ) : agentsData && agentsData.agents.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {agentsData.agents.map((agent) => (
                  <Link
                    key={agent.id}
                    href={`/agents/${agent.id}`}
                    className="group cursor-pointer"
                  >
                    <div className="flex h-full flex-col rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-6 transition-all duration-200 hover:border-[#0057AD] hover:bg-[#0f0f0f]">
                      {/* Agent Avatar and Basic Info - Fixed height section */}
                      <div className="flex h-32 flex-col items-center justify-center gap-2">
                        <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-[#1a1a1a] group-hover:border-[#0057AD]">
                          {agent.imageUrl ? (
                            <img
                              src={agent.imageUrl}
                              alt={agent.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[#1a1a1a] text-[#596E89]">
                              {agent.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>

                        {/* Agent Name */}
                        <h3 className="line-clamp-2 text-center font-['Replica_LL',sans-serif] text-base font-semibold text-[#E9EDF1] group-hover:text-[#0057AD]">
                          {agent.name}
                        </h3>

                        {/* Wallet Address */}
                        <div className="min-h-[1rem] font-['Trim_Mono',monospace] text-xs text-[#6D85A4]">
                          {agent.walletAddress
                            ? displayAddress(agent.walletAddress)
                            : ""}
                        </div>
                      </div>

                      {/* Agent Description - Fixed height section */}
                      <div className="mt-2 h-16">
                        {agent.description ? (
                          <p className="line-clamp-3 text-sm text-[#596E89]">
                            {agent.description}
                          </p>
                        ) : (
                          <div className="h-full"></div>
                        )}
                      </div>

                      {/* Agent Skills - Fixed height section */}
                      <div className="mt-2 h-16">
                        {agent.skills && agent.skills.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {agent.skills.slice(0, 3).map((skill) => (
                              <span
                                key={skill}
                                className="rounded bg-[#1a1a1a] px-2 py-1 text-xs text-[#D2D9E1]"
                              >
                                {skill}
                              </span>
                            ))}
                            {agent.skills.length > 3 && (
                              <span className="rounded bg-[#1a1a1a] px-2 py-1 text-xs text-[#6D85A4]">
                                +{agent.skills.length - 3} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="h-full"></div>
                        )}
                      </div>

                      {/* Agent Stats - Fixed position */}
                      <div className="mt-4 flex justify-between text-xs">
                        <div className="text-center">
                          <div className="font-semibold text-[#E9EDF1]">
                            {agent.stats?.completedCompetitions || 0}
                          </div>
                          <div className="text-[#6D85A4]">Competitions</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-[#E9EDF1]">
                            {agent.stats?.totalTrades || 0}
                          </div>
                          <div className="text-[#6D85A4]">Trades</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-[#E9EDF1]">
                            {agent.stats?.bestPlacement?.rank || "N/A"}
                          </div>
                          <div className="text-[#6D85A4]">Best Rank</div>
                        </div>
                      </div>

                      {/* View Details Link - Fixed position */}
                      <div className="mt-4 text-center">
                        <span className="text-xs text-[#0057AD] group-hover:underline">
                          View Details & API Key →
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="mb-4 text-[#596E89]">
                  No agents registered yet.
                </div>
                <Link
                  href="/create-agent"
                  className="bg-[#0057AD] px-6 py-3 font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-white hover:bg-[#0066cc]"
                >
                  Register Your First Agent
                </Link>
              </div>
            )}
          </div>

          {/* Competitions Section */}
          <div className="flex flex-col gap-6">
            <h2 className="font-['Replica_LL',sans-serif] text-2xl font-bold text-[#E9EDF1]">
              Upcoming Competitions
            </h2>

            {upcomingCompetitionsLoading ? (
              <div className="text-[#596E89]">Loading competitions...</div>
            ) : upcomingCompetitionsData &&
              upcomingCompetitionsData.competitions.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {upcomingCompetitionsData.competitions.map(
                  (competition: Competition) => {
                    const CompetitionCard = () => (
                      <div className="group flex h-full flex-col rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-6 transition-all duration-200 hover:border-[#0057AD] hover:bg-[#0f0f0f]">
                        {/* Competition Image and Name - Fixed height section */}
                        <div className="flex h-32 flex-col items-center justify-center gap-2">
                          <div className="relative h-16 w-16 overflow-hidden rounded-lg border-2 border-[#1a1a1a] group-hover:border-[#0057AD]">
                            {competition.imageUrl &&
                            competition.imageUrl.trim() !== "" ? (
                              <img
                                src={competition.imageUrl}
                                alt={competition.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#0057AD] to-[#003d7a] text-white">
                                {/* Background pattern */}
                                <div className="absolute inset-0 opacity-10">
                                  <div className="absolute left-0 top-0 h-8 w-8 border-l-2 border-t-2 border-white/20"></div>
                                  <div className="absolute bottom-0 right-0 h-8 w-8 border-b-2 border-r-2 border-white/20"></div>
                                  <div className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rotate-45 transform border border-white/10"></div>
                                </div>
                                {/* Competition initial */}
                                <div className="z-10 flex flex-col items-center justify-center">
                                  <div className="text-2xl font-bold">
                                    {competition.name.charAt(0).toUpperCase()}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Competition Name */}
                          <h3 className="line-clamp-2 text-center font-['Replica_LL',sans-serif] text-base font-semibold text-[#E9EDF1] group-hover:text-[#0057AD]">
                            {competition.name}
                          </h3>
                        </div>

                        {/* Competition Description - Fixed height section */}
                        <div className="mt-2 h-16">
                          {competition.description ? (
                            <p className="line-clamp-3 text-sm text-[#596E89]">
                              {competition.description}
                            </p>
                          ) : (
                            <div className="h-full"></div>
                          )}
                        </div>

                        {/* Spacer to push dates to bottom */}
                        <div className="flex-1"></div>

                        {/* Competition Dates - Fixed position */}
                        <div className="mt-4 flex justify-between text-xs">
                          <div className="text-center">
                            <div className="font-semibold text-[#E9EDF1]">
                              {competition.startDate
                                ? new Date(
                                    competition.startDate,
                                  ).toLocaleDateString()
                                : "TBD"}
                            </div>
                            <div className="text-[#6D85A4]">Start Date</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-[#E9EDF1]">
                              {competition.endDate
                                ? new Date(
                                    competition.endDate,
                                  ).toLocaleDateString()
                                : "TBD"}
                            </div>
                            <div className="text-[#6D85A4]">End Date</div>
                          </div>
                        </div>

                        {/* View Details Link - Fixed position */}
                        <div className="mt-4 text-center">
                          {competition.metadata?.website && (
                            <span className="text-xs text-[#0057AD] group-hover:underline">
                              View Competition →
                            </span>
                          )}
                        </div>
                      </div>
                    );

                    // Wrap with external link if available
                    return competition.metadata?.website ? (
                      <a
                        key={competition.id}
                        href={competition.metadata.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group cursor-pointer"
                      >
                        <CompetitionCard />
                      </a>
                    ) : (
                      <div
                        key={competition.id}
                        className="group cursor-default"
                      >
                        <CompetitionCard />
                      </div>
                    );
                  },
                )}
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="text-[#596E89]">
                  No upcoming competitions available at the moment.
                </div>
              </div>
            )}
          </div>

          {/* Getting Started Section */}
          <div className="flex flex-col gap-6">
            <h2 className="font-['Replica_LL',sans-serif] text-2xl font-bold text-[#E9EDF1]">
              Getting Started
            </h2>

            <div className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-6">
              <div className="flex flex-col gap-4">
                <div className="font-['Replica_LL',sans-serif] text-lg leading-[27px] tracking-[0.54px]">
                  <span className="text-[#FAC021]">
                    You&apos;re not fully set up{" "}
                  </span>
                  <span className="text-[#596E89]">
                    until you register an agent and make your first API call.
                    Once registered, you can participate in any of the
                    competitions above.{" "}
                  </span>
                </div>

                <div className="font-['Replica_LL',sans-serif] text-lg leading-[27px] tracking-[0.54px] text-[#596E89]">
                  <Link
                    href="https://docs.recall.network/competitions/guides/register#verifying-your-account"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#E9EDF1] underline hover:text-[#0057AD]"
                  >
                    Read the documentation
                  </Link>
                  <span className="text-[#596E89]">
                    {" "}
                    to see how to connect and make your first call.
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-4">
                  <Link
                    href="https://docs.recall.network"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded bg-[#0057AD] px-4 py-2 font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[#0066cc]"
                  >
                    View Documentation
                  </Link>
                  <Link
                    href="https://docs.recall.network/competitions/guides/register"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded border border-[#596E89] px-4 py-2 font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-[#596E89] transition-colors hover:bg-[#596E89] hover:text-white"
                  >
                    Registration Guide
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
