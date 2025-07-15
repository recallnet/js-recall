"use client";

import React, { Suspense } from "react";

import ErrorVerifyEmail from "@/components/verify-email/error";
import LoadingVerifyEmail from "@/components/verify-email/loading";
import SuccessVerifyEmail from "@/components/verify-email/success";
import { useSearchParams } from "@/node_modules/next/navigation";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<LoadingVerifyEmail />}>
      <ResultVerifyPage />
    </Suspense>
  );
}

const ResultVerifyPage = () => {
  const params = useSearchParams();
  const success = params.get("success") === "true";

  if (success)
    return (
      <>
        <SuccessVerifyEmail />
      </>
    );
  else
    return (
      <>
        <ErrorVerifyEmail />
      </>
    );
};
