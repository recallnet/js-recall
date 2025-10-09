import { ImageResponse } from "@vercel/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

interface SkillMeta {
  id: string;
  name: string;
  description?: string;
}

interface ModelScoreEntry {
  rawScore: number;
  rank: number;
}

interface LeaderboardData {
  metadata?: {
    lastUpdated?: string;
  };
  skills: Record<string, SkillMeta>;
  models: Array<{
    id: string;
    name: string;
    scores: Record<string, ModelScoreEntry | undefined>;
  }>;
}

/**
 * Builds an OG image for unified or skill-specific leaderboards.
 *
 * Query parameters:
 * - leaderboards: if present, generates the unified leaderboard image
 * - skillId: if present, generates a skill-specific image
 *
 * Precedence: skillId-specific > leaderboards > default
 */
export async function GET(req: NextRequest): Promise<ImageResponse> {
  const { searchParams } = new URL(req.url);
  const skillId = searchParams.get("skillId");
  const isUnified = searchParams.has("leaderboards");

  // Attempt to dynamically import the leaderboard dataset for skill metadata and rankings
  // This file is bundled at build time and safe to import in the Edge runtime
  let data: LeaderboardData | null = null;
  try {
    const mod = (await import("@/public/data/benchmark-leaderboard.json")) as unknown;
    data = mod as LeaderboardData;
  } catch {
    // If import fails, continue with minimal rendering
    data = null;
  }

  if (skillId && data) {
    return buildSkillOgImage(data, skillId);
  }

  return buildUnifiedOgImage(data);
}

function buildUnifiedOgImage(data: LeaderboardData | null): ImageResponse {
  const lastUpdated = data?.metadata?.lastUpdated ?? undefined;
  const updatedText = lastUpdated ? `Updated: ${new Date(lastUpdated).toISOString().slice(0, 10)}` : undefined;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#000000",
          color: "#FFFFFF",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, \"Apple Color Emoji\", \"Segoe UI Emoji\"",
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -1 }}>Recall Leaderboards</div>
        <div style={{ marginTop: 12, fontSize: 32, opacity: 0.9 }}>Unified AI Rankings</div>
        {updatedText ? (
          <div style={{ marginTop: 24, fontSize: 22, opacity: 0.7 }}>{updatedText}</div>
        ) : null}
        <div
          style={{
            marginTop: 36,
            fontSize: 20,
            opacity: 0.8,
            display: "flex",
            gap: 16,
          }}
        >
          <span>benchmarks</span>
          <span>•</span>
          <span>trading</span>
          <span>•</span>
          <span>competitions</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}

function buildSkillOgImage(data: LeaderboardData, skillId: string): ImageResponse {
  const skill = data.skills[skillId] || { id: skillId, name: skillId };
  const topEntries = getTopModelsForSkill(data, skillId, 3);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#000000",
          color: "#FFFFFF",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, \"Apple Color Emoji\", \"Segoe UI Emoji\"",
          padding: 48,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 58, fontWeight: 800, letterSpacing: -1 }}>Leaderboard</div>
        <div style={{ marginTop: 8, fontSize: 36, opacity: 0.95 }}>{skill.name}</div>

        {topEntries.length > 0 ? (
          <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 12 }}>
            {topEntries.map((entry, idx) => (
              <div key={entry.name} style={{ fontSize: 26, opacity: 0.9 }}>
                {idx + 1}. {entry.name}
                {typeof entry.rank === "number" ? <span style={{ opacity: 0.7 }}> (rank {entry.rank})</span> : null}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 28, fontSize: 22, opacity: 0.8 }}>Rankings loading</div>
        )}

        <div style={{ position: "absolute", bottom: 36, fontSize: 20, opacity: 0.7 }}>recall.network • competitions</div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}

interface TopEntry {
  name: string;
  rank: number | null;
}

function getTopModelsForSkill(
  data: LeaderboardData,
  skillId: string,
  limit: number,
): TopEntry[] {
  const entries: TopEntry[] = [];

  for (const model of data.models) {
    const score = model.scores[skillId];
    if (!score) continue;
    const rank = typeof score.rank === "number" ? score.rank : null;
    entries.push({ name: model.name, rank });
  }

  // Sort by rank ascending (1 is best). Null ranks go last
  entries.sort((a, b) => {
    if (a.rank == null && b.rank == null) return 0;
    if (a.rank == null) return 1;
    if (b.rank == null) return -1;
    return a.rank - b.rank;
  });

  return entries.slice(0, Math.max(0, limit));
}
