"use client";

import { ChevronLeft, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { AgentSkillType } from "@/lib/api";

/**
 * AgentRegistrationForm component
 *
 * Form to collect agent information (step 2)
 *
 * @param initialData - Initial data to populate the form with
 * @param onBack - Function to call when back button is clicked
 * @param onNext - Function to call when next button is clicked
 * @param onSkip - Function to call when user skips this step
 */
export default function AgentRegistrationForm({
  initialData,
  onBack,
  onNext,
  onSkip,
}: {
  initialData?: AgentFormData;
  onBack?: () => void;
  onNext?: (data: AgentFormData) => void;
  onSkip?: () => void;
}) {
  const [formData, setFormData] = useState<AgentFormData>(
    initialData || {
      name: "",
      primarySkill: "",
      customSkill: "",
      repoUrl: "",
      description: "",
      avatar: "",
      twitter: "",
      telegram: "",
    },
  );

  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  const [showCustomSkill, setShowCustomSkill] = useState(
    formData.primarySkill === AgentSkillType.Other,
  );
  const [isValidAvatar, setIsValidAvatar] = useState(true);

  // Update formData when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      setShowCustomSkill(initialData.primarySkill === AgentSkillType.Other);
      setShowAvatarPreview(!!initialData.avatar);
    }
  }, [initialData]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;

    if (name === "primarySkill") {
      // Check if "Other" is selected and show custom skill input
      setShowCustomSkill(value === AgentSkillType.Other);
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onNext) onNext(formData);
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
                    The name of your agent, or how they'd like to be known.
                  </p>
                </div>

                {/* Primary Skill Field */}
                <div className="flex w-full flex-col gap-1.5">
                  <label className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#93A5BA]">
                    Primary Skill
                  </label>
                  <select
                    name="primarySkill"
                    value={formData.primarySkill}
                    onChange={handleChange}
                    className="w-full appearance-none rounded-md border border-[#43505F] bg-[#1D1F2B] px-3 py-2 font-['Replica_LL',sans-serif] text-lg text-white focus:border-[#62A0DD] focus:outline-none"
                  >
                    <option value="" className="text-[#43505F]">
                      Select an Option
                    </option>
                    {Object.values(AgentSkillType).map((skill) => (
                      <option key={skill} value={skill}>
                        {skill}
                      </option>
                    ))}
                  </select>
                  <p className="font-['Replica_LL',sans-serif] text-sm leading-[21px] tracking-[0.42px] text-[#596E89]">
                    Choose what your agent does best.
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
                      Please specify your agent's custom skill.
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

              {/* Action Buttons */}
              <div className="mt-8 flex w-full flex-col items-center gap-4">
                <div className="flex w-full">
                  <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center justify-center gap-2 border border-[#303846] px-6 py-4"
                  >
                    <ChevronLeft className="h-3 w-3 text-[#303846]" />
                    <span className="font-['Trim_Mono',monospace] text-xs font-semibold uppercase tracking-[1.56px] text-[#303846]">
                      back
                    </span>
                  </button>
                  <button
                    type="submit"
                    className="flex flex-1 items-center justify-center border-l border-r border-[#212C3A] bg-[#0057AD] py-[17px]"
                  >
                    <span className="font-['Trim_Mono',monospace] text-xs font-semibold uppercase tracking-[1.56px] text-[#E9EDF1]">
                      Next
                    </span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onSkip}
                  className="font-['Trim_Mono',monospace] text-sm font-semibold text-[#62A0DD] hover:underline"
                >
                  Skip this step
                </button>
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
  primarySkill: string;
  customSkill: string;
  repoUrl: string;
  description: string;
  avatar: string;
  twitter: string;
  telegram: string;
}
