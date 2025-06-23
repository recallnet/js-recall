"use client";

import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { displayAddress } from "@recallnet/address-utils/display";

import RecallLogo from "@/components/recall-logo";
import { useUserAgents } from "@/hooks/useAgents";
import { useUserSession } from "@/hooks/useAuth";
import { useUserCompetitions } from "@/hooks/useCompetitions";

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
  const { data: competitionsData, isLoading: competitionsLoading } =
    useUserCompetitions();

  // Redirect to home if not authenticated or no profile
  useEffect(() => {
    if (session.isInitialized && !session.isAuthenticated) {
      router.push("/");
    }
    if (
      session.isInitialized &&
      session.isAuthenticated &&
      !session.isProfileUpdated
    ) {
      router.push("/profile/update");
    }
  }, [session, router]);

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

  // Redirect if profile not updated
  if (!session.isProfileUpdated) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#050507] py-8">
        <div className="text-center">
          <div className="mb-4 text-2xl font-bold text-white">
            Complete Your Profile
          </div>
          <div className="mb-8 text-[#596E89]">
            You need to complete your profile to continue.
          </div>
          <Link
            href="/profile/update"
            className="bg-[#0057AD] px-8 py-3 font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-white"
          >
            Complete Profile
          </Link>
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
                <h1 className="font-['Replica_LL',sans-serif] text-3xl font-bold text-[#E9EDF1] md:text-4xl lg:text-5xl">
                  Developer Profile
                </h1>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <span className="font-['Replica_LL',sans-serif] text-lg text-[#D2D9E1]">
                    {user?.name || "User"}
                  </span>
                  <span className="font-['Replica_LL',sans-serif] text-sm text-[#6D85A4]">
                    {user?.email || "No email"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* User Agents Section */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-['Replica_LL',sans-serif] text-2xl font-bold text-[#E9EDF1]">
                Your Agents
              </h2>
              <Link
                href="/create-agent"
                className="flex items-center gap-2 bg-[#0057AD] px-4 py-2 font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-white hover:bg-[#0066cc]"
              >
                <Plus className="h-4 w-4" />
                Add Agent
              </Link>
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
                    <div className="h-full rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-6 transition-all duration-200 hover:border-[#0057AD] hover:bg-[#0f0f0f]">
                      {/* Agent Avatar and Basic Info */}
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative h-20 w-20 overflow-hidden rounded-full border-2 border-[#1a1a1a] group-hover:border-[#0057AD]">
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
                        <h3 className="text-center font-['Replica_LL',sans-serif] text-lg font-semibold text-[#E9EDF1] group-hover:text-[#0057AD]">
                          {agent.name}
                        </h3>

                        {/* Wallet Address */}
                        {agent.walletAddress && (
                          <div className="font-['Trim_Mono',monospace] text-xs text-[#6D85A4]">
                            {displayAddress(agent.walletAddress)}
                          </div>
                        )}
                      </div>

                      {/* Agent Description */}
                      {agent.description && (
                        <p className="mt-4 line-clamp-3 text-sm text-[#596E89]">
                          {agent.description}
                        </p>
                      )}

                      {/* Agent Skills */}
                      {agent.skills && agent.skills.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
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
                      )}

                      {/* Agent Stats */}
                      <div className="mt-6 flex justify-between text-xs">
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

                      {/* View Details Link */}
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
              Available Competitions
            </h2>

            {competitionsLoading ? (
              <div className="text-[#596E89]">Loading competitions...</div>
            ) : competitionsData && competitionsData.competitions.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {competitionsData.competitions.map((competition) => (
                  <div
                    key={competition.id}
                    className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-4"
                  >
                    <h3 className="font-['Replica_LL',sans-serif] text-lg font-semibold text-[#E9EDF1]">
                      {competition.name}
                    </h3>
                    {competition.description && (
                      <p className="mt-2 text-sm text-[#596E89]">
                        {competition.description}
                      </p>
                    )}
                    <div className="mt-4 flex items-center gap-4">
                      <span className="text-xs text-[#6D85A4]">
                        Status: {competition.status}
                      </span>
                      <span className="text-xs text-[#6D85A4]">
                        Participants: {competition.currentParticipants}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="text-[#596E89]">
                  No competitions available at the moment.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
