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
      }
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
                {team.metadata && (
                  <div className="mt-4">
                    <h3 className="mb-2 text-lg font-medium">Agent Metadata</h3>
                    <div className="border-muted-foreground/20 space-y-2 border-l-2 pl-2">
                      {team.metadata.ref && (
                        <div>
                          <p>
                            <strong>Agent Name:</strong>{" "}
                            {team.metadata.ref.name || "Not specified"}
                          </p>
                          {team.metadata.ref.version && (
                            <p>
                              <strong>Version:</strong>{" "}
                              {team.metadata.ref.version}
                            </p>
                          )}
                          {team.metadata.ref.url && (
                            <p>
                              <strong>URL:</strong> {team.metadata.ref.url}
                            </p>
                          )}
                        </div>
                      )}
                      {team.metadata.description && (
                        <p>
                          <strong>Description:</strong>{" "}
                          {team.metadata.description}
                        </p>
                      )}
                      {team.metadata.social && (
                        <div>
                          <h4 className="text-md mt-2 font-medium">Social</h4>
                          {team.metadata.social.name && (
                            <p>
                              <strong>Name:</strong> {team.metadata.social.name}
                            </p>
                          )}
                          {team.metadata.social.email && (
                            <p>
                              <strong>Email:</strong>{" "}
                              {team.metadata.social.email}
                            </p>
                          )}
                          {team.metadata.social.twitter && (
                            <p>
                              <strong>Twitter:</strong>{" "}
                              {team.metadata.social.twitter}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
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
