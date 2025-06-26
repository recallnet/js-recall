"use client";

import {
  Check,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  Key,
  Save,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

import { toast } from "@recallnet/ui/components/toast";

import RecallLogo from "@/components/recall-logo";
import { useAgentCompetitions, useSyncLoopsVerification } from "@/hooks";
import { useUserAgent } from "@/hooks/useAgent";
import { useAgentApiKey, useUpdateAgent } from "@/hooks/useAgents";
import { useUserSession } from "@/hooks/useAuth";
import { internalApi } from "@/lib/internal-api";

// Type for agent metadata that matches actual usage
interface AgentMetadata {
  skills?: string[];
  repositoryUrl?: string;
  x?: string;
  telegram?: string;
  [key: string]: string | string[] | undefined;
}

// Available skills for agents
const AGENT_SKILLS = [
  "Crypto Trading",
  "Traditional Investing",
  "Sports Betting",
  "Prediction Markets",
  "Social and Chat",
  "Art & Video Creation",
  "Programming / Coding",
  "Deep Research",
  "Other",
];

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
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [isImageValid, setIsImageValid] = useState(true);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [isEditingSkills, setIsEditingSkills] = useState(false);
  const [newSkills, setNewSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState("");
  const [isEditingSocials, setIsEditingSocials] = useState(false);
  const [newSocials, setNewSocials] = useState({
    repositoryUrl: "",
    x: "",
    telegram: "",
  });
  const [tradingVerified, setTradingVerified] = useState<boolean | null>(null);
  const [isCheckingTrading, setIsCheckingTrading] = useState(false);

  const { data: agentData, isLoading: agentLoading } = useUserAgent(id);
  const { data: apiKeyData, isLoading: apiKeyLoading } = useAgentApiKey(id);
  const updateAgentMutation = useUpdateAgent();
  const syncVerificationMutation = useSyncLoopsVerification();

  // Get agent competitions using the agent's API key
  const { data: agentCompetitionsData } = useAgentCompetitions(
    id,
    apiKeyData?.apiKey,
    { status: "active" },
  );

  // Redirect to home if not authenticated
  useEffect(() => {
    if (session.isInitialized && !session.isAuthenticated) {
      router.push("/");
    }
  }, [session, router]);

  // Check trading verification status
  const checkTradingVerification = async () => {
    if (!session.isInitialized) return;
    if (!session.isAuthenticated || !session.user?.walletAddress) return;

    setIsCheckingTrading(true);
    try {
      // First, check if agent has made trades in any active competitions
      let hasActiveCompetitionTrades = false;

      if (
        agentCompetitionsData?.competitions &&
        agentCompetitionsData.competitions.length > 0
      ) {
        // Check if agent has made any trades in active competitions
        const activeCompetitionsWithTrades =
          agentCompetitionsData.competitions.filter(
            (competition) =>
              competition.status === "active" &&
              competition.totalTrades &&
              competition.totalTrades > 0,
          );

        hasActiveCompetitionTrades = activeCompetitionsWithTrades.length > 0;
      }

      if (hasActiveCompetitionTrades) {
        setTradingVerified(true);

        // Update the trading verification status in the database
        try {
          const updateResult = await internalApi.updateTradingVerification(
            session.user.walletAddress,
          );
          console.log("Trading verification updated:", updateResult);

          // Also sync with Loops if user has email
          if (session.user.email && session.user.name) {
            try {
              const syncResult = await syncVerificationMutation.mutateAsync({
                email: session.user.email,
                userName: session.user.name,
                hasTraded: true,
              });
              console.log("Loops verification sync result:", syncResult);
            } catch (syncError) {
              console.error(
                "Failed to sync with Loops (non-blocking):",
                syncError,
              );
            }
          }
        } catch (updateError) {
          console.error("Failed to update trading verification:", updateError);
          // Don't fail the whole process if database update fails
        }
      } else {
        // Fall back to wallet-based trading verification
        const result = await internalApi.checkTradingVerification(
          session.user.walletAddress,
        );
        setTradingVerified(result.hasTraded ?? false);
      }
    } catch (error) {
      console.error("Error checking trading verification:", error);
      setTradingVerified(false);
    } finally {
      setIsCheckingTrading(false);
    }
  };

  // Check trading verification when user is authenticated
  useEffect(() => {
    if (session.isInitialized) {
      if (session.isAuthenticated && session.user?.walletAddress) {
        checkTradingVerification();
      }
    }
  }, [session, agentCompetitionsData]);

  const handleCopyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label} copied to clipboard`);
    } catch {
      toast("Failed to copy to clipboard");
    }
  };

  const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setNewImageUrl(url);

    // Basic URL validation
    if (url && !isValidUrl(url)) {
      setIsImageValid(false);
    } else {
      setIsImageValid(true);
    }
  };

  const isValidUrl = (string: string) => {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  };

  const handleSaveImage = async () => {
    if (!agentData || !newImageUrl.trim() || !isImageValid) return;

    try {
      await updateAgentMutation.mutateAsync({
        agentId: id,
        params: {
          imageUrl: newImageUrl.trim(),
        },
      });

      toast("Agent image updated successfully");
      setIsEditingImage(false);
      setNewImageUrl("");
    } catch (error) {
      console.error("Failed to update agent image:", error);
      toast("Failed to update agent image");
    }
  };

  const handleCancelEdit = () => {
    setIsEditingImage(false);
    setNewImageUrl("");
    setIsImageValid(true);
  };

  const handleStartEdit = () => {
    setIsEditingImage(true);
    setNewImageUrl(agentData?.imageUrl || "");
  };

  // Description edit handlers
  const handleStartEditDescription = () => {
    setIsEditingDescription(true);
    setNewDescription(agentData?.description || "");
  };

  const handleSaveDescription = async () => {
    if (!agentData) return;

    try {
      await updateAgentMutation.mutateAsync({
        agentId: id,
        params: {
          description: newDescription.trim() || undefined,
        },
      });

      toast("Agent description updated successfully");
      setIsEditingDescription(false);
    } catch (error) {
      console.error("Failed to update agent description:", error);
      toast("Failed to update agent description");
    }
  };

  const handleCancelEditDescription = () => {
    setIsEditingDescription(false);
    setNewDescription("");
  };

  // Skills edit handlers
  const handleStartEditSkills = () => {
    setIsEditingSkills(true);
    setNewSkills(agentData?.skills || []);
    setCustomSkill("");
  };

  const handleSkillToggle = (skill: string) => {
    setNewSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );
  };

  const handleAddCustomSkill = () => {
    if (customSkill.trim() && !newSkills.includes(customSkill.trim())) {
      setNewSkills((prev) => [
        ...prev.filter((s) => s !== "Other"),
        customSkill.trim(),
      ]);
      setCustomSkill("");
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setNewSkills((prev) => prev.filter((s) => s !== skill));
  };

  const handleSaveSkills = async () => {
    if (!agentData) return;

    try {
      const currentMetadata = (agentData.metadata as AgentMetadata) || {};
      await updateAgentMutation.mutateAsync({
        agentId: id,
        params: {
          metadata: {
            ...currentMetadata,
            skills: newSkills,
          },
        },
      });

      toast("Agent skills updated successfully");
      setIsEditingSkills(false);
    } catch (error) {
      console.error("Failed to update agent skills:", error);
      toast("Failed to update agent skills");
    }
  };

  const handleCancelEditSkills = () => {
    setIsEditingSkills(false);
    setNewSkills([]);
    setCustomSkill("");
  };

  // Socials edit handlers
  const handleStartEditSocials = () => {
    setIsEditingSocials(true);
    const metadata = (agentData?.metadata as AgentMetadata) || {};
    setNewSocials({
      repositoryUrl: metadata.repositoryUrl || "",
      x: metadata.x || "",
      telegram: metadata.telegram || "",
    });
  };

  const handleSaveSocials = async () => {
    if (!agentData) return;

    try {
      const currentMetadata = (agentData.metadata as AgentMetadata) || {};
      await updateAgentMutation.mutateAsync({
        agentId: id,
        params: {
          metadata: {
            ...currentMetadata,
            repositoryUrl: newSocials.repositoryUrl.trim() || undefined,
            x: newSocials.x.trim() || undefined,
            telegram: newSocials.telegram.trim() || undefined,
          },
        },
      });

      toast("Agent social links updated successfully");
      setIsEditingSocials(false);
    } catch (error) {
      console.error("Failed to update agent social links:", error);
      toast("Failed to update agent social links");
    }
  };

  const handleCancelEditSocials = () => {
    setIsEditingSocials(false);
    setNewSocials({
      repositoryUrl: "",
      x: "",
      telegram: "",
    });
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
                  <div className="relative">
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
                    {/* Edit Button */}
                    <button
                      onClick={handleStartEdit}
                      className="absolute -bottom-2 -right-2 rounded-full bg-[#0057AD] p-2 text-white transition-colors hover:bg-[#0066cc]"
                      title="Edit agent image"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Image Edit Form */}
                {isEditingImage && (
                  <div className="mb-6 space-y-4 rounded border border-[#2a2a2a] bg-[#1a1a1a] p-4">
                    <h3 className="text-sm font-medium text-[#E9EDF1]">
                      Update Agent Image
                    </h3>
                    <div className="space-y-2">
                      <input
                        type="url"
                        value={newImageUrl}
                        onChange={handleImageUrlChange}
                        placeholder="Enter image URL (e.g., https://example.com/image.jpg)"
                        className={`w-full rounded border px-3 py-2 text-sm text-white placeholder-[#6D85A4] focus:outline-none ${
                          !isImageValid
                            ? "border-red-500 bg-red-500/10 focus:border-red-400"
                            : "border-[#2a2a2a] bg-[#0a0a0a] focus:border-[#0057AD]"
                        }`}
                      />
                      {!isImageValid && (
                        <p className="text-xs text-red-400">
                          Please enter a valid URL
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveImage}
                        disabled={
                          !newImageUrl.trim() ||
                          !isImageValid ||
                          updateAgentMutation.isPending
                        }
                        className="flex items-center gap-1 rounded bg-[#0057AD] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0066cc] disabled:opacity-50"
                      >
                        <Save className="h-3 w-3" />
                        {updateAgentMutation.isPending ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="flex items-center gap-1 rounded border border-[#2a2a2a] px-3 py-1.5 text-xs font-medium text-[#D2D9E1] transition-colors hover:bg-[#1a1a1a]"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Agent Name */}
                <h1 className="mb-2 text-center font-['Replica_LL',sans-serif] text-3xl font-bold text-[#E9EDF1]">
                  {agent.name}
                </h1>

                {/* Verification Status */}
                <div className="mb-4 space-y-2">
                  {agent.isVerified && (
                    <div className="flex justify-center">
                      <span className="rounded-full bg-green-500/20 px-3 py-1 text-sm font-medium text-green-400">
                        ✓ Verified
                      </span>
                    </div>
                  )}

                  {/* Trading Verification Status */}
                  <div className="flex justify-center">
                    {isCheckingTrading ? (
                      <span className="rounded-full bg-gray-500/20 px-3 py-1 text-sm font-medium text-gray-400">
                        Checking trading status...
                      </span>
                    ) : tradingVerified !== null ? (
                      <span
                        className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${
                          tradingVerified
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {tradingVerified ? (
                          <>
                            <Check className="h-3 w-3" />
                            Trading Verified
                          </>
                        ) : (
                          <>
                            <X className="h-3 w-3" />
                            No Trading History
                          </>
                        )}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Agent Stats */}
                <div className="mt-6 grid grid-cols-3 gap-4 border-t border-[#1a1a1a] pt-6">
                  <div className="text-center">
                    <div className="text-xl font-bold text-[#E9EDF1]">
                      {agentCompetitionsData?.competitions?.filter(
                        (comp) => comp.status === "active",
                      ).length || 0}
                    </div>
                    <div className="text-xs text-[#6D85A4]">Competitions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-[#E9EDF1]">
                      {agentCompetitionsData?.competitions?.reduce(
                        (total, comp) => total + (comp.totalTrades || 0),
                        0,
                      ) ||
                        agent.stats?.totalTrades ||
                        0}
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
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-['Replica_LL',sans-serif] text-xl font-bold text-[#E9EDF1]">
                    Description
                  </h2>
                  <button
                    onClick={handleStartEditDescription}
                    className="rounded bg-[#0057AD] p-1.5 text-white transition-colors hover:bg-[#0066cc]"
                    title="Edit description"
                  >
                    <Edit3 className="h-3 w-3" />
                  </button>
                </div>

                {isEditingDescription ? (
                  <div className="space-y-4">
                    <textarea
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Enter agent description..."
                      rows={4}
                      className="w-full rounded border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-[#6D85A4] focus:border-[#0057AD] focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveDescription}
                        disabled={updateAgentMutation.isPending}
                        className="flex items-center gap-1 rounded bg-[#0057AD] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0066cc] disabled:opacity-50"
                      >
                        <Save className="h-3 w-3" />
                        {updateAgentMutation.isPending ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={handleCancelEditDescription}
                        className="flex items-center gap-1 rounded border border-[#2a2a2a] px-3 py-1.5 text-xs font-medium text-[#D2D9E1] transition-colors hover:bg-[#1a1a1a]"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="leading-relaxed text-[#D2D9E1]">
                    {agent.description ||
                      "No description provided for this agent."}
                  </p>
                )}
              </div>

              {/* Skills */}
              <div className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-['Replica_LL',sans-serif] text-xl font-bold text-[#E9EDF1]">
                    Skills
                  </h2>
                  <button
                    onClick={handleStartEditSkills}
                    className="rounded bg-[#0057AD] p-1.5 text-white transition-colors hover:bg-[#0066cc]"
                    title="Edit skills"
                  >
                    <Edit3 className="h-3 w-3" />
                  </button>
                </div>

                {isEditingSkills ? (
                  <div className="space-y-4">
                    {/* Predefined Skills */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[#D2D9E1]">
                        Select Skills
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {AGENT_SKILLS.filter((skill) => skill !== "Other").map(
                          (skill) => (
                            <button
                              key={skill}
                              onClick={() => handleSkillToggle(skill)}
                              className={`rounded border px-3 py-1 text-sm transition-colors ${
                                newSkills.includes(skill)
                                  ? "border-[#0057AD] bg-[#0057AD] text-white"
                                  : "border-[#2a2a2a] bg-[#1a1a1a] text-[#D2D9E1] hover:border-[#0057AD]"
                              }`}
                            >
                              {skill}
                            </button>
                          ),
                        )}
                      </div>
                    </div>

                    {/* Custom Skills */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[#D2D9E1]">
                        Add Custom Skill
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customSkill}
                          onChange={(e) => setCustomSkill(e.target.value)}
                          placeholder="Enter custom skill..."
                          className="flex-1 rounded border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-[#6D85A4] focus:border-[#0057AD] focus:outline-none"
                          onKeyPress={(e) =>
                            e.key === "Enter" && handleAddCustomSkill()
                          }
                        />
                        <button
                          onClick={handleAddCustomSkill}
                          disabled={!customSkill.trim()}
                          className="rounded bg-[#0057AD] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0066cc] disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Selected Skills */}
                    {newSkills.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-[#D2D9E1]">
                          Selected Skills
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {newSkills.map((skill) => (
                            <span
                              key={skill}
                              className="flex items-center gap-1 rounded border border-[#0057AD] bg-[#0057AD] px-3 py-1 text-sm text-white"
                            >
                              {skill}
                              <button
                                onClick={() => handleRemoveSkill(skill)}
                                className="ml-1 text-white hover:text-red-300"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveSkills}
                        disabled={updateAgentMutation.isPending}
                        className="flex items-center gap-1 rounded bg-[#0057AD] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0066cc] disabled:opacity-50"
                      >
                        <Save className="h-3 w-3" />
                        {updateAgentMutation.isPending ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={handleCancelEditSkills}
                        className="flex items-center gap-1 rounded border border-[#2a2a2a] px-3 py-1.5 text-xs font-medium text-[#D2D9E1] transition-colors hover:bg-[#1a1a1a]"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {agent.skills && agent.skills.length > 0 ? (
                      agent.skills.map((skill: string) => (
                        <span
                          key={skill}
                          className="rounded border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-1 text-sm text-[#D2D9E1]"
                        >
                          {skill}
                        </span>
                      ))
                    ) : (
                      <p className="text-[#6D85A4]">No skills specified</p>
                    )}
                  </div>
                )}
              </div>

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

              {/* Links & Social */}
              <div className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-['Replica_LL',sans-serif] text-xl font-bold text-[#E9EDF1]">
                    Links & Social
                  </h2>
                  <button
                    onClick={handleStartEditSocials}
                    className="rounded bg-[#0057AD] p-1.5 text-white transition-colors hover:bg-[#0066cc]"
                    title="Edit social links"
                  >
                    <Edit3 className="h-3 w-3" />
                  </button>
                </div>

                {isEditingSocials ? (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#D2D9E1]">
                          Repository URL
                        </label>
                        <input
                          type="url"
                          value={newSocials.repositoryUrl}
                          onChange={(e) =>
                            setNewSocials((prev) => ({
                              ...prev,
                              repositoryUrl: e.target.value,
                            }))
                          }
                          placeholder="https://github.com/username/repo"
                          className="w-full rounded border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-[#6D85A4] focus:border-[#0057AD] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#D2D9E1]">
                          X (Twitter) Username
                        </label>
                        <input
                          type="text"
                          value={newSocials.x}
                          onChange={(e) =>
                            setNewSocials((prev) => ({
                              ...prev,
                              x: e.target.value,
                            }))
                          }
                          placeholder="username (without @)"
                          className="w-full rounded border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-[#6D85A4] focus:border-[#0057AD] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-[#D2D9E1]">
                          Telegram Username
                        </label>
                        <input
                          type="text"
                          value={newSocials.telegram}
                          onChange={(e) =>
                            setNewSocials((prev) => ({
                              ...prev,
                              telegram: e.target.value,
                            }))
                          }
                          placeholder="username (without @)"
                          className="w-full rounded border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-[#6D85A4] focus:border-[#0057AD] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveSocials}
                        disabled={updateAgentMutation.isPending}
                        className="flex items-center gap-1 rounded bg-[#0057AD] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0066cc] disabled:opacity-50"
                      >
                        <Save className="h-3 w-3" />
                        {updateAgentMutation.isPending ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={handleCancelEditSocials}
                        className="flex items-center gap-1 rounded border border-[#2a2a2a] px-3 py-1.5 text-xs font-medium text-[#D2D9E1] transition-colors hover:bg-[#1a1a1a]"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {agent.metadata &&
                    typeof agent.metadata === "object" &&
                    "repositoryUrl" in agent.metadata &&
                    typeof agent.metadata.repositoryUrl === "string" ? (
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
                    ) : null}
                    {agent.metadata &&
                    typeof agent.metadata === "object" &&
                    "x" in agent.metadata &&
                    typeof agent.metadata.x === "string" ? (
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
                    ) : null}
                    {agent.metadata &&
                    typeof agent.metadata === "object" &&
                    "telegram" in agent.metadata &&
                    typeof agent.metadata.telegram === "string" ? (
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
                    ) : null}
                    {(!agent.metadata ||
                      (typeof agent.metadata === "object" &&
                        !("repositoryUrl" in agent.metadata) &&
                        !("x" in agent.metadata) &&
                        !("telegram" in agent.metadata))) && (
                      <p className="text-[#6D85A4]">
                        No social links specified
                      </p>
                    )}
                  </div>
                )}
              </div>
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
