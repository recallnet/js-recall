import { notFound } from "next/navigation";
import { isAddress } from "viem";

import Bucket from "./_components/bucket";

export default async function BucketPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  if (!isAddress(address)) {
    notFound();
  }

  return (
    <main className="container mx-auto flex flex-1 flex-col px-4 py-4">
      <Bucket bucketAddress={address} />
    </main>
  );
}
