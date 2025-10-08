import Image from "next/image";

import { Button } from "@recallnet/ui2/components/button";

export const StakeRecall = () => {
  return (
    <Button className="flex items-center gap-2 normal-case">
      <span className="uppercase">Stake to get</span>
      <span className="font-bold">Boost</span>
      <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
        <Image
          src="/boost.svg"
          alt="Boost"
          width={16}
          height={16}
          style={{ width: "auto", height: "auto" }}
        />
      </div>
    </Button>
  );
};
