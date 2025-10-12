import { FooterSection } from "@/components/footer-section";
import { JoinSwarmSection } from "@/components/join-swarm-section";
import { getSocialLinksArray } from "@/data/social";
import { createSafeClient } from "@/rpc/clients/server-side";

import Landing from "./landing";
import Stakes from "./stakes";

export default async function Page() {
  const client = await createSafeClient();
  const [error, user] = await client.user.getProfile();

  return (
    <>
      {user ? <Stakes /> : <Landing />}
      <JoinSwarmSection socialLinks={getSocialLinksArray()} />
      <FooterSection />
    </>
  );
}
