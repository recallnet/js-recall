import { BillingTabs } from "./_components/billing-tabs";

export default async function BillingPage() {
  return (
    <main className="container mx-auto flex flex-1 flex-col px-4 py-4">
      <BillingTabs />
    </main>
  );
}
