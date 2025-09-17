import Image from "next/image";

import { Button } from "@recallnet/ui2/components/button";

import { formatAmount } from "@/utils/format";

export const Claim = () => {
  const value = 3000;

  return (
    <Button className="flex items-center gap-2">
      <span>Claim</span>
      <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-white p-1">
        <Image
          src="/recall-token.svg"
          alt="Recall Token"
          width={16}
          height={16}
        />
      </div>
      <span className="font-mono text-base font-semibold not-italic leading-6 tracking-[0.96px]">
        {formatAmount(value, 0, true)}
      </span>
    </Button>
  );
};
