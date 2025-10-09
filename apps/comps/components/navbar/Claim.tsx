import { Button } from "@recallnet/ui2/components/button";

import { Recall } from "@/components/Recall";
import { formatAmount } from "@/utils/format";

export const Claim = () => {
  const value = 3000;

  return (
    <Button className="flex items-center gap-2">
      <span>Claim</span>
      <Recall size="sm" backgroundClass="bg-white" />
      <span className="font-mono text-base font-semibold not-italic leading-6 tracking-[0.96px]">
        {formatAmount(value, 0, true)}
      </span>
    </Button>
  );
};
