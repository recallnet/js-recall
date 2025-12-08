import { useContext } from "react";

import { Session, SessionContext } from "@/providers/session-provider";

export const useSession = (): Session => {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }

  return context;
};
