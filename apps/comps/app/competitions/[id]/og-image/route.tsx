import { toSvg } from "jdenticon";
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { createSafeClient } from "@/rpc/clients/server-side";
import { RouterOutputs } from "@/rpc/router";
import { formatCompetitionDates } from "@/utils/competition-utils";
import { formatAmount } from "@/utils/format";
import { formatBigintAmount } from "@/utils/format";

/** Button CTA colors */
const BUTTON_BLUE = "#0E66BE";
const BUTTON_BLUE_LIGHT = "#1A8FE3";

/** Text colors */
const TEXT_GRAY = "#A7A7A7";

/** Trophy colors matching */
const TROPHY_COLORS = {
  first: { text: "#b79128", border: "#b79128" },
  second: { text: "#6e7277", border: "#4b4e51" },
  third: { text: "#834e25", border: "#834e25" },
};

/** Table colors (for active or ended competitions) */
const TABLE_COLORS = {
  headerBg: "#0c0d12",
  rowDark: "#050507",
  rowLight: "#0c0d12",
  border: "#303846",
  textLight: "#93a5ba",
  textSecondary: "#6d85a4",
  green: "#38a430",
  red: "#ef4444",
};

/** Top agents for active competitions */
interface TopAgent {
  id: string;
  name: string;
  imageUrl: string | null;
  rank: number | null;
  portfolioValue: number;
  pnl: number;
  pnlPercent: number;
  change24h: number;
  change24hPercent: number;
}

/** Cached assets for OG image generation */
interface CachedAssets {
  backgroundImage: string | null;
  recallTokenSvg: string | null;
  recallLogoSvg: string | null;
}

/** Font configuration for OG image generation */
interface FontConfig {
  name: string;
  data: ArrayBuffer;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal" | "italic";
}

/** Module-level cache for fonts to avoid repeated network requests */
let cachedFontsPromise: Promise<FontConfig[]> | null = null;

/** Module-level cache for assets to avoid repeated file system reads */
let cachedAssetsPromise: Promise<CachedAssets> | null = null;

/**
 * Generates an identicon SVG as a data URL for agents without profile images.
 *
 * @param agentId - The agent ID to use as the seed for the identicon
 * @param size - The size of the identicon in pixels
 * @returns A data URL containing the SVG identicon
 */
