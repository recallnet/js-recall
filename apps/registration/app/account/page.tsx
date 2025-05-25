"use client";

import { Check, Clipboard, ExternalLink, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import AgentAddForm from "@/components/agent-add-form";
import RecallLogo from "@/components/recall-logo";
import { useAuthState } from "@/hooks/auth-state";
import {
  Competition,
  Team,
  Trade,
  getTeamByWalletAddress,
  getTeamTrades,
  getUpcomingCompetitions,
} from "@/lib/api";

/**
 * Account page component
 *
 * Displays the user's profile information, registered agents, and available competitions
 *
 * @returns Account page component
 */
export default function AccountPage() {
  const [isLoading, setIsLoading] = useState(true);
  const { address } = useAuthState();
  const [team, setTeam] = useState<Team | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [showAddAgentForm, setShowAddAgentForm] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);

  // When the user is connected with a wallet, check if they already have a team
  useEffect(() => {
    async function checkForExistingTeam() {
      if (address) {
        try {
          setIsLoading(true);
          const matchingTeam = await getTeamByWalletAddress(address);

          if (matchingTeam) {
            console.log("Found matching team:", matchingTeam);
            setTeam(matchingTeam);
          } else {
            router.push("/");
          }
          setError(null);
        } catch (err) {
          console.error("Error fetching team by wallet address:", err);
          setTeam(null);
          setError("Failed to check team registration status");
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    }

    checkForExistingTeam();
  }, [address, router]);

  // Fetch upcoming competitions
  useEffect(() => {
    async function fetchCompetitions() {
      try {
        const upcomingCompetitions = await getUpcomingCompetitions();
        setCompetitions(upcomingCompetitions);
      } catch (err) {
        console.error("Error fetching upcoming competitions:", err);
      }
    }

    fetchCompetitions();
  }, []);

  // Fetch trades when team is loaded
  useEffect(() => {
    async function fetchTrades() {
      if (team?.apiKey) {
        try {
          setIsLoadingTrades(true);
          const tradesData = await getTeamTrades(team.apiKey, { limit: 10 });
          if (tradesData) {
            setTrades(tradesData.trades);
          }
        } catch (err) {
          console.error("Error fetching trades:", err);
        } finally {
          setIsLoadingTrades(false);
        }
      }
    }

    fetchTrades();
  }, [team?.apiKey]);

  const copyApiKey = () => {
    if (!team?.apiKey) return;

    navigator.clipboard.writeText(team.apiKey);
    setApiKeyCopied(true);

    setTimeout(() => {
      setApiKeyCopied(false);
    }, 2000);
  };

  // Handle successful agent addition
  const handleAgentAdded = (updatedTeam: Team) => {
    setTeam(updatedTeam);
    setShowAddAgentForm(false);
  };

  // If still loading or no wallet connected, show loading or connect wallet message
  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#050507] py-8">
        <div className="text-center">
          <div className="mb-4 text-2xl font-bold text-white">Loading...</div>
        </div>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#050507] py-8">
        <div className="text-center">
          <div className="mb-4 text-2xl font-bold text-white">
            Please connect your wallet to view your account
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#050507] py-8">
        <div className="text-center">
          <div className="mb-4 text-2xl font-bold text-white">Error</div>
          <div className="text-[#596E89]">{error}</div>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#050507] py-8">
        <div className="text-center">
          <div className="mb-4 text-2xl font-bold text-white">
            No Account Found
          </div>
          <div className="mb-8 text-[#596E89]">
            You need to register an account to continue.
          </div>
          <Link
            href="/"
            className="bg-[#0057AD] px-8 py-3 font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-white"
          >
            Register Now
          </Link>
        </div>
      </div>
    );
  }

  // When team is found, show the account page
  return (
    <div className="flex min-h-screen w-full flex-col bg-[#050507] py-8">
      {/* Header section */}
      <div className="container mx-auto px-4 sm:px-8 md:px-12 lg:px-24 xl:px-36">
        <div className="flex w-full flex-col gap-8 md:gap-12">
          {/* Recall logo and header section */}
          <div className="flex flex-col gap-8 md:gap-12">
            <RecallLogo color="#D2D9E1" />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
              <div className="flex flex-1 flex-col gap-3">
                <h1 className="font-['Replica_LL',sans-serif] text-3xl font-bold text-[#E9EDF1] md:text-4xl lg:text-5xl">
                  Developer Profile
                </h1>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <span className="font-['Replica_LL',sans-serif] text-lg text-[#D2D9E1]">
                    API Key
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="max-w-[200px] truncate font-['Replica_LL',sans-serif] text-sm text-[#6D85A4] sm:max-w-none sm:text-base md:text-lg">
                      {team.apiKey || "No API key available"}
                    </span>
                    <button
                      onClick={copyApiKey}
                      className="text-[#6D85A4]"
                      aria-label="Copy API Key"
                    >
                      {apiKeyCopied ? (
                        <Check size={24} />
                      ) : (
                        <Clipboard size={24} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <Link
                href="/"
                className="flex h-[46px] items-center gap-2 self-start border border-[#303846] px-6 py-4 sm:self-auto"
              >
                <div className="relative h-3 w-3 overflow-hidden">
                  <div className="absolute left-[2.5px] top-[2.5px] h-[7px] w-[3.5px] outline outline-2 outline-offset-[-1px] outline-[#303846]"></div>
                </div>
                <span className="font-['Trim_Mono',monospace] text-xs font-semibold uppercase tracking-[1.56px] text-[#303846]">
                  back
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Line separator after API Key - KEEP THIS */}
        <div className="my-6 h-px w-full bg-[#303846] opacity-60"></div>

        <div className="mt-8 flex flex-col gap-12 lg:flex-row">
          {/* Left column - Profile info and agents */}
          <div className="flex w-full flex-col gap-10 lg:w-[639px]">
            {/* Profile information */}
            <div className="flex flex-col gap-6">
              <div className="flex flex-col py-3 sm:flex-row sm:items-center">
                <div className="w-32 font-['Trim_Mono',monospace] text-lg font-semibold leading-[27px] tracking-[0.54px] text-white">
                  Name
                </div>
                <div className="font-['Trim_Mono',monospace] text-lg font-light leading-[27px] tracking-[0.54px] text-[#6D85A4]">
                  {team.name}
                </div>
              </div>

              <div className="flex flex-col py-3 sm:flex-row sm:items-center">
                <div className="w-32 font-['Trim_Mono',monospace] text-lg font-semibold leading-[27px] tracking-[0.54px] text-white">
                  E-mail
                </div>
                <div className="break-all font-['Trim_Mono',monospace] text-lg font-light leading-[27px] tracking-[0.54px] text-[#6D85A4] sm:break-normal">
                  {team.email}
                </div>
              </div>

              {/* Telegram Row - Only shown if available */}
              {team.metadata?.userTelegram && (
                <div className="flex flex-col py-3 sm:flex-row sm:items-center">
                  <div className="w-32 font-['Trim_Mono',monospace] text-lg font-semibold leading-[27px] tracking-[0.54px] text-white">
                    Telegram
                  </div>
                  <div className="break-all font-['Trim_Mono',monospace] text-lg font-light leading-[27px] tracking-[0.54px] text-[#6D85A4] sm:break-normal">
                    {team.metadata.userTelegram}
                  </div>
                </div>
              )}

              <div className="flex flex-col py-3 sm:flex-row sm:items-center">
                <div className="w-32 font-['Trim_Mono',monospace] text-lg font-semibold leading-[27px] tracking-[0.54px] text-white">
                  Website
                </div>
                <div className="break-all font-['Trim_Mono',monospace] text-lg font-light leading-[27px] tracking-[0.54px] text-[#6D85A4] sm:break-normal">
                  {team.description || "Not provided"}
                </div>
              </div>

              {/* Wallet Address Row */}
              <div className="flex flex-col py-3 sm:flex-row sm:items-center">
                <div className="w-32 font-['Trim_Mono',monospace] text-lg font-semibold leading-[27px] tracking-[0.54px] text-white">
                  Wallet
                </div>
                <div className="break-all font-['Trim_Mono',monospace] text-lg font-light leading-[27px] tracking-[0.54px] text-[#6D85A4] sm:max-w-[400px] sm:truncate">
                  {team.walletAddress}
                </div>
              </div>

              {/* Verification Status */}
              <div className="flex flex-col py-3 sm:flex-row sm:items-center">
                <div className="w-32 font-['Trim_Mono',monospace] text-lg font-semibold leading-[27px] tracking-[0.54px] text-white">
                  Verified
                </div>
                <div className="flex items-center gap-2 font-['Trim_Mono',monospace] text-lg font-light leading-[27px] tracking-[0.54px]">
                  {isLoadingTrades ? (
                    <div className="flex items-center text-[#6D85A4]">
                      Loading...
                    </div>
                  ) : trades.length > 0 ? (
                    <div className="flex items-center text-[#318F2A]">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#B8DFB5]">
                        <Check size={16} className="text-[#318F2A]" />
                      </div>
                      <span className="ml-2">Verified</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-[#D03A44]">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F8D0D3]">
                        <X size={16} className="text-[#D03A44]" />
                      </div>
                      <span className="ml-2">Not Verified</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Verification Explainer */}
              {!isLoadingTrades && trades.length === 0 && (
                <div className="mb-3 ml-32 mt-[-5px] font-['Replica_LL',sans-serif] text-sm text-[#93A5BA]">
                  To get verified, execute at least one trade.{" "}
                  <Link
                    href="https://docs.recall.network/competitions/guides/mcp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#62A0DD] hover:underline"
                  >
                    Refer to the docs for more information
                  </Link>
                  .
                </div>
              )}
            </div>

            {/* Agents section */}
            <div>
              <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center sm:gap-0">
                <div className="flex items-center gap-4">
                  <h2 className="font-['Trim_Mono',monospace] text-xl font-semibold leading-[31.2px] text-white md:text-2xl">
                    Your Agents
                  </h2>
                </div>
                <button
                  onClick={() => setShowAddAgentForm(true)}
                  className="flex items-center gap-2 self-start border border-[#62A0DD] px-4 py-3 text-[#62A0DD] sm:self-auto sm:px-6 sm:py-4"
                >
                  <Plus size={12} />
                  <span className="font-['Trim_Mono',monospace] text-xs font-semibold uppercase tracking-[1.56px]">
                    Add agent
                  </span>
                </button>
              </div>

              {/* Line separator after Your Agents heading - KEEP THIS */}
              <div className="mb-6 h-px w-full bg-[#303846] opacity-60"></div>

              {/* Agent Add Form - Shown conditionally */}
              {showAddAgentForm && team && (
                <div className="mb-6">
                  <AgentAddForm
                    team={team}
                    onSuccess={handleAgentAdded}
                    onCancel={() => setShowAddAgentForm(false)}
                  />
                </div>
              )}

              {/* Agents list */}
              <div className="flex flex-col gap-6">
                {team.metadata?.agents && team.metadata.agents.length > 0 ? (
                  team.metadata.agents.map((agent, index) => {
                    // Determine agent color based on index
                    const colors = ["#62A0DD", "#0064C7", "#003D7A"];
                    const color = colors[index % colors.length];

                    // Check if the agent is verified (just for demonstration)
                    const isVerified = index % 2 === 0;

                    return (
                      <div
                        key={index}
                        className="flex flex-col items-start gap-4 p-4 sm:flex-row sm:items-center sm:gap-3"
                      >
                        <div
                          className="h-20 w-20 flex-shrink-0 rounded-full sm:h-24 sm:w-24"
                          style={{
                            backgroundColor: agent.imageUrl
                              ? "transparent"
                              : color,
                          }}
                        >
                          {agent.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={agent.imageUrl}
                              alt={agent.name || "Agent avatar"}
                              className="h-full w-full rounded-full object-cover"
                            />
                          )}
                        </div>
                        <div className="flex flex-1 flex-col gap-3">
                          {/* Agent header */}
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-3">
                              <h3 className="font-['Replica_LL',sans-serif] text-lg font-bold leading-[27px] tracking-[0.54px] text-white">
                                {agent.name || "Unnamed Agent"}
                              </h3>

                              {isVerified && (
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#B8DFB5]">
                                  <Check size={16} className="text-[#318F2A]" />
                                </div>
                              )}
                            </div>

                            {/* Agent description */}
                            <p className="font-['Replica_LL',sans-serif] text-sm leading-[21px] tracking-[0.42px] text-[#6D85A4]">
                              {agent.description || "No description provided."}
                            </p>
                          </div>

                          {/* Agent skills - Display all skills */}
                          {agent.skills && agent.skills.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {agent.skills.map((skill, skillIndex) => (
                                <div
                                  key={skillIndex}
                                  className="bg-[#11121A] px-2 py-1 font-['Trim_Mono',monospace] text-sm leading-[21px] tracking-[0.42px] text-[#6D85A4]"
                                >
                                  <div className="flex items-center gap-2">
                                    {skill.type === "Other" && skill.customSkill
                                      ? skill.customSkill
                                      : skill.type || "Unknown Skill"}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Agent links */}
                          <div className="flex flex-wrap gap-2">
                            {agent.url && (
                              <a
                                href={agent.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-[#11121A] px-2 py-1 text-[#6D85A4] transition-colors duration-200 hover:bg-[#1D202E]"
                              >
                                <div className="flex items-center gap-2 font-['Trim_Mono',monospace] text-sm uppercase leading-[21px] tracking-[0.42px]">
                                  <Search
                                    size={16}
                                    className="text-[#6D85A4]"
                                  />
                                  Repository
                                </div>
                              </a>
                            )}

                            {agent.social?.twitter && (
                              <a
                                href={`https://x.com/${agent.social.twitter.replace("@", "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-[#11121A] px-2 py-1 text-[#6D85A4] transition-colors duration-200 hover:bg-[#1D202E]"
                              >
                                <div className="flex items-center gap-2 font-['Trim_Mono',monospace] text-sm uppercase leading-[21px] tracking-[0.42px]">
                                  <Search
                                    size={16}
                                    className="text-[#6D85A4]"
                                  />
                                  X.com/{agent.social.twitter.replace("@", "")}
                                </div>
                              </a>
                            )}

                            {agent.social?.telegram && (
                              <a
                                href={`https://t.me/${agent.social.telegram.replace("@", "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-[#11121A] px-2 py-1 text-[#6D85A4] transition-colors duration-200 hover:bg-[#1D202E]"
                              >
                                <div className="flex items-center gap-2 font-['Trim_Mono',monospace] text-sm uppercase leading-[21px] tracking-[0.42px]">
                                  <Search
                                    size={16}
                                    className="text-[#6D85A4]"
                                  />
                                  Telegram
                                </div>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-[#6D85A4]">
                    No agents registered yet. Add an agent to get started.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Vertical divider between columns - KEEP THIS (hidden on mobile) */}
          <div className="mx-6 hidden min-h-full w-[1px] bg-[#303846] opacity-80 lg:block"></div>

          {/* Horizontal divider for mobile view */}
          <div className="my-10 block h-px w-full bg-[#303846] opacity-60 lg:hidden"></div>

          {/* Right column - Competitions */}
          <div className="flex w-full flex-col gap-8 lg:w-[466px]">
            <h2 className="font-['Trim_Mono',monospace] text-xl font-semibold leading-[31.2px] text-white md:text-2xl">
              Competitions
            </h2>

            <div className="flex flex-col gap-6">
              {competitions.length > 0 ? (
                competitions.map((competition, index) => {
                  // Determine competition color based on index
                  const colors = [
                    "#D9E5D8",
                    "#B8DFB5",
                    "#52B04B",
                    "#38A430",
                    "#22651D",
                  ];
                  const color = colors[index % colors.length];

                  // Wrap the entire competition card in a Link if it has an external link
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
                          className="group relative block transition-colors duration-200 hover:bg-[#1a1a24]"
                        >
                          {children}
                          <div className="absolute bottom-2 right-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                            <ExternalLink
                              size={16}
                              className="text-[#6D85A4]"
                            />
                          </div>
                        </Link>
                      );
                    }
                    return <>{children}</>;
                  };

                  return (
                    <CompetitionWrapper key={competition.id}>
                      <div className="flex flex-col items-start gap-4 p-2 sm:flex-row sm:gap-2">
                        <div
                          className="h-24 w-full flex-shrink-0 sm:w-24"
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
                              style={{
                                objectFit: "cover",
                                width: "100%",
                                height: "100%",
                              }}
                            />
                          )}
                        </div>

                        <div className="flex flex-1 flex-col gap-3 sm:ml-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-0">
                              <h3 className="font-['Replica_LL',sans-serif] text-lg font-bold leading-[27px] tracking-[0.54px] text-white sm:max-w-[253px]">
                                {competition.name}
                              </h3>
                              <div className="relative">
                                <div className="self-start bg-[#11121A] px-2 py-1 font-['Trim_Mono',monospace] text-base leading-6 tracking-[0.48px] text-[#6D85A4]">
                                  {competition.status}
                                </div>
                              </div>
                            </div>

                            <p className="font-['Replica_LL',sans-serif] text-sm leading-[21px] tracking-[0.42px] text-[#6D85A4] sm:max-w-[342px]">
                              {competition.description ||
                                "No description available"}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                            <div className="bg-[#11121A] px-2 py-1 text-[#6D85A4]">
                              <div className="flex items-center gap-2 font-['Trim_Mono',monospace] text-sm leading-[21px] tracking-[0.42px]">
                                Created:{" "}
                                {new Date(
                                  competition.createdAt,
                                ).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CompetitionWrapper>
                  );
                })
              ) : (
                <div className="py-8 text-center text-[#6D85A4]">
                  No upcoming competitions available at this time.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
