import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { createSafeClient } from "@/rpc/clients/server-side";
import { formatCompetitionDates } from "@/utils/competition-utils";
import { formatBigintAmount } from "@/utils/format";

const BUTTON_BLUE = "#0E66BE";
const BUTTON_BLUE_LIGHT = "#1A8FE3";

/** Font configuration for OG image generation */
interface FontConfig {
  name: string;
  data: ArrayBuffer;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal" | "italic";
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
 *
 * @returns Array of font configurations
 */
async function loadFonts(): Promise<FontConfig[]> {
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
  } catch {
    return null;
  }
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<ImageResponse> {
  const client = await createSafeClient();
  const { id } = await context.params;

  const [{ data: competition }, fonts] = await Promise.all([
    client.competitions.getById({ id }),
    loadFonts(),
  ]);

  const [backgroundImage, recallTokenSvg, recallLogoSvg] = await Promise.all([
    loadAssetAsBase64("og-background.png"),
    loadAssetAsBase64("recall-token.svg"),
    loadAssetAsBase64("logo_full_grey.svg"),
  ]);

  const monospaceFontFamily = "Roboto Mono, sans-serif";
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
          tw="flex flex-col w-1/2 px-16 pb-16"
          style={{ justifyContent: "flex-end" }}
        >
          <div tw="flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={recallLogoSvg}
              alt="Recall logo"
              height={28}
              width={120}
            />

            <h1 tw="text-5xl text-white leading-tight mt-6 text-center font-bold uppercase">
              {competition.name}
            </h1>

            <span tw="text-2xl mt-6 tracking-widest text-gray-400 uppercase font-semibold">
              {formatCompetitionDates(
                competition.startDate,
                competition.endDate,
              )}
            </span>
          </div>
        </div>

        {/* Right section */}
        <div
          tw="flex flex-col w-1/2 px-12"
          style={{ justifyContent: "flex-end", paddingBottom: "70px" }}
        >
          <div tw="flex flex-col items-center font-normal">
            {/* Top text - left aligned */}
            <div tw="flex flex-col items-start w-full">
              <div
                tw="text-3xl tracking-wider"
                style={{ display: "flex", columnGap: "20px" }}
              >
                <span tw="text-gray-400">{"///"}</span>
                <span tw="text-white">PREDICT</span>
                <span tw="text-gray-400">THE WINNERS</span>
              </div>

              <div
                tw="text-3xl tracking-wider mt-1"
                style={{ display: "flex", columnGap: "20px" }}
              >
                <span tw="text-gray-400">&</span>
                <span tw="text-white">EARN</span>
                <span tw="text-gray-400">UP TO</span>
              </div>
            </div>

            <div tw="flex items-center mt-2" style={{ gap: "16px" }}>
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
            <div tw="flex flex-col items-end w-full mt-2">
              <div
                tw="text-3xl tracking-wider"
                style={{ display: "flex", columnGap: "20px" }}
              >
                <span tw="text-gray-400">IN</span>
                <span tw="text-white">REWARDS</span>
                <span tw="text-gray-400">{"///"}</span>
              </div>
            </div>

            <div
              tw="flex items-center justify-center mt-20 px-42 py-7 rounded-xl text-white text-4xl tracking-widest font-semibold"
              style={{
                background: `linear-gradient(180deg, ${BUTTON_BLUE_LIGHT} 0%, ${BUTTON_BLUE} 100%)`,
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.45)",
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
      fonts,
    },
  );
}
