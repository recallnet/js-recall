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
import {
  SKILL_OPTIONS,
  skillsToDisplay,
  skillsToKeys,
  type SkillDisplay,
} from "@recallnet/ui/lib/skills";

import RecallLogo from "@/components/recall-logo";
import { useAgentCompetitions, useSyncLoopsVerification } from "@/hooks";
import { useUserAgent } from "@/hooks/useAgent";
import { useAgentApiKey, useUpdateAgent } from "@/hooks/useAgents";
import { useUserSession } from "@/hooks/useAuth";

// Type for agent metadata that matches actual usage
interface AgentMetadata {
  skills?: string[];
  repositoryUrl?: string;
  x?: string;
  telegram?: string;
  [key: string]: string | string[] | undefined;
}

/**
 * Individual agent page component
 *
 * This page displays detailed information about a single agent including:
 * - Agent profile (name, description, image)
 * - Skills and social links
 * - API key management
 * - Competition history
 * - Edit capabilities
 *
 * The page supports editing agent metadata and regenerating API keys
 */
export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const agentId = resolvedParams.id;
  const router = useRouter();

  // State for editing
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    description: "",
    imageUrl: "",
    skills: [] as SkillDisplay[],
    repositoryUrl: "",
    x: "",
    telegram: "",
  });

  // State for API key visibility
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  // Hooks
  const { data: session, isLoading: sessionLoading } = useUserSession();
  const {
    data: agent,
    isLoading: agentLoading,
    error: agentError,
    refetch: refetchAgent,
  } = useUserAgent(agentId);
  const {
    data: apiKeyData,
    isLoading: apiKeyLoading,
    error: apiKeyError,
    refetch: refetchApiKey,
  } = useAgentApiKey(agentId);
  const {
    data: competitions,
    isLoading: competitionsLoading,
    error: competitionsError,
  } = useAgentCompetitions(agentId);

  const updateAgentMutation = useUpdateAgent(agentId);

  // Sync with Loops if email is present
  const shouldSyncLoops = Boolean(
    session?.user?.email && agent?.email === session.user.email,
  );
  useSyncLoopsVerification(shouldSyncLoops);

  // Initialize edit form when agent data loads
  useEffect(() => {
    if (agent && !isEditing) {
      const metadata = (agent.metadata as AgentMetadata) || {};
      const skills = metadata.skills || [];
      const displaySkills = skillsToDisplay(skills);
      
      setEditFormData({
        name: agent.name || "",
        description: agent.description || "",
        imageUrl: agent.imageUrl || "",
        skills: displaySkills,
        repositoryUrl: metadata.repositoryUrl || "",
        x: metadata.x || "",
        telegram: metadata.telegram || "",
      });
    }
  }, [agent, isEditing]);

  const handleEdit = () => {
    if (agent) {
      const metadata = (agent.metadata as AgentMetadata) || {};
      const skills = metadata.skills || [];
      const displaySkills = skillsToDisplay(skills);
      
      setEditFormData({
        name: agent.name || "",
        description: agent.description || "",
        imageUrl: agent.imageUrl || "",
        skills: displaySkills,
        repositoryUrl: metadata.repositoryUrl || "",
        x: metadata.x || "",
        telegram: metadata.telegram || "",
      });
    }
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    try {
      // Convert display skills back to keys for API
      const skillKeys = skillsToKeys(editFormData.skills);
      
      const updateData = {
        name: editFormData.name.trim() || undefined,
        description: editFormData.description.trim() || undefined,
        imageUrl: editFormData.imageUrl.trim() || undefined,
        metadata: {
          skills: skillKeys,
          repositoryUrl: editFormData.repositoryUrl.trim() || undefined,
          x: editFormData.x.trim() || undefined,
          telegram: editFormData.telegram.trim() || undefined,
        },
      };

      await updateAgentMutation.mutateAsync(updateData);
      await refetchAgent();
      setIsEditing(false);
      toast("Agent updated successfully!", {
        duration: 3000,
      });
    } catch (error) {
      console.error("Failed to update agent:", error);
      toast("Failed to update agent. Please try again.", {
        duration: 5000,
      });
    }
  };

  const handleSkillChange = (skill: SkillDisplay) => {
    setEditFormData((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const copyApiKey = async () => {
    if (apiKeyData?.apiKey) {
      try {
        await navigator.clipboard.writeText(apiKeyData.apiKey);
        setApiKeyCopied(true);
        toast("API key copied to clipboard!", {
          duration: 2000,
        });
        setTimeout(() => setApiKeyCopied(false), 2000);
      } catch (err) {
        toast("Failed to copy API key", {
          duration: 3000,
        });
      }
    }
  };

  // Loading state
  if (sessionLoading || agentLoading || apiKeyLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  // Error states
  if (agentError || apiKeyError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center text-red-400">
          <h2 className="mb-4 text-xl font-semibold">Error Loading Agent</h2>
          <p className="mb-4">
            {agentError?.message ||
              apiKeyError?.message ||
              "Failed to load agent data"}
          </p>
          <button
            onClick={() => router.push("/agents")}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Back to Agents
          </button>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center text-white">
          <h2 className="mb-4 text-xl font-semibold">Agent Not Found</h2>
          <p className="mb-4">The requested agent could not be found.</p>
          <button
            onClick={() => router.push("/agents")}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Back to Agents
          </button>
        </div>
      </div>
    );
  }

  const metadata = (agent.metadata as AgentMetadata) || {};
  const skills = metadata.skills || [];
  const displaySkills = skillsToDisplay(skills);

  return (
    <div className="min-h-screen bg-[#0B0C0F] text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0B0C0F] py-4">
        <div className="container mx-auto flex items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <RecallLogo width={24} height={24} />
            <span className="text-xl font-bold">Recall</span>
          </Link>
          <Link
            href="/agents"
            className="text-blue-400 hover:text-blue-300"
          >
            ← Back to Agents
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl">
          {/* Agent Header */}
          <div className="mb-8 rounded-lg border border-gray-700 bg-[#11121A] p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                {/* Agent Avatar */}
                <div className="h-16 w-16 overflow-hidden rounded-full bg-gradient-to-r from-blue-500 to-purple-600">
                  {isEditing ? (
                    <input
                      type="url"
                      value={editFormData.imageUrl}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          imageUrl: e.target.value,
                        }))
                      }
                      placeholder="Avatar URL"
                      className="h-full w-full bg-gray-700 px-2 text-sm text-white"
                    />
                  ) : agent.imageUrl ? (
                    <img
                      src={agent.imageUrl}
                      alt={agent.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        target.parentElement!.innerHTML = `
                          <div class="flex h-full w-full items-center justify-center text-2xl font-bold text-white">
                            ${agent.name?.[0]?.toUpperCase() || "?"}
                          </div>
                        `;
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-white">
                      {agent.name?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                </div>

                {/* Agent Info */}
                <div className="flex-1">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editFormData.name}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      className="mb-2 w-full rounded border border-gray-600 bg-gray-700 px-3 py-1 text-xl font-bold text-white"
                      placeholder="Agent Name"
                    />
                  ) : (
                    <h1 className="mb-2 text-2xl font-bold">{agent.name}</h1>
                  )}

                  {isEditing ? (
                    <textarea
                      value={editFormData.description}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-gray-300"
                      placeholder="Agent Description"
                      rows={3}
                    />
                  ) : (
                    <p className="text-gray-400">
                      {agent.description || "No description provided."}
                    </p>
                  )}
                </div>
              </div>

              {/* Edit Button */}
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center gap-2 rounded border border-gray-600 px-3 py-1 text-gray-400 hover:bg-gray-700"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="flex items-center gap-2 rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
                      disabled={updateAgentMutation.isPending}
                    >
                      <Save className="h-4 w-4" />
                      {updateAgentMutation.isPending ? "Saving..." : "Save"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleEdit}
                    className="flex items-center gap-2 rounded border border-gray-600 px-3 py-1 text-gray-400 hover:bg-gray-700"
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Agent Details Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Skills */}
            <div className="rounded-lg border border-gray-700 bg-[#11121A] p-6">
              <h2 className="mb-4 text-xl font-semibold">Skills</h2>
              {isEditing ? (
                <div className="grid grid-cols-2 gap-2">
                  {SKILL_OPTIONS.map((skill) => (
                    <label key={skill} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editFormData.skills.includes(skill)}
                        onChange={() => handleSkillChange(skill)}
                        className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-600"
                      />
                      <span className="text-sm text-gray-300">{skill}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {displaySkills.length > 0 ? (
                    displaySkills.map((skill, index) => (
                      <span
                        key={index}
                        className="rounded-full bg-blue-600/20 px-3 py-1 text-sm text-blue-300"
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500">No skills specified</span>
                  )}
                </div>
              )}
            </div>

            {/* API Key */}
            <div className="rounded-lg border border-gray-700 bg-[#11121A] p-6">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
                <Key className="h-5 w-5" />
                API Key
              </h2>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={apiKeyData?.apiKey || ""}
                      readOnly
                      className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 pr-20 text-sm text-white"
                    />
                    <div className="absolute right-2 top-2 flex gap-1">
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-600 hover:text-white"
                      >
                        {showApiKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={copyApiKey}
                        className="rounded p-1 text-gray-400 hover:bg-gray-600 hover:text-white"
                      >
                        {apiKeyCopied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  Use this API key to authenticate your agent in competitions.
                </p>
              </div>
            </div>

            {/* Repository */}
            <div className="rounded-lg border border-gray-700 bg-[#11121A] p-6">
              <h2 className="mb-4 text-xl font-semibold">Repository</h2>
              {isEditing ? (
                <input
                  type="url"
                  value={editFormData.repositoryUrl}
                  onChange={(e) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      repositoryUrl: e.target.value,
                    }))
                  }
                  placeholder="https://github.com/username/repo"
                  className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white"
                />
              ) : metadata.repositoryUrl ? (
                <a
                  href={metadata.repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 hover:underline"
                >
                  {metadata.repositoryUrl}
                </a>
              ) : (
                <span className="text-gray-500">No repository specified</span>
              )}
            </div>

            {/* Social Links */}
            <div className="rounded-lg border border-gray-700 bg-[#11121A] p-6">
              <h2 className="mb-4 text-xl font-semibold">Social Links</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-400">
                    X (Twitter)
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editFormData.x}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          x: e.target.value,
                        }))
                      }
                      placeholder="@username or https://x.com/username"
                      className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white"
                    />
                  ) : metadata.x ? (
                    <div className="text-blue-400">
                      {metadata.x.startsWith("http") ? (
                        <a
                          href={metadata.x}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {metadata.x}
                        </a>
                      ) : (
                        <span>{metadata.x}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-500">Not specified</span>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400">
                    Telegram
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editFormData.telegram}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          telegram: e.target.value,
                        }))
                      }
                      placeholder="@username or https://t.me/username"
                      className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white"
                    />
                  ) : metadata.telegram ? (
                    <div className="text-blue-400">
                      {metadata.telegram.startsWith("http") ? (
                        <a
                          href={metadata.telegram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {metadata.telegram}
                        </a>
                      ) : (
                        <span>{metadata.telegram}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-500">Not specified</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Competitions */}
          <div className="mt-8 rounded-lg border border-gray-700 bg-[#11121A] p-6">
            <h2 className="mb-4 text-xl font-semibold">Competition History</h2>
            {competitionsLoading ? (
              <div className="text-gray-400">Loading competitions...</div>
            ) : competitionsError ? (
              <div className="text-red-400">
                Failed to load competitions: {competitionsError.message}
              </div>
            ) : competitions && competitions.length > 0 ? (
              <div className="space-y-3">
                {competitions.map((competition: any) => (
                  <div
                    key={competition.id}
                    className="rounded border border-gray-600 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-white">
                          {competition.title}
                        </h3>
                        <p className="text-sm text-gray-400">
                          Status: {competition.status}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-400">
                          Start: {new Date(competition.startDate).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-gray-400">
                          End: {new Date(competition.endDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500">
                This agent hasn't participated in any competitions yet.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}