"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import { Loader2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@recallnet/ui/components/shadcn/button";
import { Input } from "@recallnet/ui/components/shadcn/input";
import { toast } from "@recallnet/ui/components/toast";

import { RequestTokensState, requestTokens } from "@/client-actions";

const initialState: RequestTokensState = {};

export default function RequestTokensForm() {
  const [state, formAction] = useActionState(requestTokens, initialState);

  useEffect(() => {
    if (state.error) {
      toast.error("Error", {
        description: state.error,
        duration: 120000,
      });
    }
    if (state.result) {
      toast("Success!", {
        description: (
          <span>
            RECALL sent in txn{" "}
            <a
              href={state.result.txUrl}
              className="text-muted-foreground hover:text-foreground"
              target="_blank"
              rel="noreferrer"
            >
              {state.result.txHash.slice(0, 4)}...
              {state.result.txHash.slice(-4)}
            </a>
            .
          </span>
        ),
        duration: 120000,
      });
    }
  }, [state]);

  return (
    <form
      className="flex max-w-96 flex-col items-stretch gap-4"
      action={formAction}
    >
      <FormContents />
    </form>
  );
}

function FormContents() {
  const { pending } = useFormStatus();
  const [tsResponse, setTsResponse] = useState<string | null>(null);

  return (
    <>
      <Input
        type="text"
        name="address"
        placeholder="Enter wallet address (0x...)"
        size={48}
        pattern="^0x[0-9a-fA-F]{40}$"
        title="Provide a valid EVM address"
        required
      />
      <Turnstile
        siteKey={process.env.NEXT_PUBLIC_TS_SITE_KEY || ""}
        options={{ size: "flexible" }}
        onSuccess={setTsResponse}
        onExpire={() => setTsResponse(null)}
      />
      <Button
        type="submit"
        disabled={pending || !tsResponse}
        className="md:self-center"
      >
        {pending && <Loader2 className="mr-2 size-5 animate-spin" />}
        Request $RECALL
      </Button>
    </>
  );
}
