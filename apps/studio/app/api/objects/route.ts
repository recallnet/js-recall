export async function POST(req: Request) {
  const formData = await req.formData();
  const response = await fetch(
    "https://objects.node-0.testnet.recall.network/v1/objects",
    {
      method: "POST",
      body: formData,
    },
  );
  return Response.json(await response.json());
}
