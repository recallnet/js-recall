import { usePathname } from "next/navigation";
import { type ComponentProps, type ReactNode, useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import { toast } from "@recallnet/ui2/components/toast";

import { useUserAgents } from "@/hooks/useAgents";
import { useUserSession } from "@/hooks/useAuth";
import { useCompetition } from "@/hooks/useCompetition";
import { useJoinCompetition } from "@/hooks/useJoinCompetition";

import { ChooseAgentModal } from "./modals/choose-agent";
import { ConnectWalletModal } from "./modals/connect-wallet";
import { CreateAccountModal } from "./modals/create-account";
import { SetupAgentModal } from "./modals/setup-agent";

interface JoinCompetitionButtonProps
  extends Omit<ComponentProps<typeof Button>, "variant"> {
  competitionId: string;
  variant?: ComponentProps<typeof Button>["variant"];
  children?: ReactNode;
}

export function JoinCompetitionButton({
  competitionId,
  variant = "ghost",
  children = "Join Competition",
  ...props
}: JoinCompetitionButtonProps) {
  const session = useUserSession();
  const { data: userAgents } = useUserAgents();
  const { data: competition } = useCompetition(competitionId);
  const [activeModal, setActiveModal] = useState<
    "connectWallet" | "chooseAgent" | "setupAgent" | "createAccount" | null
  >(null);
  const pathname = usePathname();
  const { mutate: joinCompetition, isPending: isJoining } =
    useJoinCompetition();

  // Check if registration is allowed based on join dates
  const canJoin = () => {
    if (!competition) return false;

    const now = new Date();
    const joinStart = competition.joinStartDate
      ? new Date(competition.joinStartDate)
      : null;
    const joinEnd = competition.joinEndDate
      ? new Date(competition.joinEndDate)
      : null;

    // Check if registration is open
    if (joinStart && now < joinStart) return false;
    if (joinEnd && now > joinEnd) return false;

    // Check competition status
    if (competition.status !== "pending") return false;

    return true;
  };

  const handleClick = () => {
    if (!session.isInitialized) {
      return;
    }

    // Check if registration is allowed
    if (!canJoin()) {
      const now = new Date();
      const joinStart = competition?.joinStartDate
        ? new Date(competition.joinStartDate)
        : null;
      const joinEnd = competition?.joinEndDate
        ? new Date(competition.joinEndDate)
        : null;

      if (joinStart && now < joinStart) {
        toast.error("Registration not open yet", {
          description: `Registration opens at ${joinStart.toLocaleString()}`,
        });
        return;
      }

      if (joinEnd && now > joinEnd) {
        toast.error("Registration closed", {
          description: `Registration closed at ${joinEnd.toLocaleString()}`,
        });
        return;
      }

      if (competition?.status !== "pending") {
        toast.error("Competition not available", {
          description: "This competition is not accepting registrations",
        });
        return;
      }

      return;
    }

    if (!session.isAuthenticated) {
      setActiveModal("connectWallet");
      return;
    }

    if (!session.isProfileUpdated) {
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
        disabled={isJoining || props.disabled || !canJoin()}
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
