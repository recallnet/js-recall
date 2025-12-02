import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { createSafeClient } from "@/rpc/clients/server-side";
import { formatCompetitionDates } from "@/utils/competition-utils";
import { formatBigintAmount } from "@/utils/format";

const BUTTON_BLUE = "#0E66BE";
const BUTTON_BLUE_LIGHT = "#1A8FE3";

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
      { width: 1200, height: 675 },
    );
  }

  const [backgroundImage, recallTokenSvg, recallLogoSvg] = await Promise.all([
    loadAssetAsBase64("og-background.png"),
    loadAssetAsBase64("recall-token.svg"),
    loadAssetAsBase64("logo_full_grey.svg"),
  ]);

  const totalRewards =
    BigInt(competition.rewardsTge?.agentPool ?? 0) +
    BigInt(competition.rewardsTge?.userPool ?? 0);

  return new ImageResponse(
    (
      <div
        tw="flex w-full h-full"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: "cover",
        }}
      >
        {/* Left section */}
        <div
          tw="flex flex-col w-1/2 px-16"
          style={{ justifyContent: "flex-end", paddingBottom: "80px" }}
        >
          <div tw="flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={recallLogoSvg}
              alt="Recall logo"
              height={28}
              width={120}
            />

            <h1
              tw="text-5xl text-white leading-tight mt-6 text-center"
              style={{ fontWeight: 700 }}
            >
              {competition.name.toUpperCase()}
            </h1>

            <span tw="text-xl mt-6 tracking-widest text-gray-400 uppercase">
              {formatCompetitionDates(
                competition.startDate,
                competition.endDate,
              )}
            </span>
          </div>
        </div>

        {/* Right section */}
        <div
          tw="flex flex-col w-1/2 px-16"
          style={{ justifyContent: "flex-end", paddingBottom: "80px" }}
        >
          <div tw="flex flex-col items-center">
            {/* Top text - left aligned */}
            <div tw="flex flex-col items-start w-full">
              <div tw="flex text-xl tracking-wider" style={{ gap: "8px" }}>
                <span tw="text-gray-400">{"///"}</span>
                <span tw="text-white">PREDICT</span>
                <span tw="text-gray-400">THE WINNERS</span>
              </div>

              <div tw="flex text-xl tracking-wider mt-1" style={{ gap: "8px" }}>
                <span tw="text-gray-400">&amp;</span>
                <span tw="text-white">EARN</span>
                <span tw="text-gray-400">UP TO</span>
              </div>
            </div>

            <div tw="flex items-center mt-10" style={{ gap: "16px" }}>
              <div tw="flex items-center justify-center w-14 h-14 bg-white rounded-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={recallTokenSvg}
                  alt="Recall token"
                  width={36}
                  height={36}
                />
              </div>
              <span tw="text-white text-8xl" style={{ fontWeight: 300 }}>
                {formatBigintAmount(totalRewards)}
              </span>
            </div>

            {/* Bottom text - right aligned */}
            <div tw="flex flex-col items-end w-full mt-4">
              <div tw="flex text-xl tracking-wider" style={{ gap: "8px" }}>
                <span tw="text-gray-400">IN</span>
                <span tw="text-white">REWARDS</span>
                <span tw="text-gray-400">{"///"}</span>
              </div>
            </div>

            <div
              tw="flex items-center justify-center mt-10 px-28 py-5 rounded-xl text-white text-2xl tracking-widest"
              style={{
                background: `linear-gradient(180deg, ${BUTTON_BLUE_LIGHT} 0%, ${BUTTON_BLUE} 100%)`,
                fontWeight: 600,
                boxShadow: "0 4px 12px rgba(14, 102, 190, 0.4)",
              }}
            >
              PREDICT
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 675,
    },
  );
}
