import { Button } from "@recallnet/ui2/components/button";

import { Recall } from "@/components/Recall";

export const GetRecall = () => {
  return (
    <Button className="flex items-center gap-2">
      <span>Get</span>
      <Recall size="sm" backgroundClass="bg-white" />
      <span>Recall</span>
    </Button>
  );
};
