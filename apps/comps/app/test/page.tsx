import { makeClient } from "@/rpc/clients/server-side";

import Balance from "./_components/balance";

export default async function Page() {
  const client = await makeClient();
  const resp = await client.boost.balance();

  return (
    <div>
      <h1>Test Page</h1>
      <div>Server rendered balance: {resp.balance}</div>
      <Balance />
    </div>
  );
}