function generateIdenticonDataUrl(agentId: string, size: number = 32): string {
  const svg = toSvg(agentId, size, {
    padding: 0.1,
    hues: [227],
    lightness: {
      color: [0.74, 1.0],
      grayscale: [0.63, 0.82],
    },
    saturation: {
      color: 0.51,
      grayscale: 0.67,
    },
    backColor: "#475569",
  });
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Checks if the competition should show the agents table.
 *
 * @param status - The competition status to check
 * @returns True if the competition status is active, ending, or ended.
 */
function shouldShowAgentsTable(
  status: RouterOutputs["competitions"]["getById"]["status"] | undefined,
): boolean {
  return status ? ["active", "ending", "ended"].includes(status) : false;
}

/**
 * Loads a font from Google Fonts.
 * Note: Satori (next/og) only supports TTF/OTF, not WOFF2, and Geist Mono is not supported.
 *
 * @param family - Font family name (e.g., "Geist" or "Roboto Mono")
 * @param weight - Font weight to load
 * @returns ArrayBuffer of font data
 */
async function loadGoogleFont(
  family: string,
  weight: number,
): Promise<ArrayBuffer> {
  const encodedFamily = encodeURIComponent(family);
  const url = `https://fonts.googleapis.com/css2?family=${encodedFamily}:wght@${weight}&display=swap`;
  const css = await (await fetch(url)).text();
  const resource = css.match(
    /src: url\((.+)\) format\('(opentype|truetype|woff2)'\)/,
  );

  if (resource?.[1]) {
    const response = await fetch(resource[1]);
    if (response.ok) {
      return await response.arrayBuffer();
    }
  }

  throw new Error(`Failed to load ${family} font weight ${weight}`);
}

/**
 * Loads fonts for OG image generation using Geist and Roboto Mono from Google Fonts.
 * Font data is cached in memory to avoid repeated network requests on each OG image generation.
 *
 * @returns Array of font configurations
 */
async function loadFonts(): Promise<FontConfig[]> {
  if (!cachedFontsPromise) {
    cachedFontsPromise = (async () => {
      try {
        const [
          geistLight,
          geistRegular,
          geistBold,
          robotoMonoRegular,
          robotoMonoBold,
        ] = await Promise.all([
          loadGoogleFont("Geist", 300),
          loadGoogleFont("Geist", 400),
          loadGoogleFont("Geist", 700),
          loadGoogleFont("Roboto Mono", 400),
          loadGoogleFont("Roboto Mono", 700),
        ]);

        return [
          { name: "Geist", data: geistLight, weight: 300, style: "normal" },
          { name: "Geist", data: geistRegular, weight: 400, style: "normal" },
          { name: "Geist", data: geistBold, weight: 700, style: "normal" },
          {
            name: "Roboto Mono",
            data: robotoMonoRegular,
            weight: 400,
            style: "normal",
          },
          {
            name: "Roboto Mono",
            data: robotoMonoBold,
            weight: 700,
            style: "normal",
          },
        ];
      } catch (err) {
        // Clear cache on error so subsequent requests can retry
        cachedFontsPromise = null;
        console.error("Failed to load fonts:", err);
        return [];
      }
    })();
  }
  return cachedFontsPromise;
}

/**
 * Loads an asset from the public directory and returns it as a base64 data URL.
 *
 * @param assetPath - Path relative to the public directory
 * @returns Base64 data URL for the asset, or null if the asset cannot be loaded
 */
async function loadAssetAsBase64(assetPath: string): Promise<string | null> {
  try {
    const fullPath = join(process.cwd(), "public", assetPath);
    const buffer = await readFile(fullPath);
    const base64 = buffer.toString("base64");

    const ext = extname(assetPath).toLowerCase();
    let mimeType = "image/svg+xml";
    if (ext === ".png") mimeType = "image/png";
    if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";

    return `data:${mimeType};base64,${base64}`;
  } catch (err) {
    console.error(`Failed to load asset at path "${assetPath}":`, err);
    return null;
  }
}

/**
 * Loads static assets for OG image generation.
 * Asset data is cached in memory to avoid repeated file system reads on each OG image generation.
 *
 * @returns Object containing base64-encoded assets
 */
async function loadAssets(): Promise<CachedAssets> {
  if (!cachedAssetsPromise) {
    cachedAssetsPromise = (async () => {
      const [backgroundImage, recallTokenSvg, recallLogoSvg] =
        await Promise.all([
          loadAssetAsBase64("og-background.png"),
          loadAssetAsBase64("recall-token.svg"),
          loadAssetAsBase64("logo_full_grey.svg"),
        ]);
      return { backgroundImage, recallTokenSvg, recallLogoSvg };
    })();
  }
  return cachedAssetsPromise;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<ImageResponse> {
  const monospaceFontFamily = "Roboto Mono, sans-serif";

  try {
    const client = await createSafeClient();
    const { id } = await context.params;

    const [{ data: competition }, fonts, assets] = await Promise.all([
      client.competitions.getById({ id }),
      loadFonts(),
      loadAssets(),
    ]);

    let topAgents: TopAgent[] = [];
    if (shouldShowAgentsTable(competition?.status)) {
      try {
        const result = await client.competitions.getAgents({
          competitionId: id,
          paging: { limit: 3, offset: 0, sort: "rank" },
          includeInactive: false,
        });

        if (result.isSuccess) {
          topAgents = result.data.agents.map((a) => ({
            id: a.id,
            name: a.name,
            imageUrl: a.imageUrl,
            rank: a.rank,
            portfolioValue: a.portfolioValue,
            pnl: a.pnl,
            pnlPercent: a.pnlPercent,
            change24h: a.change24h,
            change24hPercent: a.change24hPercent,
          }));
        }
      } catch (err) {
        console.error("Failed to load top agents for active competition:", err);
      }
    }

    const { backgroundImage, recallTokenSvg, recallLogoSvg } = assets;
    const normalFontFamily = "Geist, sans-serif";

    // Fall back to simple image if any required assets failed to load
    if (!competition || !backgroundImage || !recallTokenSvg || !recallLogoSvg) {
      return new ImageResponse(
        (
          <div
            tw="flex w-full h-full items-center justify-center bg-slate-950 text-white text-5xl font-bold"
            style={{ fontFamily: monospaceFontFamily }}
          >
            {competition?.name || "Recall Competitions"}
          </div>
        ),
        { width: 1200, height: 675, fonts },
      );
    }

    const totalRewards =
      BigInt(competition.rewardsTge?.agentPool ?? 0) +
      BigInt(competition.rewardsTge?.userPool ?? 0);

    return new ImageResponse(
      (
        <div
          tw="flex w-full h-full"
          style={{
            fontFamily: monospaceFontFamily,
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: "cover",
          }}
        >
          {/* Left section */}
          <div
            tw="flex flex-col w-1/2 px-16 mb-12"
            style={{ justifyContent: "flex-end" }}
          >
            <div tw="flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={recallLogoSvg}
                alt="Recall logo"
                height={28}
                width={120}
                style={{ marginBottom: 6 }}
              />

              <div
                tw="text-6xl text-white leading-tight text-center font-bold uppercase"
                style={{ margin: "0 0 4px 0" }}
              >
                {competition.name}
              </div>

              <span
                tw="text-3xl tracking-widest uppercase leading-tight"
                style={{ margin: 0, color: TEXT_GRAY }}
              >
                {formatCompetitionDates(
                  competition.startDate,
                  competition.endDate,
                )}
              </span>
            </div>
          </div>

          {/* Right section */}
          <div tw="flex flex-col w-1/2 px-8 pt-12 pb-10">
            {shouldShowAgentsTable(competition.status) &&
            topAgents.length > 0 ? (
              <div tw="flex flex-col w-full text-white h-full justify-between">
                {/* Table container */}
                <div
                  tw="flex flex-col w-full rounded-lg overflow-hidden"
                  style={{
                    border: `1px solid ${TABLE_COLORS.border}`,
                  }}
                >
                  {/* Table header */}
                  <div
                    tw="flex w-full px-8 py-3 text-sm font-semibold tracking-wider justify-between"
                    style={{
                      backgroundColor: TABLE_COLORS.headerBg,
                      color: "#e9edf1",
                      borderBottom: `1px solid ${TABLE_COLORS.border}`,
                    }}
                  >
                    <div tw="w-20">Rank</div>
                    <div tw="flex-1">Agent</div>
                    <div>Portfolio</div>
                  </div>

                  {/* Table rows */}
                  {topAgents.map((agent, index) => {
                    const rankColors =
                      agent.rank === 1
                        ? TROPHY_COLORS.first
                        : agent.rank === 2
                          ? TROPHY_COLORS.second
                          : agent.rank === 3
                            ? TROPHY_COLORS.third
                            : { text: "#666", border: "#333" };

                    return (
                      <div
                        key={agent.id}
                        tw="flex w-full items-center px-8 py-6 justify-between"
                        style={{
                          backgroundColor:
                            index % 2 === 0
                              ? TABLE_COLORS.rowDark
                              : TABLE_COLORS.rowLight,
                          borderBottom:
                            index < topAgents.length - 1
                              ? `1px solid ${TABLE_COLORS.border}`
                              : "none",
                        }}
                      >
                        {/* Rank badge */}
                        <div tw="w-20 flex items-center">
                          <div
                            tw="flex items-center justify-center px-2 py-1 rounded text-sm font-bold"
                            style={{
                              border: `1px solid ${rankColors.border}`,
                              color: rankColors.text,
                            }}
                          >
                            {agent.rank === 1
                              ? "1st"
                              : agent.rank === 2
                                ? "2nd"
                                : agent.rank === 3
                                  ? "3rd"
                                  : `${agent.rank}th`}
                          </div>
                        </div>

                        {/* Agent info */}
                        <div
                          tw="flex-1 flex items-center"
                          style={{ gap: "8px" }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={
                              agent.imageUrl ||
                              generateIdenticonDataUrl(agent.id)
                            }
                            alt={agent.name}
                            width={32}
                            height={32}
                            tw="rounded-full"
                            style={{
                              backgroundColor: "#475569",
                            }}
                          />
                          <span
                            tw="text-xl truncate"
                            style={{ color: TABLE_COLORS.textLight }}
                          >
                            {agent.name.length > 12
                              ? `${agent.name.slice(0, 12)}…`
                              : agent.name}
                          </span>
                        </div>

                        {/* Portfolio value */}
                        <div tw="flex flex-col items-end">
                          <span
                            tw="text-xl"
                            style={{ color: TABLE_COLORS.textLight }}
                          >
                            ${formatAmount(agent.portfolioValue, 2, true, 2)}
                          </span>
                          <div tw="flex" style={{ gap: "4px" }}>
                            <span
                              tw="text-sm"
                              style={{
                                color:
                                  agent.pnlPercent >= 0
                                    ? TABLE_COLORS.green
                                    : TABLE_COLORS.red,
                              }}
                            >
                              ({agent.pnlPercent >= 0 ? "+" : ""}
                              {formatAmount(agent.pnlPercent)}%)
                            </span>
                            <span
                              tw="text-sm"
                              style={{ color: TABLE_COLORS.textSecondary }}
                            >
                              {agent.pnl >= 0 ? "+" : ""}$
                              {formatAmount(agent.pnl, 2, true, 2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Button below table */}
                <div
                  tw="flex items-center justify-center px-10 py-8 rounded-xl text-3xl tracking-tight font-semibold"
                  style={{
                    background: `linear-gradient(180deg, ${BUTTON_BLUE_LIGHT} 0%, ${BUTTON_BLUE} 100%)`,
                    boxShadow:
                      "0 12px 16px rgba(0, 0, 0, 0.8), inset 4px 12px 20px #3399ff",
                    color: "#e5f2ff",
                  }}
                >
                  {competition.status === "ending" ||
                  competition.status === "ended"
                    ? "RESULTS"
                    : "PREDICT"}
                </div>
              </div>
            ) : (
              <div tw="flex flex-col items-center text-3xl tracking-wider gap-y-5 h-full justify-end">
                {/* Top text - left aligned */}
                <div tw="flex flex-col items-start w-full">
                  <div style={{ display: "flex", columnGap: "20px" }}>
                    <span style={{ color: TEXT_GRAY }}>{"///"}</span>
                    <span tw="text-white">PREDICT</span>
                    <span style={{ color: TEXT_GRAY }}>WINNERS</span>
                  </div>
                </div>

                <div tw="flex items-center" style={{ gap: "16px" }}>
                  <div tw="flex items-center justify-center w-14 h-14 bg-white rounded-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={recallTokenSvg}
                      alt="Recall token"
                      width={36}
                      height={36}
                    />
                  </div>
                  <span
                    tw="text-white font-bold text-[120px]"
                    style={{ fontFamily: normalFontFamily }}
                  >
                    {formatBigintAmount(totalRewards, undefined, false)}
                  </span>
                </div>

                {/* Bottom text - right aligned */}
                <div tw="flex flex-col items-end w-full">
                  <div style={{ display: "flex", columnGap: "20px" }}>
                    <span tw="text-white">REWARD</span>
                    <span style={{ color: TEXT_GRAY }}>POOL</span>
                    <span style={{ color: TEXT_GRAY }}>{"///"}</span>
                  </div>
                </div>

                <div
                  tw="flex items-center justify-center mt-20 px-42 py-7 rounded-xl text-white text-4xl tracking-widest font-semibold"
                  style={{
                    background: `linear-gradient(180deg, ${BUTTON_BLUE_LIGHT} 0%, ${BUTTON_BLUE} 100%)`,
                    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.45)",
                  }}
                >
                  {competition.status === "ending" ||
                  competition.status === "ended"
                    ? "RESULTS"
                    : "PREDICT"}
                </div>
              </div>
            )}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 675,
        fonts,
      },
    );
  } catch (err) {
    console.error("Failed to generate OG image:", err);
    // Return a simple fallback image on any unexpected error
    return new ImageResponse(
      (
        <div
          tw="flex w-full h-full items-center justify-center bg-slate-950 text-white text-5xl font-bold"
          style={{ fontFamily: monospaceFontFamily }}
        >
          Recall Competitions
        </div>
      ),
      { width: 1200, height: 675 },
    );
  }
}
