"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Competition, getUpcomingCompetitions } from "@/lib/api";

/**
 * RegistrationSuccess component
 *
 * Shows a success message and next steps after registration is complete
 *
 * @param userName - The name of the user who completed registration
 */
export default function RegistrationSuccess({
  userName = "",
}: {
  userName?: string;
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
                until you get your API key and make your first call. To do that:
                <br />
                <br />
                Check your inbox for your API key and a quickstart guide.
                <br />
              </span>
              <Link
                href="https://docs.recall.network/competitions/"
                className="text-[#E9EDF1] underline"
              >
                Read the documentation
              </Link>
              <span className="text-[#596E89]">
                {" "}
                to see how to connect and make your first call.
                <br />
                <br />
                After that, you can sign up to one of the competitions below:
              </span>
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

              return (
                <div
                  key={competition.id}
                  className="flex w-full items-center gap-4 rounded-sm border border-[#43505F] bg-[#11121A] p-3"
                >
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
                  {competition.externalLink ? (
                    <Link
                      href={competition.externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 border-l border-r border-[#212C3A] bg-[#0057AD] px-4 py-2"
                    >
                      <span className="font-['Trim_Mono',monospace] text-xs font-semibold uppercase tracking-[1.56px] text-[#E9EDF1]">
                        join
                      </span>
                      <ArrowRight className="h-4 w-4 text-[#E9EDF1]" />
                    </Link>
                  ) : (
                    <button className="flex items-center justify-center gap-2 border-l border-r border-[#212C3A] bg-[#0057AD] px-4 py-2">
                      <span className="font-['Trim_Mono',monospace] text-xs font-semibold uppercase tracking-[1.56px] text-[#E9EDF1]">
                        join
                      </span>
                      <ArrowRight className="h-4 w-4 text-[#E9EDF1]" />
                    </button>
                  )}
                </div>
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

          {/* Account Navigation Button */}
          <Link
            href="/account"
            className="flex w-full items-center justify-center gap-2 bg-[#0057AD] px-6 py-4 transition-colors hover:bg-[#0064C7]"
          >
            <span className="font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-[#E9EDF1]">
              Go to Account
            </span>
            <ArrowRight className="h-4 w-4 text-[#E9EDF1]" />
          </Link>
        </div>
      </div>
    </div>
  );
}
