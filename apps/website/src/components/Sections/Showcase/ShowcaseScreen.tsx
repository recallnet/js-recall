import { twMerge } from "tailwind-merge";

import { Heading } from "@/components/Common/Heading";

export const ShowcaseScreen = ({
  index,
  currentIndex,
  title,
  text,
  bg,
}: {
  index: number;
  currentIndex: number;
  title: string;
  text: string;
  bg?: React.ReactNode;
}) => {
  const isActive = currentIndex === index;
  const isPrev = currentIndex === index + 1;

  return (
    <div className="pointer-events-none absolute left-0 top-0 h-full w-full">
      <section
        className={twMerge(
          "bg-gradient-inner sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden pt-[100px] transition-all duration-300",
          isPrev ? "scale-50 opacity-0" : "",
          isActive ? "pointer-events-auto scale-100 opacity-100" : "opacity-0",
        )}
      >
        {bg}

        <div className="relative z-30 max-w-[320px] text-center lg:max-w-[562px]">
          <Heading
            isActive={isActive}
            title={title}
            text={text}
            theme="dark"
            textClassName="max-w-[268px]"
          />
        </div>
      </section>
    </div>
  );
};
