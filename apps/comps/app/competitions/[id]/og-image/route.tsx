import { promises as fs } from "fs";
import { ImageResponse } from "next/og";
import path from "path";

import { createSafeClient } from "@/rpc/clients/server-side";

const loadAssetAsBase64 = async (assetPath: string): Promise<string> => {
  const fullPath = path.join(process.cwd(), "public", assetPath);
  const assetBuffer = await fs.readFile(fullPath);
  const base64Asset = assetBuffer.toString("base64");

  const ext = path.extname(assetPath).toLowerCase();
  let mimeType = "image/svg+xml"; // Default
  if (ext === ".png") mimeType = "image/png";
  if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";

  return `data:${mimeType};base64,${base64Asset}`;
};

// --- Helper Functions ---
const getOrdinal = (n: number): string => {
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

const formatEventDate = (date: Date | string | null | undefined): string => {
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

const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return "0";
  return num.toLocaleString("en-US");
};

const styles = {
  mainBackground: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundSize: "100% 100%",
    backgroundRepeat: "no-repeat",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 48,
    width: 916,
  },
  title: {
    fontFamily: '"Inter"',
    fontSize: 72,
    fontWeight: 700,
    color: "#e5e5e5",
    lineHeight: "100%",
    textAlign: "center",
    width: 914,
  },
  infoContainer: {
    display: "flex",
    flexDirection: "row",
    gap: 12,
    width: 916,
    height: 212,
  },
  infoSection: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: 452,
    height: 212,
  },
  amountCard: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    width: 451,
    height: 72,
    backgroundColor: "rgba(7, 7, 7, 0.4)",
    border: "1px solid #3D3D3D",
    borderRadius: 8,
    boxSizing: "border-box",
  },
  dateCard: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    width: 452,
    height: 128,
    backgroundColor: "rgba(7, 7, 7, 0.4)",
    border: "1px solid #3D3D3D",
    borderRadius: 8,
    boxSizing: "border-box",
    padding: "16px 12px",
  },
  amount: {
    fontFamily: '"Inter"',
    fontWeight: 400,
    fontSize: 40,
    color: "#E5E5E5",
    lineHeight: "100%",
  },
  description: {
    fontFamily: '"Inter"',
    fontWeight: 300,
    fontSize: 32,
    color: "#A7A7A7",
    lineHeight: "100%",
  },
  dateLabel: {
    fontFamily: '"Inter"',
    fontSize: 32,
    fontWeight: 400,
    color: "#A7A7A7",
    lineHeight: "100%",
  },
  dateValue: {
    fontFamily: '"Inter"',
    fontSize: 40,
    fontWeight: 400,
    color: "#E5E5E5",
    lineHeight: "100%",
  },
  footer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    width: "100%",
  },
  url: {
    fontFamily: '"Space Mono"',
    fontSize: 32,
    fontWeight: 400,
    color: "#87B0D9",
    letterSpacing: "0.04em",
    lineHeight: "100%",
  },
} as const;

export async function GET(
  req: Request,
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
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#020817",
            color: "white",
            fontSize: 54,
            fontWeight: 700,
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

  const interLight = fs.readFile(
    path.join(process.cwd(), "assets/fonts/Inter_24pt-Light.ttf"),
  );
  const interRegular = fs.readFile(
    path.join(process.cwd(), "assets/fonts/Inter_24pt-Regular.ttf"),
  );
  const interBold = fs.readFile(
    path.join(process.cwd(), "assets/fonts/Inter_24pt-Bold.ttf"),
  );
  const spaceMonoRegular = fs.readFile(
    path.join(process.cwd(), "assets/fonts/SpaceMono-Regular.ttf"),
  );

  const backgroundImage = await loadAssetAsBase64("og-background.svg");
  const recallSvgUrl = await loadAssetAsBase64("recall-token-circle.svg");
  const recallTextSvgUrl = await loadAssetAsBase64("recall-text.svg");

  return new ImageResponse(
    (
      <div
        style={{
          ...styles.mainBackground,
          backgroundImage: `url(${backgroundImage})`,
        }}
      >
        <div style={styles.content}>
          <div style={styles.title}>{competition.name}</div>

          <div style={styles.infoContainer}>
            {/* Column 1 */}
            <div style={styles.infoSection}>
              <div style={styles.amountCard}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={recallSvgUrl} style={{ width: 24, height: 24 }} />
                <span style={styles.amount}>
                  {formatNumber(Number(competition.rewardsTge?.agentPool ?? 0))}
                </span>
                <span style={styles.description}>for Agents</span>
              </div>
              <div style={styles.dateCard}>
                <span style={styles.dateLabel}>Duration</span>
                <span
                  style={styles.dateValue}
                >{`${formatEventDate(competition.startDate)} - ${formatEventDate(
                  competition.endDate,
                )}`}</span>
              </div>
            </div>

            {/* Column 2 */}
            <div style={styles.infoSection}>
              <div style={styles.amountCard}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={recallSvgUrl} style={{ width: 24, height: 24 }} />
                <span style={styles.amount}>
                  {formatNumber(Number(competition.rewardsTge?.userPool ?? 0))}
                </span>
                <span style={styles.description}>for Boosters</span>
              </div>
              <div style={styles.dateCard}>
                <span style={styles.dateLabel}>Boost Window</span>
                <span style={styles.dateValue}>{`${formatEventDate(
                  competition.boostStartDate,
                )} - ${formatEventDate(competition.boostEndDate)}`}</span>
              </div>
            </div>
          </div>

          <div style={styles.footer}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={recallTextSvgUrl} style={{ height: 32 }} />
            <div style={styles.url}>https://app.recall.network</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Inter",
          data: await interLight,
          weight: 300,
          style: "normal",
        },
        {
          name: "Inter",
          data: await interRegular,
          weight: 400,
          style: "normal",
        },
        {
          name: "Inter",
          data: await interBold,
          weight: 700,
          style: "normal",
        },
        {
          name: "Space Mono",
          data: await spaceMonoRegular,
          weight: 400,
          style: "normal",
        },
      ],
    },
  );
}
