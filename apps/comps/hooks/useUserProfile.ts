import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/hooks/useSession";
import { client } from "@/rpc/clients/client-side";

export const useUserProfile = () => {
  const { isAuthenticated } = useSession();

  return useQuery({
    queryKey: ["user", "profile"],
    queryFn: () => client.user.profile(),
    enabled: isAuthenticated,
  });
};
