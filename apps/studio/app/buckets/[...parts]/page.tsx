export default async function BucketPage({
  params,
}: {
  params: Promise<{ parts: string[] }>;
}) {
  const { parts } = await params;
  return <div>{parts.join("/")}</div>;
}
