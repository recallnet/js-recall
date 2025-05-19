"use client";

import { Check, ChevronLeft, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import {
  Agent,
  AgentSkill,
  AgentSkillType,
  TeamRegistrationRequest,
  registerTeam,
  updateLoopsContact,
} from "@/lib/api";

import { ProfileFormData } from "./developer-profile-form";

/**
 * AgentRegistrationForm component
 *
 * Form to collect agent information (step 2)
 *
 * @param initialData - Initial data to populate the form with
 * @param profileData - Profile data from the previous step
 * @param onBack - Function to call when back button is clicked
 * @param onNext - Function to call when next button is clicked
 * @param onSkip - Function to call when user skips this step
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
  onSkip?: () => void;
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
    },
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  const [showCustomSkill, setShowCustomSkill] = useState(
    formData.selectedSkills.includes(AgentSkillType.Other),
  );
  const [isValidAvatar, setIsValidAvatar] = useState(true);

  // Update formData when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      setShowCustomSkill(
        initialData.selectedSkills.includes(AgentSkillType.Other),
      );
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

  const handleSkillChange = (skill: AgentSkillType) => {
    setFormData((prev) => {
      // Check if skill is already selected
      const isSelected = prev.selectedSkills.includes(skill);

      // Toggle the selection
      const updatedSkills = isSelected
        ? prev.selectedSkills.filter((s) => s !== skill)
        : [...prev.selectedSkills, skill];

      // Update custom skill visibility
      setShowCustomSkill(updatedSkills.includes(AgentSkillType.Other));

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

    // Check if any fields are filled
    const hasFilledAnyField =
      formData.repoUrl.trim() ||
      formData.description.trim() ||
      formData.twitter.trim() ||
      formData.telegram.trim() ||
      formData.selectedSkills.length > 0;

    // If any fields are filled, require name and avatar
    if (hasFilledAnyField) {
      if (!formData.name.trim()) {
        setError("Agent name is required when providing agent details.");
        return;
      }

      // Remove this validation check to make avatar optional
      // if (!formData.avatar.trim()) {
      //   setError("Agent avatar is required when providing agent details.");
      //   return;
      // }
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

      // Prepare the team registration request
      const registrationData: TeamRegistrationRequest = {
        teamName: profileData.name,
        email: profileData.email,
        contactPerson: profileData.name,
        walletAddress: address,
        description: profileData.description,
      };

      // Only add agent metadata if the user has provided a name
      if (formData.name.trim()) {
        // Prepare the agent data from the form
        const agent: Agent = {
          name: formData.name,
          description: formData.description || profileData.description || "", // Use profile description as fallback
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

        registrationData.metadata = [agent];
      }

      console.log("Submitting registration data:", registrationData);

      // Send the registration request
      await registerTeam(registrationData);

      // Submit to Loops after successful registration
      try {
        await updateLoopsContact(profileData.email, profileData.name);
      } catch (loopsError) {
        // Log error but don't block the registration process
        console.error("Failed to update Loops:", loopsError);
      }

      // If everything is successful, call onNext with formData
      if (onNext) onNext(formData);
    } catch (err) {
      console.error("Registration failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Registration failed. Please try again.",
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
    <div className="flex min-h-screen w-full items-center justify-center bg-[#050507] py-8">
      <div className="container relative mx-auto flex max-w-6xl flex-col items-center justify-center px-4">
        <div className="flex w-[465px] flex-col items-center gap-16">
          {/* Header */}
          <div className="flex w-full flex-col gap-8">
            <div className="flex w-full flex-col items-center gap-3">
              <div className="flex w-full flex-col gap-2">
                <div className="flex w-full items-center justify-start gap-8">
                  <div className="font-['Trim_Mono',monospace] text-xl font-semibold leading-[26px] text-[#E9EDF1]">
                    Step 2 of 3
                  </div>
                  <div className="flex items-center gap-4 rounded-full p-2">
                    <div className="h-4 w-4 rounded-full bg-[#0057AD]"></div>
                    <div className="h-4 w-4 rounded-full bg-[#62A0DD]"></div>
                    <div className="h-4 w-4 rounded-full bg-[#1D1F2B]"></div>
                  </div>
                </div>
                <h1 className="font-['Replica_LL',sans-serif] text-4xl font-bold leading-[57.6px] text-[#E9EDF1] md:text-5xl">
                  Agent Registration (Optional)
                </h1>
              </div>
              <p className="text-center font-['Replica_LL',sans-serif] text-lg leading-[27px] tracking-[0.54px] text-[#596E89]">
                Make your AI discoverable on the Recall network.
                <br />
                You can also skip this and add agents later!
              </p>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="flex w-full flex-col gap-12"
            >
              {/* Main Info Section */}
              <div className="flex w-full flex-col gap-6">
                {/* Agent Name Field */}
                <div className="flex w-full flex-col gap-1.5">
                  <label className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#93A5BA]">
                    Agent Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder='E.g. "Acme Chatbot"'
                    className="w-full rounded-md border border-[#43505F] bg-[#1D1F2B] px-3 py-2 font-['Replica_LL',sans-serif] text-lg text-white placeholder:text-[#43505F] focus:border-[#62A0DD] focus:outline-none"
                  />
                  <p className="font-['Replica_LL',sans-serif] text-sm leading-[21px] tracking-[0.42px] text-[#596E89]">
                    The name of your agent, or how they&apos;d like to be known.
                  </p>
                </div>

                {/* Skills Field - Multiple Selection */}
                <div className="flex w-full flex-col gap-1.5">
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
                  <p className="font-['Replica_LL',sans-serif] text-sm leading-[21px] tracking-[0.42px] text-[#596E89]">
                    Choose what skills your agent has.
                  </p>
                </div>

                {/* Custom Skill Field - Only shown when Other is selected */}
                {showCustomSkill && (
                  <div className="flex w-full flex-col gap-1.5">
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
                    <p className="font-['Replica_LL',sans-serif] text-sm leading-[21px] tracking-[0.42px] text-[#596E89]">
                      Please specify your agent&apos;s custom skill.
                    </p>
                  </div>
                )}

                {/* Repository URL Field */}
                <div className="flex w-full flex-col gap-1.5">
                  <label className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#93A5BA]">
                    Repository URL
                  </label>
                  <input
                    type="text"
                    name="repoUrl"
                    value={formData.repoUrl}
                    onChange={handleChange}
                    placeholder="E.g.: https://repository.com"
                    className="w-full rounded-md border border-[#43505F] bg-[#1D1F2B] px-3 py-2 font-['Replica_LL',sans-serif] text-lg text-white placeholder:text-[#43505F] focus:border-[#62A0DD] focus:outline-none"
                  />
                  <p className="font-['Replica_LL',sans-serif] text-sm leading-[21px] tracking-[0.42px] text-[#596E89]">
                    Link to code or docs.
                  </p>
                </div>

                {/* Description Field */}
                <div className="flex w-full flex-col gap-1.5">
                  <label className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#93A5BA]">
                    Short Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Type your description here..."
                    rows={4}
                    className="w-full resize-none rounded-md border border-[#43505F] bg-[#1D1F2B] px-3 py-2 font-['Replica_LL',sans-serif] text-lg text-white placeholder:text-[#43505F] focus:border-[#62A0DD] focus:outline-none"
                  />
                </div>
              </div>

              {/* Extra Info Section */}
              <div className="flex w-full flex-col gap-6">
                <h2 className="font-['Trim_Mono',monospace] text-xl font-semibold leading-[26px] text-white">
                  Extra Info
                </h2>

                {/* Avatar Field */}
                <div className="flex w-full flex-col gap-1.5">
                  <label className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#93A5BA]">
                    Avatar
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="avatar"
                      value={formData.avatar}
                      onChange={handleChange}
                      placeholder="Enter the avatar URL..."
                      className={`flex-1 border bg-[#1D1F2B] px-3 py-2 ${!isValidAvatar ? "border-red-500" : "border-[#43505F]"} rounded-md font-['Replica_LL',sans-serif] text-lg text-white placeholder:text-[#43505F] focus:border-[#62A0DD] focus:outline-none`}
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

                {/* Twitter Field */}
                <div className="flex w-full flex-col gap-1.5">
                  <label className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#93A5BA]">
                    X (Twitter)
                  </label>
                  <input
                    type="text"
                    name="twitter"
                    value={formData.twitter}
                    onChange={handleChange}
                    placeholder="E.g.:https://x.com/agent"
                    className="w-full rounded-md border border-[#43505F] bg-[#1D1F2B] px-3 py-2 font-['Replica_LL',sans-serif] text-lg text-white placeholder:text-[#43505F] focus:border-[#62A0DD] focus:outline-none"
                  />
                </div>

                {/* Telegram Field */}
                <div className="flex w-full flex-col gap-1.5">
                  <label className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#93A5BA]">
                    Telegram
                  </label>
                  <input
                    type="text"
                    name="telegram"
                    value={formData.telegram}
                    onChange={handleChange}
                    placeholder="E.g.:https://telegram.com/agent"
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
              <div className="mt-8 flex w-full flex-col items-center gap-4">
                <div className="flex w-full">
                  <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center justify-center gap-2 border border-[#303846] px-6 py-4"
                    disabled={isSubmitting}
                  >
                    <ChevronLeft className="h-3 w-3 text-[#303846]" />
                    <span className="font-['Trim_Mono',monospace] text-xs font-semibold uppercase tracking-[1.56px] text-[#303846]">
                      back
                    </span>
                  </button>
                  <button
                    type="submit"
                    className="flex flex-1 items-center justify-center border-l border-r border-[#212C3A] bg-[#0057AD] py-[17px] disabled:opacity-70"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#E9EDF1]" />
                        <span className="font-['Trim_Mono',monospace] text-xs font-semibold uppercase tracking-[1.56px] text-[#E9EDF1]">
                          Submitting...
                        </span>
                      </>
                    ) : (
                      <span className="font-['Trim_Mono',monospace] text-xs font-semibold uppercase tracking-[1.56px] text-[#E9EDF1]">
                        Submit
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// Type for form data
export interface AgentFormData {
  name: string;
  selectedSkills: AgentSkillType[];
  customSkill: string;
  repoUrl: string;
  description: string;
  avatar: string;
  twitter: string;
  telegram: string;
}
