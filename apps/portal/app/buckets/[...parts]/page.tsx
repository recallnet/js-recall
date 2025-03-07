import { notFound } from "next/navigation";
import { isAddress } from "viem";

import Bucket from "./_components/bucket";

export default async function BucketPage({
  params,
}: {
  params: Promise<{ parts: string[] }>;
}) {
  const { parts } = await params;
  const bucketAddress = parts[0];
  if (!bucketAddress || !isAddress(bucketAddress)) {
    notFound();
  }
  const prefixParts = parts.slice(1);

  return (
    <main className="container mx-auto flex flex-1 flex-col px-4 py-4">
      <Bucket bucketAddress={bucketAddress} prefixParts={prefixParts} />
    </main>
  );
}
