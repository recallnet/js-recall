import { toSvg } from "jdenticon";
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { ReactElement } from "react";

import { openForBoosting } from "@/lib/open-for-boosting";
import { createSafeClient } from "@/rpc/clients/server-side";
import { RouterOutputs } from "@/rpc/router";
import { CompetitionLeaderboardEntry } from "@/types/nfl";
import { formatCompetitionDates } from "@/utils/competition-utils";
import { formatAmount, formatBigintAmount } from "@/utils/format";

// =============================================================================
// CONSTANTS
// =============================================================================

/** OG Image dimensions */
const OG_WIDTH = 1200;
const OG_HEIGHT = 675;

/** Font families */
const FONT_MONO = "Roboto Mono, sans-serif";
const FONT_SANS = "Geist, sans-serif";

/** Color palette */
const COLORS = {
  button: { base: "#0E66BE", light: "#1A8FE3" },
  text: { gray: "#A7A7A7", white: "#ffffff", light: "#e5f2ff" },
  trophy: {
    first: { text: "#b79128", border: "#b79128" },
    second: { text: "#6e7277", border: "#4b4e51" },
    third: { text: "#834e25", border: "#834e25" },
    default: { text: "#666", border: "#333" },
  },
  table: {
    headerBg: "#0c0d12",
    rowDark: "#050507",
    rowLight: "#0c0d12",
    border: "#303846",
    textLight: "#93a5ba",
    textSecondary: "#6d85a4",
    headerText: "#e9edf1",
    green: "#38a430",
    red: "#ef4444",
  },
  fallbackBg: "#0f172a",
  avatarBg: "#475569",
};

// =============================================================================
// TYPES
// =============================================================================

type Competition = NonNullable<RouterOutputs["competitions"]["getById"]>;
type CompetitionStatus = Competition["status"];
type CompetitionType = Competition["type"];

/** Trading competition agent data */
interface TradingAgent {
  type: "trading" | "perpetual_futures" | "spot_live_trading";
  id: string;
  name: string;
  imageUrl: string | null;
  rank: number | null;
  portfolioValue: number;
  pnl: number;
  pnlPercent: number;
}

/** Sports prediction competition agent data */
interface SportsAgent {
  type: "sports_prediction";
  id: string;
  name: string;
  imageUrl: string | null;
  rank: number;
  averageBrierScore: number;
  gamesScored: number;
}

/** Union type for leaderboard entries */
type LeaderboardEntry = TradingAgent | SportsAgent;

interface CachedAssets {
  backgroundImage: string | null;
  recallTokenSvg: string | null;
  recallLogoSvg: string | null;
}

interface FontConfig {
  name: string;
  data: ArrayBuffer;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal" | "italic";
}

// =============================================================================
// CACHES
// =============================================================================

let cachedFontsPromise: Promise<FontConfig[]> | null = null;
let cachedAssetsPromise: Promise<CachedAssets> | null = null;

// =============================================================================
// ASSET LOADERS
// =============================================================================

/**
 * Loads a font from Google Fonts.
 * Note: Satori (next/og) only supports TTF/OTF formats.
 */
async function loadGoogleFont(
  family: string,
  weight: number,
): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
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
 * Loads and caches fonts for OG image generation.
 */
async function loadFonts(): Promise<FontConfig[]> {
  if (!cachedFontsPromise) {
    cachedFontsPromise = (async () => {
      try {
        const [geistLight, geistRegular, geistBold, monoRegular, monoBold] =
          await Promise.all([
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
            data: monoRegular,
            weight: 400,
            style: "normal",
          },
          { name: "Roboto Mono", data: monoBold, weight: 700, style: "normal" },
        ];
      } catch (err) {
        cachedFontsPromise = null;
        console.error("Failed to load fonts:", err);
        return [];
      }
    })();
  }
  return cachedFontsPromise;
}

/**
 * Loads a file from public directory as base64 data URL.
 */
async function loadAssetAsBase64(assetPath: string): Promise<string | null> {
  try {
    const fullPath = join(process.cwd(), "public", assetPath);
    const buffer = await readFile(fullPath);
    const base64 = buffer.toString("base64");

    const ext = extname(assetPath).toLowerCase();
    const mimeType =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : "image/svg+xml";

    return `data:${mimeType};base64,${base64}`;
  } catch (err) {
    console.error(`Failed to load asset at path "${assetPath}":`, err);
    return null;
  }
}

/**
 * Loads and caches static assets for OG image generation.
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

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Generates an identicon SVG as a data URL for agents without profile images.
 */
