"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { RegistrationForm } from "@/components/registration-form";
import { Team, getTeamByWalletAddress } from "@/lib/api";

/**
 * Account page component
 *
 * Displays the registration form for teams to register with the Recall network,
 * but only if the user is connected with a wallet.
 * If the user's wallet is already registered, displays the team information.
 *
 * @returns Account page component
 */
export default function AccountPage() {
  const { address } = useAccount();
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const [team, setTeam] = useState<Team | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  // When the user is connected with a wallet, check if they already have a team
  useEffect(() => {
    // Define the async function to check for existing team
    async function checkForExistingTeam() {
      if (address) {
        try {
          console.log("Checking for team with wallet address:", address);
          const matchingTeam = await getTeamByWalletAddress(address);

          if (matchingTeam) {
            console.log("Found matching team:", matchingTeam);
            setTeam(matchingTeam);
          } else {
            console.log("No matching team found for wallet:", address);
            setTeam(undefined);
          }
        } catch (err) {
          console.error("Error fetching team by wallet address:", err);
          setTeam(undefined);
          setError("Failed to check team registration status");
        } finally {
          setIsLoading(false);
        }
        return;
      }
      // If no address, set loading to false
      setIsLoading(false);
    }

    // Once connection state is settled, check for team
    setIsLoading(true);
    checkForExistingTeam();
  }, [address]);

  useEffect(() => {
    console.log("Current team state:", team);
    console.log("Current loading state:", isLoading);
  }, [team, isLoading]);

  return (
    <div className="bg-background flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-3xl space-y-8">
        <div className="text-center">
          <h1 className="mb-3 text-3xl font-extrabold tracking-tight">
            Team Registration
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl">
            Register your team and agent metadata for the Recall network. After
            registration, you will receive an API key that you can use to access
            the Recall API.
          </p>
        </div>

        {isLoading ? (
          <div className="bg-card rounded-lg border p-8 text-center shadow-sm">
            <p>Checking registration status...</p>
          </div>
        ) : address ? (
          error ? (
            <div className="bg-card space-y-4 rounded-lg border p-8 text-center shadow-sm">
              <p className="text-destructive">{error}</p>
              <p>
                Please try again later or contact support if the issue persists.
              </p>
            </div>
          ) : team ? (
            <div className="bg-card rounded-lg border p-6 shadow-sm sm:p-8">
              <h2 className="mb-4 text-xl font-semibold">
                Your Team is Registered
              </h2>
              <div className="space-y-3">
                <p>
                  <strong>Team Name:</strong> {team.name}
                </p>
                <p>
                  <strong>Contact:</strong> {team.contactPerson}
                </p>
                <p>
                  <strong>Email:</strong> {team.email}
                </p>
                <p>
                  <strong>Wallet Address:</strong> {team.walletAddress}
                </p>
                {team.metadata && team.metadata.length > 0 && (
                  <div className="mt-4">
                    <h3 className="mb-2 text-lg font-medium">
                      Registered Agents
                    </h3>
                    {team.metadata.map((agent, index) => (
                      <div
                        key={index}
                        className="border-muted-foreground/20 mb-4 space-y-2 border-l-2 pl-2"
                      >
                        <div>
                          <p>
                            <strong>Agent Name:</strong>{" "}
                            {agent.name || "Not specified"}
                          </p>
                          {agent.version && (
                            <p>
                              <strong>Version:</strong> {agent.version}
                            </p>
                          )}
                          {agent.url && (
                            <p>
                              <strong>URL:</strong> {agent.url}
                            </p>
                          )}
                        </div>
                        {agent.description && (
                          <p>
                            <strong>Description:</strong> {agent.description}
                          </p>
                        )}
                        {agent.social && (
                          <div>
                            <h4 className="text-md mt-2 font-medium">Social</h4>
                            {agent.social.email && (
                              <p>
                                <strong>Email:</strong> {agent.social.email}
                              </p>
                            )}
                            {agent.social.twitter && (
                              <p>
                                <strong>Twitter:</strong> {agent.social.twitter}
                              </p>
                            )}
                            {agent.social.github && (
                              <p>
                                <strong>GitHub:</strong> {agent.social.github}
                              </p>
                            )}
                            {agent.social.discord && (
                              <p>
                                <strong>Discord:</strong> {agent.social.discord}
                              </p>
                            )}
                            {agent.social.telegram && (
                              <p>
                                <strong>Telegram:</strong>{" "}
                                {agent.social.telegram}
                              </p>
                            )}
                          </div>
                        )}
                        {agent.skills && agent.skills.length > 0 && (
                          <div>
                            <h4 className="text-md mt-2 font-medium">Skills</h4>
                            <ul className="ml-4 list-disc">
                              {agent.skills.map((skill, skillIndex) => (
                                <li key={skillIndex}>
                                  {skill.type}
                                  {skill.type === "Other" &&
                                    skill.customSkill && (
                                      <>: {skill.customSkill}</>
                                    )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-6 text-center">
                <p className="text-muted-foreground text-sm">
                  Team profile update functionality will be coming soon.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-lg border p-6 shadow-sm sm:p-8">
              <RegistrationForm onSuccess={setTeam} />
            </div>
          )
        ) : (
          <div className="bg-card space-y-6 rounded-lg border p-8 text-center shadow-sm">
            <p className="text-lg">
              Please connect your wallet to register your team
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
