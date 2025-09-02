import { makeClient } from "@/rpc/clients/server-side";

export default async function Page() {
  const client = await makeClient();
  const resp = await client.boost.balance();

  return (
    <div>
      Test Page<div>Server rendered balance: {resp.balance}</div>
    </div>
  );
}
