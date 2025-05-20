"use client";

import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * DeveloperProfileForm component
 *
 * Form to collect developer profile information
 *
 * @param initialData - Initial data to populate the form with
 * @param onBack - Function to call when back button is clicked
 * @param onNext - Function to call when next button is clicked
 */
export default function DeveloperProfileForm({
  initialData,
  onBack,
  onNext,
}: {
  initialData?: ProfileFormData;
  onBack?: () => void;
  onNext?: (data: ProfileFormData) => void;
}) {
  const [formData, setFormData] = useState<ProfileFormData>(
    initialData || {
      name: "",
      email: "",
      website: "",
      description: "",
      telegram: "",
    },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update formData when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error for the field being edited
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm() && onNext) {
      onNext(formData);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#050507] py-8">
      <div className="container relative mx-auto flex max-w-6xl flex-col items-center justify-center px-4">
        <div className="flex w-[465px] flex-col items-center gap-8">
          {/* Header */}
          <div className="flex w-full flex-col gap-2">
            <div className="flex w-full items-center justify-start gap-8">
              <div className="font-['Trim_Mono',monospace] text-xl font-semibold leading-[26px] text-[#E9EDF1]">
                Step 1 of 3
              </div>
              <div className="flex items-center gap-4 rounded-full p-2">
                <div className="h-4 w-4 rounded-full bg-[#62A0DD]"></div>
                <div className="h-4 w-4 rounded-full bg-[#1D1F2B]"></div>
                <div className="h-4 w-4 rounded-full bg-[#1D1F2B]"></div>
              </div>
            </div>
            <h1 className="font-['Replica_LL',sans-serif] text-4xl font-bold leading-[57.6px] text-[#E9EDF1] md:text-5xl">
              Developer Profile
            </h1>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex w-full flex-col gap-7">
            {/* Name Field */}
            <div className="flex w-full flex-col gap-1.5">
              <label className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#93A5BA]">
                Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="E.g.: Walter White"
                className={`w-full rounded-md border ${errors.name ? "border-red-500" : "border-[#43505F]"} bg-[#1D1F2B] px-3 py-2 font-['Replica_LL',sans-serif] text-lg text-white placeholder:text-[#43505F] focus:border-[#62A0DD] focus:outline-none`}
              />
              {errors.name ? (
                <p className="font-['Replica_LL',sans-serif] text-sm leading-[21px] tracking-[0.42px] text-red-500">
                  {errors.name}
                </p>
              ) : (
                <p className="font-['Replica_LL',sans-serif] text-sm leading-[21px] tracking-[0.42px] text-[#596E89]">
                  The name you go by professionally, or how you&apos;d like to
                  be known.
                </p>
              )}
            </div>

            {/* Email Field */}
            <div className="flex w-full flex-col gap-1.5">
              <label className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#93A5BA]">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="E.g.: walterwhite@gmail.com"
                className={`w-full rounded-md border ${errors.email ? "border-red-500" : "border-[#43505F]"} bg-[#1D1F2B] px-3 py-2 font-['Replica_LL',sans-serif] text-lg text-white placeholder:text-[#43505F] focus:border-[#62A0DD] focus:outline-none`}
              />
              {errors.email ? (
                <p className="font-['Replica_LL',sans-serif] text-sm leading-[21px] tracking-[0.42px] text-red-500">
                  {errors.email}
                </p>
              ) : (
                <p className="font-['Replica_LL',sans-serif] text-sm leading-[21px] tracking-[0.42px] text-[#596E89]">
                  We&apos;ll email your API key here - make sure it&apos;s one
                  you check often.
                </p>
              )}
            </div>

            {/* Description Field */}
            <div className="flex w-full flex-col gap-1.5">
              <label className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#93A5BA]">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Tell us about yourself or your project..."
                rows={4}
                className="w-full resize-none rounded-md border border-[#43505F] bg-[#1D1F2B] px-3 py-2 font-['Replica_LL',sans-serif] text-lg text-white placeholder:text-[#43505F] focus:border-[#62A0DD] focus:outline-none"
              />
              <p className="font-['Replica_LL',sans-serif] text-sm leading-[21px] tracking-[0.42px] text-[#596E89]">
                A brief description about you or your development focus.
              </p>
            </div>

            {/* Website Field */}
            <div className="flex w-full flex-col gap-1.5">
              <label className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#93A5BA]">
                GitHub or Website (optional)
              </label>
              <input
                type="text"
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="E.g.: https://walterwhite.com"
                className="w-full rounded-md border border-[#43505F] bg-[#1D1F2B] px-3 py-2 font-['Replica_LL',sans-serif] text-lg text-white placeholder:text-[#43505F] focus:border-[#62A0DD] focus:outline-none"
              />
              <p className="font-['Replica_LL',sans-serif] text-sm leading-[21px] tracking-[0.42px] text-[#596E89]">
                So others can learn more about you and your work!
              </p>
            </div>

            {/* Telegram Field */}
            <div className="flex w-full flex-col gap-1.5">
              <label className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#93A5BA]">
                Telegram (optional)
              </label>
              <input
                type="text"
                name="telegram"
                value={formData.telegram}
                onChange={handleChange}
                placeholder="E.g.: @username"
                className="w-full rounded-md border border-[#43505F] bg-[#1D1F2B] px-3 py-2 font-['Replica_LL',sans-serif] text-lg text-white placeholder:text-[#43505F] focus:border-[#62A0DD] focus:outline-none"
              />
              <p className="font-['Replica_LL',sans-serif] text-sm leading-[21px] tracking-[0.42px] text-[#596E89]">
                Your Telegram username for communication about competitions.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="mt-4 flex w-full flex-col items-center gap-4">
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
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Type for form data
export interface ProfileFormData {
  name: string;
  email: string;
  website: string;
  description: string;
  telegram: string;
}
