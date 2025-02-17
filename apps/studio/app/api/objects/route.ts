import { ChainName, getChain, getObjectApiUrl } from "@recallnet/chains";

const chain = getChain(process.env.NEXT_PUBLIC_CHAIN_NAME as ChainName);
const objectApiUrl = getObjectApiUrl(chain);

export async function POST(req: Request) {
  const formData = await req.formData();
  const response = await fetch(`${objectApiUrl}/v1/objects`, {
    method: "POST",
    body: formData,
  });
  return Response.json(await response.json());
}
