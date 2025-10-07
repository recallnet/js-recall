import { usePathname } from "next/navigation";
import { type ComponentProps, type ReactNode, useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import { toast } from "@recallnet/ui2/components/toast";

import { useUserAgents } from "@/hooks/useAgents";
import { useCompetition } from "@/hooks/useCompetition";
import { useJoinCompetition } from "@/hooks/useJoinCompetition";
import { useSession } from "@/hooks/useSession";

import AgentRegisteredModal from "./modals/agent-registered";
import { ChooseAgentModal } from "./modals/choose-agent";
import ConfirmAgentEntryModal from "./modals/confirm-agent-entry";
import { ConnectPrivyModal } from "./modals/connect-privy";
import { CreateAccountModal } from "./modals/create-account";
import { SetupAgentModal } from "./modals/setup-agent";

interface JoinCompetitionButtonProps
  extends Omit<ComponentProps<typeof Button>, "variant"> {
  competitionId: string;
  variant?: ComponentProps<typeof Button>["variant"];
  children?: ReactNode;
}

type ModalTypes =
  | "connectAccount"
  | "chooseAgent"
  | "setupAgent"
  | "createAccount"
  | "confirmAgentEntry"
  | "loadingJoin"
  | "registered"
  | null;

export function JoinCompetitionButton({
  competitionId,
  variant = "ghost",
  children = "Join Competition",
  ...props
}: JoinCompetitionButtonProps) {
  const session = useSession();
  const { data: userAgents } = useUserAgents();
  const { data: competition } = useCompetition(competitionId);
  const [activeModal, setActiveModal] = useState<ModalTypes>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  const selectedAgent = userAgents?.agents.find(
    (agent) => agent.id === selectedAgentId,
  );

  const pathname = usePathname();
  const { mutate: joinCompetition, isPending: isJoining } =
    useJoinCompetition();

  // Check if the competition has reached its participant limit
  const isAtParticipantLimit = () => {
    return (
      competition &&
      competition.maxParticipants !== null &&
      competition.registeredParticipants >= competition.maxParticipants
    );
  };

  // Check if registration is allowed based on join dates and participant limits
  const canJoin = () => {
    if (!competition) return false;

    const now = new Date();
    const joinStart = competition.joinStartDate
      ? new Date(competition.joinStartDate)
      : null;
    const joinEnd = competition.joinEndDate
      ? new Date(competition.joinEndDate)
      : null;

    if (joinStart === null && joinEnd === null) return false;

    // Check if registration is open
    if (joinStart && now < joinStart) return false;
    if (joinEnd && now > joinEnd) return false;

    // Check competition status
    if (competition.status !== "pending") return false;

    // Check participant limit
    if (isAtParticipantLimit()) {
      return false;
    }

    return true;
  };

  const handleClick = () => {
    if (!session.ready) {
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

      // Check participant limit first
      if (isAtParticipantLimit()) {
        toast.error("Registration is full", {
          description: `This competition has reached its maximum capacity of ${competition!.maxParticipants} participants`,
        });
        return;
      }

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
      setActiveModal("connectAccount");
      return;
    }

    if (!session.backendUser?.name) {
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

  const handleSelectAgent = (agentId: string) => {
    setSelectedAgentId(agentId);
    setActiveModal("confirmAgentEntry");
  };

  const handleJoin = () => {
    setActiveModal("loadingJoin");
    joinCompetition(
      { agentId: selectedAgentId, competitionId },
      {
        onSuccess: () => {
          //small timeout to show loading
          setTimeout(() => {
            setActiveModal("registered");
            toast.success(
              `[${selectedAgent?.name as string}] has joined [${competition?.name as string}]`,
            );
          }, 1000);
        },
        onError: (error) => {
          toast.error("Failed to join competition", {
            description: error.message,
          });
          setActiveModal(null);
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
      <ConnectPrivyModal
        isOpen={activeModal === "connectAccount"}
        onClose={() => setActiveModal(null)}
      />
      <ChooseAgentModal
        isOpen={activeModal === "chooseAgent"}
        onClose={() => setActiveModal(null)}
        onContinue={handleSelectAgent}
        competition={competition}
        agents={userAgents?.agents || []}
      />
      <ConfirmAgentEntryModal
        isOpen={activeModal === "confirmAgentEntry" && !!selectedAgent}
        onClose={() => setActiveModal(null)}
        onBack={() => setActiveModal("chooseAgent")}
        onContinue={handleJoin}
        competition={competition}
        agent={selectedAgent}
      />
      <AgentRegisteredModal
        onClose={() => setActiveModal(null)}
        isOpen={(["loadingJoin", "registered"] as ModalTypes[]).includes(
          activeModal,
        )}
        loaded={activeModal === "registered"}
        agent={selectedAgent}
        competition={competition}
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
