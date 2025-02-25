import { RecallLogo } from "@recallnet/ui/recall/logos/recall-logo";
import { ThemeToggle } from "@recallnet/ui/recall/theme-toggle";

import RequestTokensForm from "./_components/request-tokens-form";

export default async function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 p-4">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="flex flex-col items-center gap-4">
        <RecallLogo
          width="100%"
          height="100%"
          className="fill-primary max-w-52"
        />
        <span className="text-muted-foreground text-base font-medium leading-none">
          Testnet faucet
        </span>
      </div>
      <RequestTokensForm />
    </main>
  );
}
