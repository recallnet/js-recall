"use client";

import React, { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import {
  ActiveCompetitions,
  EndedCompetitions,
  HeroSection,
  UpcomingCompetitions,
  UserCompetitions,
} from "@/components/competitions";
import CompetitionsSkeleton from "@/components/competitions-skeleton";
import { ErrorMessage } from "@/components/error-message";
import { FooterSection } from "@/components/footer-section";
import { JoinSwarmSection } from "@/components/join-swarm-section";
import { getSocialLinksArray } from "@/data/social";

function CompetitionsContent() {
  return (
    <div className="relative">
      <ErrorBoundary
        FallbackComponent={({ error, resetErrorBoundary }) => (
          <ErrorMessage
            error={error}
            title="Error loading featured competition"
            onRetry={() => resetErrorBoundary()}
          />
        )}
      >
        <HeroSection />
      </ErrorBoundary>

      <ErrorBoundary
        FallbackComponent={({ error, resetErrorBoundary }) => (
          <ErrorMessage
            error={error}
            title="Error loading user competitions"
            onRetry={() => resetErrorBoundary()}
          />
        )}
      >
        <UserCompetitions />
      </ErrorBoundary>

      <ErrorBoundary
        FallbackComponent={({ error, resetErrorBoundary }) => (
          <ErrorMessage
            error={error}
            title="Error loading upcoming competitions"
            onRetry={() => resetErrorBoundary()}
          />
        )}
      >
        <UpcomingCompetitions />
      </ErrorBoundary>

      <ErrorBoundary
        FallbackComponent={({ error, resetErrorBoundary }) => (
          <ErrorMessage
            error={error}
            title="Error loading active competitions"
            onRetry={() => resetErrorBoundary()}
          />
        )}
      >
        <ActiveCompetitions />
      </ErrorBoundary>

      <ErrorBoundary
        FallbackComponent={({ error, resetErrorBoundary }) => (
          <ErrorMessage
            error={error}
            title="Error loading ended competitions"
            onRetry={() => resetErrorBoundary()}
          />
        )}
      >
        <EndedCompetitions />
      </ErrorBoundary>

      <JoinSwarmSection socialLinks={getSocialLinksArray()} />
      <FooterSection />
    </div>
  );
}

export default function CompetitionsPage() {
  return (
    <ErrorBoundary
      FallbackComponent={({ error }) => (
        <div className="container mx-auto px-12 py-20 text-center">
          <ErrorMessage error={error} title="Error loading competitions" />
        </div>
      )}
    >
      <Suspense fallback={<CompetitionsSkeleton />}>
        <CompetitionsContent />
      </Suspense>
    </ErrorBoundary>
  );
}
