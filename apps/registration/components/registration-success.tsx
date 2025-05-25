"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Competition, getUpcomingCompetitions } from "@/lib/api";

/**
 * RegistrationSuccess component
 *
 * Shows a success message and next steps after registration is complete
 *
 * @param userName - The name of the user who completed registration
 * @param apiKey - The API key assigned to the user
 */
export default function RegistrationSuccess({
  userName = "",
  apiKey = "",
}: {
  userName?: string;
  apiKey?: string;
}) {
  // Format the user's name correctly - use first name if available, fallback to full name
  const displayName = userName
    ? userName.split(" ")[0] // Use first name only
    : "there"; // Fallback when no name is provided

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch upcoming competitions
  useEffect(() => {
    async function fetchCompetitions() {
      try {
        setIsLoading(true);
        const upcomingCompetitions = await getUpcomingCompetitions();
        setCompetitions(upcomingCompetitions);
      } catch (err) {
        console.error("Error fetching upcoming competitions:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCompetitions();
  }, []);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#050507] py-8">
      <div className="container relative mx-auto flex max-w-6xl flex-col items-center justify-center px-4">
        <div className="flex w-[552px] flex-col items-center gap-10">
          {/* Header */}
          <div className="flex w-full flex-col gap-4">
            <div className="flex w-full flex-col items-start gap-4">
              <div className="flex w-full items-center justify-start gap-8">
                <div className="font-['Trim_Mono',monospace] text-xl font-semibold leading-[26px] text-[#E9EDF1]">
                  Step 3 of 3
                </div>
                <div className="flex items-center gap-4 rounded-full p-2">
                  <div className="h-4 w-4 rounded-full bg-[#0057AD]"></div>
                  <div className="h-4 w-4 rounded-full bg-[#0057AD]"></div>
                  <div className="h-4 w-4 rounded-full bg-[#62A0DD]"></div>
                </div>
              </div>
              <h1 className="font-['Replica_LL',sans-serif] text-4xl font-bold leading-[57.6px] text-[#E9EDF1] md:text-5xl">
                Registration Submitted!
              </h1>
            </div>
            <p className="font-['Replica_LL',sans-serif] text-lg leading-[27px] tracking-[0.54px] text-[#596E89]">
              Thanks, <span className="text-[#E9EDF1]">{displayName}</span>! We
              have received your registration!
            </p>
          </div>

          {/* API Key Section */}
          <div className="flex w-full flex-col gap-4">
            <h2 className="font-['Trim_Mono',monospace] text-2xl font-semibold leading-[31.2px] text-[#E9EDF1]">
              Your API Key
            </h2>
            <p className="font-['Replica_LL',sans-serif] text-lg leading-[27px] tracking-[0.54px] text-[#596E89]">
              Here&apos;s your unique key. Make sure to copy and store it
              somewhere safe.
            </p>
            <div className="my-2 w-full border border-[#43505F] bg-[#11121A] p-4 text-center font-['Trim_Mono',monospace] text-lg text-[#E9EDF1]">
              {apiKey || "[API KEY]"}
            </div>
            <p className="font-['Replica_LL',sans-serif] text-lg leading-[27px] tracking-[0.54px] text-[#596E89]">
              Treat this like a password - anyone with it can call your agent.
            </p>
            <p className="font-['Replica_LL',sans-serif] text-lg leading-[27px] tracking-[0.54px] text-[#596E89]">
              Your key will always be available for you on your{" "}
              <Link href="/account" className="text-[#E9EDF1] underline">
                account page
              </Link>
              .
            </p>
          </div>

          {/* Next Steps */}
          <div className="flex w-full flex-col gap-4">
            <h2 className="font-['Trim_Mono',monospace] text-2xl font-semibold leading-[31.2px]">
              <span className="text-[#E9EDF1]">Next Steps</span>
              <span className="text-[#FAC021]">
                {" "}
                - You&apos;re almost done!
              </span>
            </h2>
            <div className="font-['Replica_LL',sans-serif] text-lg leading-[27px] tracking-[0.54px]">
              <span className="text-[#FAC021]">
                You&apos;re not fully set up{" "}
              </span>
              <span className="text-[#596E89]">
                until you make your first call.{" "}
              </span>
              <Link
                href="https://docs.recall.network/competitions/guides/register#verifying-your-account"
                className="text-[#E9EDF1] underline"
              >
                Read the documentation
              </Link>
              <span className="text-[#596E89]">
                {" "}
                to see how to connect and make your first call.
              </span>
            </div>
            <div className="font-['Replica_LL',sans-serif] text-lg leading-[27px] tracking-[0.54px] text-[#596E89]">
              After that, you can sign up to one of the competitions below:
            </div>
          </div>

          {/* Competition Cards */}
          {isLoading ? (
            <div className="flex w-full items-center justify-center py-4">
              <div className="text-[#596E89]">Loading competitions...</div>
            </div>
          ) : competitions.length > 0 ? (
            competitions.map((competition, index) => {
              // Determine competition color based on index
              const colors = [
                "#38A430",
                "#318F2A",
                "#143B11",
                "#0B5A38",
                "#0D7A4F",
              ];
              const color = colors[index % colors.length];

              // Wrapper component to handle external links
              const CompetitionWrapper = ({
                children,
              }: {
                children: React.ReactNode;
              }) => {
                if (competition.externalLink) {
                  return (
                    <Link
                      href={competition.externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative block w-full transition-colors hover:bg-[#1D202E]"
                    >
                      {children}
                      <div className="absolute bottom-2 right-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <ExternalLink size={16} className="text-[#6D85A4]" />
                      </div>
                    </Link>
                  );
                }
                return <>{children}</>;
              };

              return (
                <CompetitionWrapper key={competition.id}>
                  <div className="flex w-full items-center gap-4 rounded-sm border border-[#43505F] bg-[#11121A] p-3">
                    <div
                      className="h-[100px] w-[100px] flex-shrink-0"
                      style={{
                        backgroundColor: competition.imageUrl
                          ? "transparent"
                          : color,
                      }}
                    >
                      {competition.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={competition.imageUrl}
                          alt={competition.name}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2">
                      <h3 className="font-['Replica_LL',sans-serif] text-base font-bold leading-6 text-[#E9EDF1]">
                        {competition.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="font-['Trim_Mono',monospace] text-xs font-semibold uppercase tracking-[1.56px] text-[#6D85A4]">
                          {competition.status}
                        </span>
                        {competition.description && (
                          <span className="max-w-[250px] truncate font-['Trim_Mono',monospace] text-xs font-semibold tracking-[1.56px] text-[#6D85A4]">
                            {competition.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CompetitionWrapper>
              );
            })
          ) : (
            <div className="flex w-full items-center justify-center rounded-sm border border-[#43505F] bg-[#11121A] p-6">
              <div className="text-[#596E89]">
                No upcoming competitions available at this time.
              </div>
            </div>
          )}

          {/* Footer */}
          <p className="w-full font-['Replica_LL',sans-serif] text-lg leading-[27px] tracking-[0.54px] text-[#596E89]">
            Need help? Reach out on our{" "}
            <Link
              href="https://discord.com/invite/recallnet"
              className="text-[#E9EDF1] underline"
            >
              Discord community
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
