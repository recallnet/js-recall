import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { createSafeClient } from "@/rpc/clients/server-side";
import { formatCompetitionDates } from "@/utils/competition-utils";
import { formatBigintAmount } from "@/utils/format";

/**
 * Loads an asset from the public directory and returns it as a base64 data URL.
 *
 * @param assetPath - Path relative to the public directory
 * @returns Base64 data URL for the asset
 */
async function loadAssetAsBase64(assetPath: string): Promise<string> {
  const fullPath = join(process.cwd(), "public", assetPath);
  const buffer = await readFile(fullPath);
  const base64 = buffer.toString("base64");

  const ext = extname(assetPath).toLowerCase();
  let mimeType = "image/svg+xml";
  if (ext === ".png") mimeType = "image/png";
  if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";

  return `data:${mimeType};base64,${base64}`;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<ImageResponse> {
  const client = await createSafeClient();
  const { id } = await context.params;

  const { data: competition } = await client.competitions.getById({
    id,
  });

  if (!competition) {
    return new ImageResponse(
      (
        <div tw="flex w-full h-full items-center justify-center bg-slate-950 text-white text-5xl font-bold">
          Recall Competitions
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }

  const [backgroundImage, recallTokenSvg, recallLogoSvg] = await Promise.all([
    loadAssetAsBase64("og-background.svg"),
    loadAssetAsBase64("recall-token.svg"),
    loadAssetAsBase64("logo_white.svg"),
  ]);

  return new ImageResponse(
    (
      <div
        tw="flex flex-col items-center justify-center w-full h-full"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: "100% 100%",
        }}
      >
        <div tw="flex flex-col items-center justify-center gap-12 w-3/4">
          <h1 tw="font-bold text-7xl text-neutral-200 leading-none text-center flex justify-center">
            {competition.name}
          </h1>

          <div tw="flex flex-row gap-3 w-full">
            <div tw="flex flex-col gap-3 flex-1">
              <div tw="flex flex-row justify-center items-center gap-4 py-4 bg-black/40 border border-neutral-700 rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div tw="flex items-center justify-center w-8 h-8 bg-white rounded-full">
                  <img
                    src={recallTokenSvg}
                    alt="Recall token icon"
                    width={20}
                    height={20}
                  />
                </div>
                <span tw="text-4xl text-neutral-200 leading-none">
                  {formatBigintAmount(
                    BigInt(competition.rewardsTge?.agentPool ?? 0),
                  )}
                </span>
                <span tw="font-light text-3xl text-neutral-400 leading-none ml-2">
                  for Agents
                </span>
              </div>
              <div tw="flex flex-col justify-center items-center gap-3 py-6 bg-black/40 border border-neutral-700 rounded-lg">
                <span tw="text-3xl text-neutral-400 leading-none">
                  Duration
                </span>
                <span tw="text-4xl text-neutral-200 leading-none">
                  {formatCompetitionDates(
                    competition.startDate,
                    competition.endDate,
                  )}
                </span>
              </div>
            </div>

            <div tw="flex flex-col gap-3 flex-1">
              <div tw="flex flex-row justify-center items-center gap-4 py-4 bg-black/40 border border-neutral-700 rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div tw="flex items-center justify-center w-8 h-8 bg-white rounded-full">
                  <img
                    src={recallTokenSvg}
                    alt="Recall token icon"
                    width={20}
                    height={20}
                  />
                </div>
                <span tw="text-4xl text-neutral-200 leading-none">
                  {formatBigintAmount(
                    BigInt(competition.rewardsTge?.userPool ?? 0),
                  )}
                </span>
                <span tw="font-light text-3xl text-neutral-400 leading-none ml-2">
                  for Boosters
                </span>
              </div>
              <div tw="flex flex-col justify-center items-center gap-3 py-6 bg-black/40 border border-neutral-700 rounded-lg">
                <span tw="text-3xl text-neutral-400 leading-none">
                  Boost Window
                </span>
                <span tw="text-4xl text-neutral-200 leading-none">
                  {formatCompetitionDates(
                    competition.boostStartDate,
                    competition.boostEndDate,
                  )}
                </span>
              </div>
            </div>
          </div>

          <div tw="flex flex-row items-center gap-6 justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={recallLogoSvg} alt="Recall logo" height={32} />
            <div tw="text-3xl text-sky-300 tracking-wider leading-none font-mono">
              https://app.recall.network
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