function generateIdenticonDataUrl(agentId: string, size: number = 32): string {
  const svg = toSvg(agentId, size, {
    padding: 0.1,
    hues: [227],
    lightness: { color: [0.74, 1.0], grayscale: [0.63, 0.82] },
    saturation: { color: 0.51, grayscale: 0.67 },
    backColor: COLORS.avatarBg,
  });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/**
 * Returns rank colors based on position.
 */
function getRankColors(rank: number | null): { text: string; border: string } {
  if (rank === 1) return COLORS.trophy.first;
  if (rank === 2) return COLORS.trophy.second;
  if (rank === 3) return COLORS.trophy.third;
  return COLORS.trophy.default;
}

/**
 * Formats rank as ordinal (1st, 2nd, 3rd, 4th, etc).
 */
function formatRankOrdinal(rank: number | null): string {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

/**
 * Truncates text to max length with ellipsis.
 */
function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

/**
 * Determines if competition should show the agents leaderboard table.
 */
function shouldShowAgentsTable(status: CompetitionStatus | undefined): boolean {
  return status ? ["active", "ending", "ended"].includes(status) : false;
}

/**
 * Determines the CTA button text based on competition status.
 */
function getCtaText(competition: Competition): string {
  return openForBoosting(competition) || competition.status === "pending"
    ? "PREDICT"
    : "RESULTS";
}

/**
 * Determines the value column header based on competition type.
 */
function getValueColumnHeader(competitionType: CompetitionType): string {
  return competitionType === "sports_prediction" ? "Score" : "Portfolio";
}

// =============================================================================
// UI COMPONENTS
// =============================================================================

/**
 * Props for the left section component.
 */
interface LeftSectionProps {
  competition: Competition;
  logoSvg: string;
}

/**
 * Left section component for the OG image.
 */
function LeftSection({ competition, logoSvg }: LeftSectionProps): ReactElement {
  return (
    <div
      tw="flex flex-col w-1/2 px-16 mb-12"
      style={{ justifyContent: "flex-end" }}
    >
      <div tw="flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSvg}
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
          style={{ margin: 0, color: COLORS.text.gray }}
        >
          {formatCompetitionDates(competition.startDate, competition.endDate)}
        </span>
      </div>
    </div>
  );
}

/**
 * Props for the leaderboard row component.
 */
interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  index: number;
  isLast: boolean;
}

/**
 * Leaderboard row component for the OG image.
 */
function LeaderboardRow({
  entry,
  index,
  isLast,
}: LeaderboardRowProps): ReactElement {
  const rankColors = getRankColors(entry.rank);

  return (
    <div
      tw="flex w-full items-center px-8 py-6 justify-between"
      style={{
        backgroundColor:
          index % 2 === 0 ? COLORS.table.rowDark : COLORS.table.rowLight,
        borderBottom: isLast ? "none" : `1px solid ${COLORS.table.border}`,
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
          {formatRankOrdinal(entry.rank)}
        </div>
      </div>

      {/* Agent info */}
      <div tw="flex-1 flex items-center" style={{ gap: "8px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={entry.imageUrl || generateIdenticonDataUrl(entry.id)}
          alt={entry.name}
          width={32}
          height={32}
          tw="rounded-full"
          style={{ backgroundColor: COLORS.avatarBg }}
        />
        <span tw="text-xl truncate" style={{ color: COLORS.table.textLight }}>
          {truncate(entry.name, 15)}
        </span>
      </div>

      {/* Value column - different for trading vs sports */}
      {entry.type === "trading" ||
      entry.type === "perpetual_futures" ||
      entry.type === "spot_live_trading" ? (
        <TradingValueColumn entry={entry} />
      ) : entry.type === "sports_prediction" ? (
        <SportsValueColumn entry={entry} />
      ) : null}
    </div>
  );
}

/**
 * Trading value column component for the OG image.
 */
function TradingValueColumn({ entry }: { entry: TradingAgent }): ReactElement {
  const isPositive = entry.pnlPercent >= 0;

  return (
    <div tw="flex flex-col items-end">
      <span tw="text-xl" style={{ color: COLORS.table.textLight }}>
        ${formatAmount(entry.portfolioValue, 2, true, 2)}
      </span>
      <div tw="flex" style={{ gap: "4px" }}>
        <span
          tw="text-sm"
          style={{
            color: isPositive ? COLORS.table.green : COLORS.table.red,
          }}
        >
          ({isPositive ? "+" : ""}
          {formatAmount(entry.pnlPercent)}%)
        </span>
        <span tw="text-sm" style={{ color: COLORS.table.textSecondary }}>
          {entry.pnl >= 0 ? "+" : ""}${formatAmount(entry.pnl, 2, true, 2)}
        </span>
      </div>
    </div>
  );
}

/**
 * Sports value column component for the OG image.
 */
function SportsValueColumn({ entry }: { entry: SportsAgent }): ReactElement {
  return (
    <div tw="flex flex-col items-end">
      <span tw="text-xl" style={{ color: COLORS.table.textLight }}>
        {formatAmount(entry.averageBrierScore, 4)}
      </span>
      <span tw="text-sm" style={{ color: COLORS.table.textSecondary }}>
        {entry.gamesScored} game{entry.gamesScored !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

/**
 * Props for the leaderboard table component.
 */
interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  competitionType: CompetitionType;
}

/**
 * Leaderboard table component for the OG image.
 */
function LeaderboardTable({
  entries,
  competitionType,
}: LeaderboardTableProps): ReactElement {
  const valueColumnHeader = getValueColumnHeader(competitionType);

  return (
    <div
      tw="flex flex-col w-full rounded-lg overflow-hidden"
      style={{ border: `1px solid ${COLORS.table.border}` }}
    >
      {/* Header */}
      <div
        tw="flex w-full px-8 py-3 text-sm font-semibold tracking-wider justify-between"
        style={{
          backgroundColor: COLORS.table.headerBg,
          color: COLORS.table.headerText,
          borderBottom: `1px solid ${COLORS.table.border}`,
        }}
      >
        <div tw="w-20">Rank</div>
        <div tw="flex-1">Agent</div>
        <div>{valueColumnHeader}</div>
      </div>

      {/* Rows */}
      {entries.map((entry, index) => (
        <LeaderboardRow
          key={entry.id}
          entry={entry}
          index={index}
          isLast={index === entries.length - 1}
        />
      ))}
    </div>
  );
}

/**
 * Props for the CTA button component.
 */
interface CtaButtonProps {
  text: string;
}

/**
 * CTA button component for the OG image.
 */
function CtaButton({ text }: CtaButtonProps): ReactElement {
  return (
    <div
      tw="flex items-center justify-center rounded-xl text-white font-semibold mt-20 px-42 py-7 text-4xl tracking-widest w-full"
      style={{
        background: `linear-gradient(180deg, ${COLORS.button.light} 0%, ${COLORS.button.base} 100%)`,
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.45)",
        color: COLORS.text.light,
      }}
    >
      {text}
    </div>
  );
}

/**
 * Props for the right section active component.
 */
interface RightSectionActiveOrEndedProps {
  competition: Competition;
  entries: LeaderboardEntry[];
}

/**
 * Right section active component for the OG image.
 */
function RightSectionActiveOrEnded({
  competition,
  entries,
}: RightSectionActiveOrEndedProps): ReactElement {
  return (
    <div tw="flex flex-col pt-30 w-full text-white h-full justify-between">
      <LeaderboardTable entries={entries} competitionType={competition.type} />
      <CtaButton text={getCtaText(competition)} />
    </div>
  );
}

/**
 * Props for the right section pending component.
 */
interface RightSectionPendingProps {
  competition: Competition;
  totalRewards: bigint;
  tokenSvg: string;
}

/**
 * Right section pending component for the OG image.
 */
function RightSectionPending({
  competition,
  totalRewards,
  tokenSvg,
}: RightSectionPendingProps): ReactElement {
  return (
    <div tw="flex flex-col items-center text-3xl tracking-wider gap-y-5 h-full pt-30 justify-between">
      {/* Top text - left aligned */}
      <div tw="flex flex-col items-start w-full">
        <div style={{ display: "flex", columnGap: "20px" }}>
          <span style={{ color: COLORS.text.gray }}>{"///"}</span>
          <span tw="text-white">PREDICT</span>
          <span style={{ color: COLORS.text.gray }}>WINNERS</span>
        </div>
      </div>

      {/* Reward amount */}
      <div tw="flex items-center" style={{ gap: "16px" }}>
        <div tw="flex items-center justify-center w-14 h-14 bg-white rounded-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={tokenSvg} alt="Recall token" width={36} height={36} />
        </div>
        <span
          tw="text-white font-bold text-[120px]"
          style={{ fontFamily: FONT_SANS }}
        >
          {formatBigintAmount(totalRewards, undefined, false)}
        </span>
      </div>

      {/* Bottom text - right aligned */}
      <div tw="flex flex-col items-end w-full">
        <div style={{ display: "flex", columnGap: "20px" }}>
          <span tw="text-white">REWARD</span>
          <span style={{ color: COLORS.text.gray }}>POOL</span>
          <span style={{ color: COLORS.text.gray }}>{"///"}</span>
        </div>
      </div>

      <CtaButton text={getCtaText(competition)} />
    </div>
  );
}

/**
 * Fallback image component for the OG image.
 */
function FallbackImage(title: string, fonts: FontConfig[]): ImageResponse {
  return new ImageResponse(
    (
      <div
        tw="flex w-full h-full items-center justify-center text-white text-5xl font-bold"
        style={{ fontFamily: FONT_MONO, backgroundColor: COLORS.fallbackBg }}
      >
        {title}
      </div>
    ),
    { width: OG_WIDTH, height: OG_HEIGHT, fonts },
  );
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * Fetches trading competition leaderboard entries.
 */
async function fetchTradingLeaderboard(
  client: Awaited<ReturnType<typeof createSafeClient>>,
  competitionId: string,
  competitionType: "trading" | "perpetual_futures" | "spot_live_trading",
): Promise<TradingAgent[]> {
  const result = await client.competitions.getAgents({
    competitionId,
    paging: { limit: 3, offset: 0, sort: "rank" },
    includeInactive: false,
  });

  if (!result.isSuccess) return [];

  return result.data.agents.map((a) => ({
    type: competitionType,
    id: a.id,
    name: a.name,
    imageUrl: a.imageUrl,
    rank: a.rank,
    portfolioValue: a.portfolioValue,
    pnl: a.pnl,
    pnlPercent: a.pnlPercent,
  }));
}

/**
 * Fetches sports prediction competition leaderboard entries.
 * Merges leaderboard data with agent images from the agents endpoint.
 */
async function fetchSportsLeaderboard(
  client: Awaited<ReturnType<typeof createSafeClient>>,
  competitionId: string,
  competitionType: "sports_prediction",
): Promise<SportsAgent[]> {
  const [leaderboardResult, agentsResult] = await Promise.all([
    client.nfl.getLeaderboard({ competitionId }),
    client.competitions.getAgents({
      competitionId,
      paging: { limit: 100, offset: 0, sort: "rank" },
      includeInactive: false,
    }),
  ]);

  if (!leaderboardResult.isSuccess) return [];

  // Build a map of agent IDs to image URLs
  const agentImageMap = new Map<string, string | null>();
  if (agentsResult.isSuccess) {
    for (const agent of agentsResult.data.agents) {
      agentImageMap.set(agent.id, agent.imageUrl);
    }
  }

  // Filter to competition-level entries and take top 3
  return (leaderboardResult.data.leaderboard as CompetitionLeaderboardEntry[])
    .slice(0, 3)
    .map((entry) => ({
      type: competitionType,
      id: entry.agentId,
      name: entry.agentName ?? "Unknown Agent",
      imageUrl: agentImageMap.get(entry.agentId) ?? null,
      rank: entry.rank,
      averageBrierScore: entry.averageBrierScore,
      gamesScored: entry.gamesScored,
    }));
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<ImageResponse> {
  try {
    const client = await createSafeClient();
    const { id } = await context.params;

    const [{ data: competition }, fonts, assets] = await Promise.all([
      client.competitions.getById({ id }),
      loadFonts(),
      loadAssets(),
    ]);
    const { backgroundImage, recallTokenSvg, recallLogoSvg } = assets;

    // Return fallback if required data is missing
    if (!competition || !backgroundImage || !recallTokenSvg || !recallLogoSvg) {
      return FallbackImage(competition?.name || "Recall Competitions", fonts);
    }

    // Fetch leaderboard entries for active/ended competitions
    let leaderboardEntries: LeaderboardEntry[] = [];
    if (shouldShowAgentsTable(competition.status)) {
      try {
        leaderboardEntries =
          competition.type === "sports_prediction"
            ? await fetchSportsLeaderboard(client, id, competition.type)
            : await fetchTradingLeaderboard(client, id, competition.type);
      } catch (err) {
        console.error("Failed to load leaderboard:", err);
      }
    }

    const totalRewards =
      BigInt(competition.rewardsTge?.agentPool ?? 0) +
      BigInt(competition.rewardsTge?.userPool ?? 0);

    const showTable =
      shouldShowAgentsTable(competition.status) &&
      leaderboardEntries.length > 0;

    return new ImageResponse(
      (
        <div
          tw="flex w-full h-full"
          style={{
            fontFamily: FONT_MONO,
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: "cover",
          }}
        >
          <LeftSection competition={competition} logoSvg={recallLogoSvg} />

          <div tw="flex flex-col w-1/2 px-8 pb-10">
            {showTable ? (
              <RightSectionActiveOrEnded
                competition={competition}
                entries={leaderboardEntries}
              />
            ) : (
              <RightSectionPending
                competition={competition}
                totalRewards={totalRewards}
                tokenSvg={recallTokenSvg}
              />
            )}
          </div>
        </div>
      ),
      { width: OG_WIDTH, height: OG_HEIGHT, fonts },
    );
  } catch (err) {
    console.error("Failed to generate OG image:", err);
    return FallbackImage("Recall Competitions", []);
  }
}
