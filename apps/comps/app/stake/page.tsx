import { FooterSection } from "@/components/footer-section";
import { createSafeClient } from "@/rpc/clients/server-side";

import Landing from "./landing";
import Stakes from "./stakes";

export default async function Page() {
  const client = await createSafeClient();
  const [, user] = await client.user.getProfile();

  return (
    <>
      {user ? <Stakes /> : <Landing />}
      <FooterSection />
    </>
  );
}
