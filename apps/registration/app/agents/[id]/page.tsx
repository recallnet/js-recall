"use client";

import { Copy, Eye, EyeOff, Key, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

import { toast } from "@recallnet/ui/components/toast";

import RecallLogo from "@/components/recall-logo";
import { useUserAgent } from "@/hooks/useAgent";
import { useAgentApiKey } from "@/hooks/useAgents";
import { useUserSession } from "@/hooks/useAuth";

/**
 * Individual agent page component
 *
 * Displays detailed information about a specific agent including API key access
 *
 * @param params - Route parameters containing agent ID
 * @returns Agent detail page component
 */
export default function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const session = useUserSession();
  const router = useRouter();
  const [showApiKey, setShowApiKey] = useState(false);

  const { data: agentData, isLoading: agentLoading } = useUserAgent(id);
  const { data: apiKeyData, isLoading: apiKeyLoading } = useAgentApiKey(id);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (session.isInitialized && !session.isAuthenticated) {
      router.push("/");
    }
  }, [session, router]);

  const handleCopyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label} copied to clipboard`);
    } catch {
      toast("Failed to copy to clipboard");
    }
  };

  // Show loading state
  if (!session.isInitialized || session.isLoading || agentLoading) {
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
            Please connect your wallet to view agent details
          </div>
        </div>
      </div>
    );
  }

  // Handle agent not found or error
  if (!agentData) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#050507] py-8">
        <div className="text-center">
          <div className="mb-4 text-2xl font-bold text-white">
            Agent not found
          </div>
          <div className="mb-8 text-[#596E89]">
            The agent you&apos;re looking for doesn&apos;t exist or you
            don&apos;t have access to it.
          </div>
          <Link
            href="/account"
            className="bg-[#0057AD] px-8 py-3 font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-white hover:bg-[#0066cc]"
          >
            Back to Account
          </Link>
        </div>
      </div>
    );
  }

  const agent = agentData;

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#050507] py-8">
      <div className="container mx-auto px-4 sm:px-8 md:px-12 lg:px-24 xl:px-36">
        <div className="flex w-full flex-col gap-8 md:gap-12">
          {/* Header with logo and breadcrumb */}
          <div className="flex flex-col gap-8 md:gap-12">
            <RecallLogo color="#D2D9E1" />

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-[#6D85A4]">
              <Link
                href="/account"
                className="transition-colors hover:text-[#0057AD]"
              >
                Account
              </Link>
              <span>/</span>
              <Link
                href="/account"
                className="transition-colors hover:text-[#0057AD]"
              >
                Your Agents
              </Link>
              <span>/</span>
              <span className="text-[#D2D9E1]">{agent.name}</span>
            </div>
          </div>

          {/* Agent Profile Section */}
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left Column - Agent Image and Basic Info */}
            <div className="lg:col-span-1">
              <div className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-8">
                {/* Agent Avatar */}
                <div className="mb-6 flex justify-center">
                  <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-[#1a1a1a]">
                    {agent.imageUrl ? (
                      <img
                        src={agent.imageUrl}
                        alt={agent.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#1a1a1a] text-4xl font-bold text-[#596E89]">
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Agent Name */}
                <h1 className="mb-2 text-center font-['Replica_LL',sans-serif] text-3xl font-bold text-[#E9EDF1]">
                  {agent.name}
                </h1>

                {/* Verification Status */}
                {agent.isVerified && (
                  <div className="mb-4 flex justify-center">
                    <span className="rounded-full bg-green-500/20 px-3 py-1 text-sm font-medium text-green-400">
                      ✓ Verified
                    </span>
                  </div>
                )}

                {/* Agent Stats */}
                <div className="mt-6 grid grid-cols-3 gap-4 border-t border-[#1a1a1a] pt-6">
                  <div className="text-center">
                    <div className="text-xl font-bold text-[#E9EDF1]">
                      {agent.stats?.completedCompetitions || 0}
                    </div>
                    <div className="text-xs text-[#6D85A4]">Competitions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-[#E9EDF1]">
                      {agent.stats?.totalTrades || 0}
                    </div>
                    <div className="text-xs text-[#6D85A4]">Trades</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-[#E9EDF1]">
                      {agent.stats?.bestPlacement?.rank || "N/A"}
                    </div>
                    <div className="text-xs text-[#6D85A4]">Best Rank</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Detailed Information */}
            <div className="space-y-6 lg:col-span-2">
              {/* Description */}
              <div className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-6">
                <h2 className="mb-4 font-['Replica_LL',sans-serif] text-xl font-bold text-[#E9EDF1]">
                  Description
                </h2>
                <p className="leading-relaxed text-[#D2D9E1]">
                  {agent.description ||
                    "No description provided for this agent."}
                </p>
              </div>

              {/* Skills */}
              {agent.skills && agent.skills.length > 0 && (
                <div className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-6">
                  <h2 className="mb-4 font-['Replica_LL',sans-serif] text-xl font-bold text-[#E9EDF1]">
                    Skills
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {agent.skills.map((skill: string) => (
                      <span
                        key={skill}
                        className="rounded border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-1 text-sm text-[#D2D9E1]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* API Key Section */}
              <div className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-6">
                <h2 className="mb-4 font-['Replica_LL',sans-serif] text-xl font-bold text-[#E9EDF1]">
                  API Access
                </h2>

                {/* API Key */}
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#D2D9E1]">
                      <Key className="mr-2 inline h-4 w-4" />
                      Agent API Key
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-1 items-center gap-2 rounded border border-[#2a2a2a] bg-[#1a1a1a] p-3">
                        <span className="flex-grow font-mono text-sm text-[#D2D9E1]">
                          {apiKeyLoading
                            ? "Loading..."
                            : showApiKey
                              ? apiKeyData?.apiKey || "Error loading API key"
                              : "••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••"}
                        </span>
                        <button
                          onClick={() =>
                            apiKeyData?.apiKey &&
                            handleCopyToClipboard(apiKeyData.apiKey, "API Key")
                          }
                          className="text-[#6D85A4] transition-colors hover:text-[#0057AD]"
                          disabled={!apiKeyData?.apiKey}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="p-2 text-[#6D85A4] transition-colors hover:text-[#0057AD]"
                      >
                        {showApiKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-[#6D85A4]">
                      Keep this key private! Anyone with this key can call your
                      agent.
                    </p>
                  </div>

                  {/* Wallet Address */}
                  {agent.walletAddress && (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#D2D9E1]">
                        <Wallet className="mr-2 inline h-4 w-4" />
                        Wallet Address
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-1 items-center gap-2 rounded border border-[#2a2a2a] bg-[#1a1a1a] p-3">
                          <span className="flex-grow font-mono text-sm text-[#D2D9E1]">
                            {agent.walletAddress}
                          </span>
                          <button
                            onClick={() =>
                              handleCopyToClipboard(
                                agent.walletAddress!,
                                "Wallet Address",
                              )
                            }
                            className="text-[#6D85A4] transition-colors hover:text-[#0057AD]"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata/Additional Info */}
              {agent.metadata &&
                typeof agent.metadata === "object" &&
                ("repositoryUrl" in agent.metadata ||
                  "x" in agent.metadata ||
                  "telegram" in agent.metadata) && (
                  <div className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-6">
                    <h2 className="mb-4 font-['Replica_LL',sans-serif] text-xl font-bold text-[#E9EDF1]">
                      Links & Social
                    </h2>
                    <div className="space-y-3">
                      {agent.metadata &&
                        typeof agent.metadata === "object" &&
                        "repositoryUrl" in agent.metadata &&
                        typeof agent.metadata.repositoryUrl === "string" && (
                          <div>
                            <label className="mb-1 block text-sm font-medium text-[#D2D9E1]">
                              Repository
                            </label>
                            <a
                              href={agent.metadata.repositoryUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="break-all text-[#0057AD] hover:underline"
                            >
                              {agent.metadata.repositoryUrl}
                            </a>
                          </div>
                        )}
                      {agent.metadata &&
                        typeof agent.metadata === "object" &&
                        "x" in agent.metadata &&
                        typeof agent.metadata.x === "string" && (
                          <div>
                            <label className="mb-1 block text-sm font-medium text-[#D2D9E1]">
                              X (Twitter)
                            </label>
                            <a
                              href={`https://x.com/${agent.metadata.x}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#0057AD] hover:underline"
                            >
                              @{agent.metadata.x}
                            </a>
                          </div>
                        )}
                      {agent.metadata &&
                        typeof agent.metadata === "object" &&
                        "telegram" in agent.metadata &&
                        typeof agent.metadata.telegram === "string" && (
                          <div>
                            <label className="mb-1 block text-sm font-medium text-[#D2D9E1]">
                              Telegram
                            </label>
                            <a
                              href={`https://t.me/${agent.metadata.telegram}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#0057AD] hover:underline"
                            >
                              @{agent.metadata.telegram}
                            </a>
                          </div>
                        )}
                    </div>
                  </div>
                )}
            </div>
          </div>

          {/* Back to Account Button */}
          <div className="flex justify-center pt-8">
            <Link
              href="/account"
              className="bg-[#0057AD] px-8 py-3 font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[#0066cc]"
            >
              ← Back to Your Agents
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
