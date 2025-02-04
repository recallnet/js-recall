import { AccountTabs } from "./_components/account-tabs";

export default async function AccountPage() {
  return (
    <main className="container mx-auto flex flex-1 flex-col px-4 py-4">
      <AccountTabs />
    </main>
  );
}
