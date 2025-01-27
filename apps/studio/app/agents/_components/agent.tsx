import { Auth } from "./cards/auth";
import { Chat } from "./cards/chat";
import { Memory } from "./cards/memory";
import { Objects } from "./cards/objects";
import { Settings } from "./cards/settings";

type Props = {
  name: string;
  apiUrl: string;
  apiKey: string;
  systemInstructions: string;
  persona: string;
  human: string;
};

export function Agent({
  name,
  apiUrl,
  apiKey,
  systemInstructions,
  persona,
  human,
}: Props) {
  return (
    <div className="grid grid-flow-row grid-cols-1 grid-rows-5 gap-3 sm:grid-cols-2 sm:grid-rows-4 lg:grid-cols-3 lg:grid-rows-2">
      <Settings name={name} systemInstructions={systemInstructions} />
      <Chat className="sm:row-span-4 lg:row-span-2" />
      <Memory persona={persona} human={human} />
      <Auth apiUrl={apiUrl} apiKey={apiKey} />
      <Objects />
    </div>
  );
}
