import { useEffect } from "react";
import { useState } from "react";
import { twMerge } from "tailwind-merge";

import { useSubscribe } from "@/hooks/useSubscribe";

import { WaitlistState } from "../Waitlist";
import { CrossIcon } from "../Waitlist/CrossIcon";

export interface FormProps {
  setState: (state: WaitlistState) => void;
}

export const Form = ({ setState }: FormProps) => {
  const { email, status, message, handleSubmit, setEmail } = useSubscribe({
    listType: "general",
    onSuccess: () => setState("success"),
  });

  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    setIsRendered(true);
  }, []);

  return (
    <div className="flex h-full flex-col justify-center pb-[34px] pl-[10px] pr-[15px] pt-[10px] lg:pr-[37px]">
      <form
        onSubmit={handleSubmit}
        className={twMerge(
          "transition-opacity duration-500",
          isRendered ? "opacity-100" : "opacity-0",
        )}
      >
        <span className="text-foreground font-secondary block text-[12px] font-semibold uppercase leading-[13px] tracking-[1.32px] lg:mb-[14px]">
          Subscribe to newsletter
        </span>
        <div className="flex flex-row gap-[12px] lg:gap-[30px]">
          <div className="field-decoration relative w-full">
            <input
              type="email"
              id="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your Email"
              autoFocus
              className="border-foreground text-foreground h-[67px] w-full border-b bg-transparent px-[10px] pb-5 pt-4 text-[18px] leading-[20px] outline-none placeholder:text-[rgba(33,33,33,0.5)] lg:text-[28px] lg:leading-[30px]"
            />
          </div>

          <button
            type="submit"
            disabled={status === "loading"}
            className="text-foreground font-feature-ss08 group flex items-center justify-center gap-[10px] rounded-md text-[18px] font-bold leading-[20px] disabled:opacity-50 lg:text-[28px] lg:leading-[30px]"
          >
            <span>Join</span>
            <span className="shrink-0 transition-transform duration-300 group-hover:rotate-90">
              <CrossIcon />
            </span>
          </button>
        </div>
      </form>

      {status === "error" && (
        <div className="mt-4 rounded-md bg-red-50 p-4 text-red-700">
          {message}
        </div>
      )}
    </div>
  );
};
