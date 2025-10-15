"use client";

import type { ConfigDefaults } from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { ReactNode } from "react";

interface PostHogProviderWrapperProps {
  children: ReactNode;
}

export function PostHogProviderWrapper({
  children,
}: PostHogProviderWrapperProps) {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!posthogKey || !posthogHost) {
    console.warn("PostHog configuration missing. Analytics will be disabled.");
    return <>{children}</>;
  }

  const options = {
    api_host: posthogHost,
    defaults: "2025-05-24" as ConfigDefaults,
  };

  return (
    <PostHogProvider apiKey={posthogKey} options={options}>
      {children}
    </PostHogProvider>
  );
}
