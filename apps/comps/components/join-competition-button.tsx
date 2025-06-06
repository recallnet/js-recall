import { usePathname } from "next/navigation";
import { type ComponentProps, useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import { toast } from "@recallnet/ui2/components/toast";

import { useUserAgents } from "@/hooks/useAgents";
import { useUserSession } from "@/hooks/useAuth";
import { useJoinCompetition } from "@/hooks/useJoinCompetition";

import { ChooseAgentModal } from "./modals/choose-agent";
import { ConnectWalletModal } from "./modals/connect-wallet";
import { CreateAccountModal } from "./modals/create-account";
import { SetupAgentModal } from "./modals/setup-agent";

interface JoinCompetitionButtonProps
  extends Omit<ComponentProps<typeof Button>, "variant"> {
  competitionId: string;
  variant?: ComponentProps<typeof Button>["variant"];
}

export function JoinCompetitionButton({
  competitionId,
  variant = "ghost",
  children = "Join Competition",
  ...props
}: JoinCompetitionButtonProps) {
  const { isAuthenticated, isProfileUpdated } = useUserSession();
  const { data: userAgents } = useUserAgents();
  const [activeModal, setActiveModal] = useState<
    "connectWallet" | "chooseAgent" | "setupAgent" | "createAccount" | null
  >(null);
  const pathname = usePathname();
  const { mutate: joinCompetition, isPending: isJoining } =
    useJoinCompetition();

  const handleClick = () => {
    if (!isAuthenticated) {
      setActiveModal("connectWallet");
      return;
    }

    if (!isProfileUpdated) {
      setActiveModal("createAccount");
      return;
    }

    if (userAgents && userAgents.agents.length === 0) {
      setActiveModal("setupAgent");
      return;
    }

    if (userAgents && userAgents.agents.length > 0) {
      setActiveModal("chooseAgent");
    }
  };

  const handleContinue = (agentId: string) => {
    setActiveModal(null);
    joinCompetition(
      { agentId, competitionId },
      {
        onSuccess: (data) => {
          if (data.success) {
            toast.success("Your agent has entered the competition.");
          } else {
            toast.error(data.message);
          }
        },
        onError: (error) => {
          toast.error("Failed to join competition", {
            description: error.message,
          });
        },
      },
    );
  };

  return (
    <>
      <Button
        variant={variant}
        {...props}
        onClick={handleClick}
        disabled={isJoining || props.disabled}
      >
        {children}
      </Button>
      <ConnectWalletModal
        isOpen={activeModal === "connectWallet"}
        onClose={() => setActiveModal(null)}
      />
      <ChooseAgentModal
        isOpen={activeModal === "chooseAgent"}
        onClose={() => setActiveModal(null)}
        agents={userAgents?.agents || []}
        onContinue={handleContinue}
      />
      <SetupAgentModal
        isOpen={activeModal === "setupAgent"}
        onClose={() => setActiveModal(null)}
        redirectTo={pathname}
      />
      <CreateAccountModal
        isOpen={activeModal === "createAccount"}
        onClose={() => setActiveModal(null)}
        redirectTo={pathname}
      />
    </>
  );
}
