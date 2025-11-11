import { promises as fs } from "fs";
import path from "path";

/**
 * Reads a font file and returns its ArrayBuffer.
 */
const loadFontAsBuffer = async (fontPath: string): Promise<ArrayBuffer> => {
  try {
    const fullPath = path.resolve(process.cwd(), fontPath);
    const fontBuffer = await fs.readFile(fullPath);
    const uint8ArrayCopy = new Uint8Array(fontBuffer);
    return uint8ArrayCopy.buffer;
  } catch (error) {
    console.error(`CRITICAL: Failed to load font at ${fontPath}`, error);
    throw error;
  }
};

/**
 * Reads an SVG/image file and returns its content as a Base64 data URL.
 */
const loadAssetAsBase64 = async (assetPath: string): Promise<string> => {
  try {
    const fullPath = path.resolve(process.cwd(), assetPath);
    const assetBuffer = await fs.readFile(fullPath);
    const base64Asset = assetBuffer.toString("base64");

    const ext = path.extname(assetPath).toLowerCase();
    let mimeType = "image/svg+xml"; // Default
    if (ext === ".png") mimeType = "image/png";
    if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";

    return `data:${mimeType};base64,${base64Asset}`;
  } catch (error) {
    console.error(`CRITICAL: Failed to load asset at ${assetPath}`, error);
    throw error;
  }
};

const interLight = "src/fonts/Inter_24pt-Light.ttf";
const interRegular = "src/fonts/Inter_24pt-Regular.ttf";
const interBold = "src/fonts/Inter_24pt-Bold.ttf";
const spaceMonoRegular = "src/fonts/SpaceMono-Regular.ttf";

export const fonts = {
  interLight: loadFontAsBuffer(interLight),
  interRegular: loadFontAsBuffer(interRegular),
  interBold: loadFontAsBuffer(interBold),
  spaceMonoRegular: loadFontAsBuffer(spaceMonoRegular),
};

// --- SVG/Asset Loading (Updated) ---
const ogBackgroundSvgPath = "src/assets/og-background.svg";
// Renamed asset paths based on your request
const recallTokenSvgPath = "src/assets/recall-token.svg";
const recallTextSvgPath = "src/assets/recall-text.svg";

export const assets = {
  ogBackground: loadAssetAsBase64(ogBackgroundSvgPath),
  recallToken: loadAssetAsBase64(recallTokenSvgPath), // Renamed
  recallText: loadAssetAsBase64(recallTextSvgPath), // Renamed
};

// --- Helper Functions ---

export const getOrdinal = (n: number): string => {
  const lastDigit = n % 10;
  const lastTwoDigits = n % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) return n + "th";
  switch (lastDigit) {
    case 1:
      return n + "st";
    case 2:
      return n + "nd";
    case 3:
      return n + "rd";
    default:
      return n + "th";
  }
};

export const formatEventDate = (
  date: Date | string | null | undefined,
): string => {
  if (!date) return "TBA";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "TBA";
    const day = d.getDate();
    const month = d.toLocaleString("en-US", { month: "short" });
    return `${month} ${getOrdinal(day)}`;
  } catch (error) {
    console.error(`Error formatting date:`, error);
    return "TBA";
  }
};

export const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return "0";
  return num.toLocaleString("en-US");
};
