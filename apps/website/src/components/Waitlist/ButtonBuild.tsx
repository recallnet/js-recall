import { twMerge } from "tailwind-merge";

import { CrossIcon } from "./CrossIcon";

export const ButtonBuild = () => {
  return (
    <div className="bg-foreground transition-background clip-path-container relative h-[116px] duration-500 hover:bg-[#2E2E2E] lg:h-[138px]">
      <a
        className={twMerge(
          "font-feature-ss08 group absolute bottom-0 left-0 right-0 top-0 flex w-full items-center justify-center gap-[10px] text-[20px] font-bold lg:text-[25px] 2xl:text-[48px]",
        )}
        target="_blank"
        rel="noreferrer"
        href="https://hhueol4i6vp.typeform.com/to/I84sAGZ4"
      >
        <span>Join the Agent Competition</span>
        <div className="transition-transform duration-300 group-hover:rotate-90">
          <CrossIcon />
        </div>
      </a>
    </div>
  );
};
