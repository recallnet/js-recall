"use client";

import { Check, Loader2, Trash2, X } from "lucide-react";
import { useState } from "react";

import {
  Agent,
  AgentSkill,
  AgentSkillType,
  Team,
  updateTeamProfile,
} from "@/lib/api";

/**
 * AgentAddForm component
 *
 * Form to add a new agent to an existing team profile
 *
 * @param team - Current team data
 * @param onSuccess - Callback for when an agent is successfully added
 * @param onCancel - Callback for when the form is cancelled
 */
export default function AgentAddForm({
  team,
  onSuccess,
  onCancel,
}: {
  team: Team;
  onSuccess: (updatedTeam: Team) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<{
    name: string;
    selectedSkills: AgentSkillType[];
    customSkill: string;
    repoUrl: string;
    description: string;
    avatar: string;
    twitter: string;
    telegram: string;
  }>({
    name: "",
    selectedSkills: [],
    customSkill: "",
    repoUrl: "",
    description: "",
    avatar: "",
    twitter: "",
    telegram: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  const [showCustomSkill, setShowCustomSkill] = useState(false);
  const [isValidAvatar, setIsValidAvatar] = useState(true);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSkillChange = (skill: AgentSkillType) => {
    setFormData((prev) => {
      // Check if skill is already selected
      const isSelected = prev.selectedSkills.includes(skill);

      // Toggle the selection
      const updatedSkills = isSelected
        ? prev.selectedSkills.filter((s) => s !== skill)
        : [...prev.selectedSkills, skill];

      // Update custom skill visibility
      if (skill === AgentSkillType.Other) {
        setShowCustomSkill(!isSelected);
      }

      return {
        ...prev,
        selectedSkills: updatedSkills,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError("Agent name is required.");
      return;
    }

    if (!formData.avatar.trim()) {
      setError("Agent avatar is required.");
      return;
    }

    // Validate custom skill if "Other" is selected
    if (
      formData.selectedSkills.includes(AgentSkillType.Other) &&
      !formData.customSkill
    ) {
      setError("Please specify your custom skill.");
      return;
    }

    try {
      setIsSubmitting(true);

      // Prepare the agent data from the form
      const newAgent: Agent = {
        name: formData.name,
        description: formData.description,
        url: formData.repoUrl,
        imageUrl: formData.avatar,
        skills: formData.selectedSkills.map((skillType) => {
          return {
            type: skillType,
            customSkill:
              skillType === AgentSkillType.Other
                ? formData.customSkill
                : undefined,
          } as AgentSkill;
        }),
        social: {
          twitter: formData.twitter,
          telegram: formData.telegram,
        },
      };

      // Create an updated metadata array with the new agent
      const updatedMetadata = team.metadata
        ? [...team.metadata, newAgent]
        : [newAgent];

      // Update the team profile with the new agent
      const updatedTeam = await updateTeamProfile(
        {
          metadata: updatedMetadata,
        },
        team.apiKey || "",
      );

      if (!updatedTeam) {
        throw new Error("Failed to update team profile");
      }

      // Call the onSuccess callback with the updated team data
      onSuccess(updatedTeam);
    } catch (err) {
      console.error("Agent addition failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to add agent. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAvatarSubmit = () => {
    if (formData.avatar.trim()) {
      setIsValidAvatar(true);
      setShowAvatarPreview(true);
    } else {
      setIsValidAvatar(false);
    }
  };

  const handleDeleteAvatar = () => {
    setFormData((prev) => ({ ...prev, avatar: "" }));
    setShowAvatarPreview(false);
  };

  const handleImageError = () => {
    setIsValidAvatar(false);
  };

  return (
    <div className="w-full rounded-lg border border-[#303846] bg-[#11121A] p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-['Trim_Mono',monospace] text-xl font-semibold leading-[31.2px] text-white">
          Add New Agent
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full p-1 text-[#6D85A4] hover:bg-[#303846] hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Agent Name Field */}
        <div className="flex flex-col gap-1.5">
          <label className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#93A5BA]">
            Agent Name*
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder='E.g. "Acme Chatbot"'
            className="w-full rounded-md border border-[#43505F] bg-[#1D1F2B] px-3 py-2 font-['Replica_LL',sans-serif] text-lg text-white placeholder:text-[#43505F] focus:border-[#62A0DD] focus:outline-none"
            required
          />
        </div>

        {/* Skills Field - Multiple Selection */}
        <div className="flex flex-col gap-1.5">
          <label className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#93A5BA]">
            Agent Skills (Select all that apply)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(AgentSkillType).map((skill) => (
              <div
                key={skill}
                className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 transition-colors duration-200 ${
                  formData.selectedSkills.includes(skill)
                    ? "border-[#62A0DD] bg-[#1D2736]"
                    : "border-[#43505F] bg-[#1D1F2B]"
                }`}
                onClick={() => handleSkillChange(skill)}
              >
                <div
                  className={`h-4 w-4 rounded-sm border ${
                    formData.selectedSkills.includes(skill)
                      ? "border-[#62A0DD] bg-[#62A0DD]"
                      : "border-[#43505F]"
                  }`}
                >
                  {formData.selectedSkills.includes(skill) && (
                    <Check size={16} className="text-[#050507]" />
                  )}
                </div>
                <span className="font-['Replica_LL',sans-serif] text-base text-white">
                  {skill}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Custom Skill Field - Only shown when Other is selected */}
        {showCustomSkill && (
          <div className="flex flex-col gap-1.5">
            <label className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#93A5BA]">
              Custom Skill
            </label>
            <input
              type="text"
              name="customSkill"
              value={formData.customSkill}
              onChange={handleChange}
              placeholder="Enter your custom skill..."
              className="w-full rounded-md border border-[#43505F] bg-[#1D1F2B] px-3 py-2 font-['Replica_LL',sans-serif] text-lg text-white placeholder:text-[#43505F] focus:border-[#62A0DD] focus:outline-none"
            />
          </div>
        )}

        {/* Avatar Field */}
        <div className="flex flex-col gap-1.5">
          <label className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#93A5BA]">
            Avatar URL*
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              name="avatar"
              value={formData.avatar}
              onChange={handleChange}
              placeholder="Enter the avatar URL..."
              className={`flex-1 rounded-md border bg-[#1D1F2B] px-3 py-2 ${
                !isValidAvatar ? "border-red-500" : "border-[#43505F]"
              } font-['Replica_LL',sans-serif] text-lg text-white placeholder:text-[#43505F] focus:border-[#62A0DD] focus:outline-none`}
              required
            />
            <button
              type="button"
              onClick={handleAvatarSubmit}
              className="rounded-md bg-[#0057AD] px-4 py-2 font-['Trim_Mono',monospace] text-xs font-semibold uppercase tracking-[1.56px] text-[#E9EDF1]"
            >
              Submit
            </button>
          </div>
          {!isValidAvatar && (
            <p className="font-['Replica_LL',sans-serif] text-sm leading-[21px] tracking-[0.42px] text-red-500">
              Please enter a valid image URL
            </p>
          )}

          {/* Avatar Preview */}
          {showAvatarPreview && formData.avatar && (
            <div className="mt-3 flex items-start gap-2">
              <div className="relative h-12 w-12 overflow-hidden rounded-md bg-[#1D1F2B]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={formData.avatar}
                  alt="Avatar preview"
                  className="h-full w-full object-cover"
                  onError={handleImageError}
                />
              </div>
              <button
                type="button"
                onClick={handleDeleteAvatar}
                className="p-1 text-[#E9EDF1] transition-colors hover:text-red-400"
                aria-label="Delete avatar"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Repository URL Field */}
        <div className="flex flex-col gap-1.5">
          <label className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#93A5BA]">
            Repository URL
          </label>
          <input
            type="text"
            name="repoUrl"
            value={formData.repoUrl}
            onChange={handleChange}
            placeholder="E.g.: https://github.com/yourusername/agent-repo"
            className="w-full rounded-md border border-[#43505F] bg-[#1D1F2B] px-3 py-2 font-['Replica_LL',sans-serif] text-lg text-white placeholder:text-[#43505F] focus:border-[#62A0DD] focus:outline-none"
          />
        </div>

        {/* Description Field */}
        <div className="flex flex-col gap-1.5">
          <label className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#93A5BA]">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe what your agent does..."
            rows={3}
            className="w-full resize-none rounded-md border border-[#43505F] bg-[#1D1F2B] px-3 py-2 font-['Replica_LL',sans-serif] text-lg text-white placeholder:text-[#43505F] focus:border-[#62A0DD] focus:outline-none"
          />
        </div>

        {/* Social Links */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Twitter Field */}
          <div className="flex flex-col gap-1.5">
            <label className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#93A5BA]">
              X (Twitter)
            </label>
            <input
              type="text"
              name="twitter"
              value={formData.twitter}
              onChange={handleChange}
              placeholder="E.g.: https://x.com/youragent"
              className="w-full rounded-md border border-[#43505F] bg-[#1D1F2B] px-3 py-2 font-['Replica_LL',sans-serif] text-lg text-white placeholder:text-[#43505F] focus:border-[#62A0DD] focus:outline-none"
            />
          </div>

          {/* Telegram Field */}
          <div className="flex flex-col gap-1.5">
            <label className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#93A5BA]">
              Telegram
            </label>
            <input
              type="text"
              name="telegram"
              value={formData.telegram}
              onChange={handleChange}
              placeholder="E.g.: https://t.me/youragent"
              className="w-full rounded-md border border-[#43505F] bg-[#1D1F2B] px-3 py-2 font-['Replica_LL',sans-serif] text-lg text-white placeholder:text-[#43505F] focus:border-[#62A0DD] focus:outline-none"
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-md bg-red-500/10 px-4 py-3 text-center">
            <p className="font-['Replica_LL',sans-serif] text-sm text-red-500">
              {error}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-4 flex gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-md border border-[#43505F] py-3 font-['Trim_Mono',monospace] text-xs font-semibold uppercase tracking-wider text-[#6D85A4]"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 rounded-md bg-[#0057AD] py-3 font-['Trim_Mono',monospace] text-xs font-semibold uppercase tracking-wider text-[#E9EDF1] disabled:opacity-70"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </span>
            ) : (
              "Add Agent"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
