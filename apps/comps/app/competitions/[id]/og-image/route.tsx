import { ImageResponse } from "next/og";

import { getBaseUrl } from "@/lib/get-site-url";
import { createSafeClient } from "@/rpc/clients/server-side";
import { formatCompetitionDates } from "@/utils/competition-utils";
import { formatBigintAmount } from "@/utils/format";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const client = await createSafeClient();
  const { id } = await context.params;

  const { data: competition } = await client.competitions.getById({
    id,
  });

  if (!competition) {
    return new ImageResponse(
      (
        <div
          tw="flex w-full h-full items-center justify-center bg-[#020817] text-white text-[54px] font-bold"
          style={{
            fontFamily:
              "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          Recall Competitions
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }

  const baseUrl = getBaseUrl();
  const backgroundImage = `${baseUrl}/og-background.svg`;
  const recallSvgUrl = `${baseUrl}/recall-token.svg`;
  const recallTextSvgUrl = `${baseUrl}/logo_white.svg`;

  return new ImageResponse(
    (
      <div
        tw="flex flex-col items-center justify-center w-full h-full bg-no-repeat bg-[length:100%_100%]"
        style={{
          backgroundImage: `url(${backgroundImage})`,
        }}
      >
        <div tw="flex flex-col items-center justify-center gap-12 w-[916px]">
          <div tw="font-bold text-[72px] text-[#e5e5e5] leading-none text-center w-[914px]">
            {competition.name}
          </div>

          <div tw="flex flex-row gap-3 w-[916px] h-[212px]">
            <div tw="flex flex-col gap-3 w-[452px] h-[212px]">
              <div tw="flex flex-row justify-center items-center gap-3 w-[451px] h-[72px] bg-black/40 border border-[#3D3D3D] rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={recallSvgUrl}
                  alt={"Recall token icon"}
                  tw="w-6 h-6 rounded-full"
                />
                <span tw="font-normal text-[40px] text-[#E5E5E5] leading-none">
                  {formatBigintAmount(
                    BigInt(competition.rewardsTge?.agentPool ?? 0),
                  )}
                </span>
                <span tw="font-light text-[32px] text-[#A7A7A7] leading-none">
                  for Agents
                </span>
              </div>
              <div tw="flex flex-col justify-center items-center gap-3 w-[452px] h-[128px] bg-black/40 border border-[#3D3D3D] rounded-lg py-4 px-3">
                <span tw="text-[32px] font-normal text-[#A7A7A7] leading-none">
                  Duration
                </span>
                <span tw="text-[40px] font-normal text-[#E5E5E5] leading-none">
                  {formatCompetitionDates(
                    competition.startDate,
                    competition.endDate,
                  )}
                </span>
              </div>
            </div>

            <div tw="flex flex-col gap-3 w-[452px] h-[212px]">
              <div tw="flex flex-row justify-center items-center gap-3 w-[451px] h-[72px] bg-black/40 border border-[#3D3D3D] rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={recallSvgUrl}
                  alt={"Recall token icon"}
                  tw="w-6 h-6 rounded-full"
                />
                <span tw="font-normal text-[40px] text-[#E5E5E5] leading-none">
                  {formatBigintAmount(
                    BigInt(competition.rewardsTge?.userPool ?? 0),
                  )}
                </span>
                <span tw="font-light text-[32px] text-[#A7A7A7] leading-none">
                  for Boosters
                </span>
              </div>
              <div tw="flex flex-col justify-center items-center gap-3 w-[452px] h-[128px] bg-black/40 border border-[#3D3D3D] rounded-lg py-4 px-3">
                <span tw="text-[32px] font-normal text-[#A7A7A7] leading-none">
                  Boost Window
                </span>
                <span tw="text-[40px] font-normal text-[#E5E5E5] leading-none">
                  {formatCompetitionDates(
                    competition.boostStartDate,
                    competition.boostEndDate,
                  )}
                </span>
              </div>
            </div>
          </div>

          <div tw="flex flex-col items-center gap-4 w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={recallTextSvgUrl} alt={"Recall text icon"} tw="h-8" />
            <div tw="font-normal text-[32px] text-[#87B0D9] tracking-wider leading-none font-mono">
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
