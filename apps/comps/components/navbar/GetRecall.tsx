import Image from "next/image";

import { Button } from "@recallnet/ui2/components/button";

export const GetRecall = () => {
  return (
    <Button className="flex items-center gap-2">
      <span>Get</span>
      <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-white p-1">
        <Image
          src="/recall-token.svg"
          alt="Recall Token"
          width={16}
          height={16}
        />
      </div>
      <span>Recall</span>
    </Button>
  );
};
