"use client";

import { ChevronLeft, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { useCreateAgent } from "@/hooks/useCreateAgent";
import { useUpdateProfile } from "@/hooks/useProfile";

import { ProfileFormData } from "./developer-profile-form";

// Agent skills constants like in comps app
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
 * AgentRegistrationForm component
 *
 * Form to collect agent information (step 2)
 *
 * @param initialData - Initial data to populate the form with
 * @param profileData - Profile data from the previous step
 * @param onBack - Function to call when back button is clicked
 * @param onNext - Function to call when next button is clicked
 */
export default function AgentRegistrationForm({
  initialData,
  profileData,
  onBack,
  onNext,
}: {
  initialData?: AgentFormData;
  profileData: ProfileFormData;
  onBack?: () => void;
  onNext?: (data: AgentFormData) => void;
}) {
  const { address } = useAccount();
  const [formData, setFormData] = useState<AgentFormData>(
    initialData || {
      name: "",
      selectedSkills: [],
      customSkill: "",
      repoUrl: "",
      description: "",
      avatar: "",
      twitter: "",
      telegram: "",
      apiKey: "",
    },
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  const [showCustomSkill, setShowCustomSkill] = useState(
    formData.selectedSkills.includes("Other"),
  );
  const [isValidAvatar, setIsValidAvatar] = useState(true);

  const updateProfileMutation = useUpdateProfile();
  const createAgentMutation = useCreateAgent();

  // Update formData when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      setShowCustomSkill(initialData.selectedSkills.includes("Other"));
      setShowAvatarPreview(!!initialData.avatar);
    }
  }, [initialData]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSkillChange = (skill: string) => {
    setFormData((prev) => {
      // Check if skill is already selected
      const isSelected = prev.selectedSkills.includes(skill);

      // Toggle the selection
      const updatedSkills = isSelected
        ? prev.selectedSkills.filter((s) => s !== skill)
        : [...prev.selectedSkills, skill];

      // Update custom skill visibility
      setShowCustomSkill(updatedSkills.includes("Other"));

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
    if (!address) {
      setError("Wallet connection required.");
      return;
    }

    // Agent name is now required
    if (!formData.name.trim()) {
      setError("Agent name is required.");
      return;
    }

    // Validate custom skill if "Other" is selected
    if (formData.selectedSkills.includes("Other") && !formData.customSkill) {
      setError("Please specify your custom skill.");
      return;
    }

    try {
      setIsSubmitting(true);

      // First, update the profile with any additional metadata
      const profileUpdateData = {
        name: profileData.name,
        email: profileData.email,
        ...(profileData.description && {
          description: profileData.description,
        }),
        ...(profileData.website && {
          metadata: { website: profileData.website },
        }),
      };

      await updateProfileMutation.mutateAsync(profileUpdateData);

      // Prepare skills array (replace "Other" with custom skill if provided)
      const finalSkills =
        formData.selectedSkills.includes("Other") && formData.customSkill
          ? [
              ...formData.selectedSkills.filter((skill) => skill !== "Other"),
              formData.customSkill,
            ]
          : formData.selectedSkills;

      // Create the agent
      const agentData = {
        name: formData.name,
        ...(formData.description && { description: formData.description }),
        ...(formData.avatar && { imageUrl: formData.avatar }),
        metadata: {
          skills: finalSkills,
          ...(formData.repoUrl && { repositoryUrl: formData.repoUrl }),
          ...(formData.twitter && { twitter: formData.twitter }),
          ...(formData.telegram && { telegram: formData.telegram }),
        },
      };

      const response = await createAgentMutation.mutateAsync(agentData);

      // Store the API key for the next step
      const updatedFormData = {
        ...formData,
        apiKey: response.agent.apiKey,
      };

      // Call onNext to proceed to the success step
      if (onNext) {
        onNext(updatedFormData);
      }
    } catch (err) {
      console.error("Registration failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to register. Please try again.",
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
          Agent Information
        </h2>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-[#6D85A4] hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded border border-red-600 bg-red-600/10 p-3 text-red-400">
            {error}
          </div>
        )}

        {/* Agent Name - Required */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-white">
            Agent Name *
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter your agent's name"
            className="w-full rounded border border-[#303846] bg-[#1A1D26] px-3 py-2 text-white placeholder-[#6D85A4] focus:border-[#4F7396] focus:outline-none"
            required
          />
        </div>

        {/* Agent Skills */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-white">
            Agent Skills
          </label>
          <p className="text-sm text-[#6D85A4]">Choose all that apply.</p>
          <div className="grid grid-cols-2 gap-2">
            {AGENT_SKILLS.map((skill) => (
              <label key={skill} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.selectedSkills.includes(skill)}
                  onChange={() => handleSkillChange(skill)}
                  className="h-4 w-4 rounded border-[#303846] bg-[#1A1D26] text-[#4F7396] focus:ring-[#4F7396]"
                />
                <span className="text-sm text-[#6D85A4]">{skill}</span>
              </label>
            ))}
          </div>

          {/* Custom Skill Input */}
          {showCustomSkill && (
            <div className="mt-3">
              <input
                type="text"
                name="customSkill"
                value={formData.customSkill}
                onChange={handleChange}
                placeholder="Please specify your custom skill..."
                className="w-full rounded border border-[#303846] bg-[#1A1D26] px-3 py-2 text-white placeholder-[#6D85A4] focus:border-[#4F7396] focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Repository URL */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-white">
            Repository URL
          </label>
          <input
            type="url"
            name="repoUrl"
            value={formData.repoUrl}
            onChange={handleChange}
            placeholder="https://github.com/your-repo"
            className="w-full rounded border border-[#303846] bg-[#1A1D26] px-3 py-2 text-white placeholder-[#6D85A4] focus:border-[#4F7396] focus:outline-none"
          />
          <p className="text-sm text-[#6D85A4]">Link to code or docs.</p>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-white">
            Description (Optional)
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe your agent..."
            rows={3}
            className="w-full rounded border border-[#303846] bg-[#1A1D26] px-3 py-2 text-white placeholder-[#6D85A4] focus:border-[#4F7396] focus:outline-none"
          />
        </div>

        {/* Avatar URL */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-white">
            Avatar URL (Optional)
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              name="avatar"
              value={formData.avatar}
              onChange={handleChange}
              placeholder="https://example.com/avatar.png"
              className="flex-1 rounded border border-[#303846] bg-[#1A1D26] px-3 py-2 text-white placeholder-[#6D85A4] focus:border-[#4F7396] focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAvatarSubmit}
              className="rounded bg-[#4F7396] px-4 py-2 text-white hover:bg-[#6D85A4]"
            >
              Preview
            </button>
          </div>

          {/* Avatar Preview */}
          {showAvatarPreview && (
            <div className="relative mt-2">
              {isValidAvatar ? (
                <div className="flex items-center gap-3">
                  <img
                    src={formData.avatar}
                    alt="Avatar preview"
                    width={64}
                    height={64}
                    className="h-16 w-16 rounded-full object-cover"
                    onError={handleImageError}
                  />
                  <button
                    type="button"
                    onClick={handleDeleteAvatar}
                    className="rounded p-1 text-red-400 hover:bg-red-600/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <p className="text-sm text-red-400">
                  Failed to load image. Please check the URL.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Social Links */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white">
              Twitter (Optional)
            </label>
            <input
              type="text"
              name="twitter"
              value={formData.twitter}
              onChange={handleChange}
              placeholder="@username or URL"
              className="w-full rounded border border-[#303846] bg-[#1A1D26] px-3 py-2 text-white placeholder-[#6D85A4] focus:border-[#4F7396] focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-white">
              Telegram (Optional)
            </label>
            <input
              type="text"
              name="telegram"
              value={formData.telegram}
              onChange={handleChange}
              placeholder="@username or URL"
              className="w-full rounded border border-[#303846] bg-[#1A1D26] px-3 py-2 text-white placeholder-[#6D85A4] focus:border-[#4F7396] focus:outline-none"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded bg-[#4F7396] py-3 font-medium text-white hover:bg-[#6D85A4] disabled:opacity-50"
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating Agent...
            </div>
          ) : (
            "Create Agent"
          )}
        </button>
      </form>
    </div>
  );
}

export interface AgentFormData {
  name: string;
  selectedSkills: string[];
  customSkill: string;
  repoUrl: string;
  description: string;
  avatar: string;
  twitter: string;
  telegram: string;
  apiKey?: string;
}
