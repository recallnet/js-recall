"use client";

import { LockClosedIcon } from "@radix-ui/react-icons";

import { cn } from "@recallnet/ui2/lib/utils";

import { Hexagon } from "@/components/hexagon";

type AchievementCardProps = {
  achievements: { content?: React.ReactNode; locked: boolean }[];
  className?: string;
};

export const AchievementCard: React.FunctionComponent<AchievementCardProps> = ({
  achievements,
  className,
}) => {
  const unlockedCnt = achievements.reduce(
    (acc, cur) => acc + (cur.locked ? 0 : 1),
    0,
  );

  return (
    <div
      className={cn(
        "md:w-xl flex h-1/3 w-full justify-between gap-4 border bg-gray-800 p-6 shadow",
        className,
      )}
    >
      <div className="flex items-center gap-6">
        {achievements.map((el, i) => (
          <Hexagon
            key={i}
            className={cn(
              "text-sm",
              el.locked ? "bg-gray-500" : "bg-purple-800",
            )}
          >
            {el.locked ? <LockClosedIcon key={i} /> : el.content}
          </Hexagon>
        ))}
      </div>

      <div className="flex w-[70%] flex-col justify-center pl-6 text-center">
        <h2 className="text-primary text-sm font-bold">KEEP GOING!</h2>
        <p className="text-muted-foreground text-sm">
          {`${unlockedCnt} OF ${achievements.length} TROPHIES UNLOCKED`}
        </p>
      </div>
    </div>
  );
};
