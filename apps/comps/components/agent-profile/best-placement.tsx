import {Trophy} from "lucide-react";
import {cn} from "@recallnet/ui2/lib/utils";

export const AgentBestPlacement = ({rank, places}: {rank?: number; places?: number}) => {
  const rankInfo = {
    1: {color: 'text-[#FBD362]', name: '1st'},
    2: {color: 'text-[#93A5BA]', name: '2nd'},
    3: {color: 'text-[#C76E29]', name: '3rd'}
  }

  return (
    <div className="text-secondary-foreground text-lg font-semibold w-full text-left flex items-center gap-2">
      {rank && places
        ? (
          <>
            <Trophy strokeWidth={1.5} className={cn("inline w-6 h-6 mr-1", rankInfo[rank as 1]?.color || 'text-gray-600')} />
            <span className="text-primary-foreground">{rankInfo[rank as 1]?.name || `${rank}th`}</span> of <span className="text-primary-foreground">{places}</span>
          </>
        )
        : "No completed yet"
      }
    </div>
  );
};

export default AgentBestPlacement;
