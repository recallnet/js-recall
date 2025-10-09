import { Metadata } from "next";
import { notFound } from "next/navigation";

import { SkillDetailPage } from "@/components/unified-leaderboard/skill-detail/skill-detail-page";

// Static params for dynamic routing based on our JSON skills
export async function generateStaticParams() {
  // Import the JSON data to get skill IDs
  const benchmarkData = await import(
    "@/public/data/benchmark-leaderboard.json"
  );
  const skillIds = Object.keys(benchmarkData.skills);

  return skillIds.map((skillId) => ({
    skillId,
  }));
}

// Generate metadata for each skill page
export async function generateMetadata({
  params,
}: {
  params: Promise<{ skillId: string }>;
}): Promise<Metadata> {
  const { skillId } = await params;

  try {
    // Import benchmark data
    const benchmarkData = await import(
      "@/public/data/benchmark-leaderboard.json"
    );
    const skill =
      benchmarkData.skills[skillId as keyof typeof benchmarkData.skills];

    if (skill) {
      return {
        title: `${skill.name} - AI Leaderboard`,
        description: skill.description,
        openGraph: {
          title: `${skill.name} - AI Leaderboard`,
          description: skill.description,
          images: [{ url: `/api/og?skillId=${skillId}` }],
        },
        twitter: {
          card: "summary_large_image",
          title: `${skill.name} - AI Leaderboard`,
          description: skill.description,
          images: [`/api/og?skillId=${skillId}`],
        },
      };
    }

    // Handle trading skill
    if (skillId === "crypto_trading") {
      return {
        title: "Trading Rankings - AI Agent Leaderboard",
        description:
          "Skill-based rankings for AI trading agents based on competition performance",
        openGraph: {
          title: "Trading Rankings - AI Agent Leaderboard",
          description:
            "Skill-based rankings for AI trading agents based on competition performance",
          images: [{ url: `/api/og?skillId=${skillId}` }],
        },
        twitter: {
          card: "summary_large_image",
          title: "Trading Rankings - AI Agent Leaderboard",
          description:
            "Skill-based rankings for AI trading agents based on competition performance",
          images: [`/api/og?skillId=${skillId}`],
        },
      };
    }

    return {
      title: "Skill Not Found",
      description: "The requested skill leaderboard could not be found",
      openGraph: {
        title: "Skill Not Found",
        description: "The requested skill leaderboard could not be found",
        images: [{ url: "/api/og?leaderboards=1" }],
      },
      twitter: {
        card: "summary_large_image",
        title: "Skill Not Found",
        description: "The requested skill leaderboard could not be found",
        images: ["/api/og?leaderboards=1"],
      },
    };
  } catch {
    return {
      title: "Error Loading Skill",
      description: "An error occurred while loading the skill leaderboard",
      openGraph: {
        title: "Error Loading Skill",
        description: "An error occurred while loading the skill leaderboard",
        images: [{ url: "/api/og?leaderboards=1" }],
      },
      twitter: {
        card: "summary_large_image",
        title: "Error Loading Skill",
        description: "An error occurred while loading the skill leaderboard",
        images: ["/api/og?leaderboards=1"],
      },
    };
  }
}

interface SkillPageProps {
  params: Promise<{
    skillId: string;
  }>;
}

export default async function SkillPage({ params }: SkillPageProps) {
  const { skillId } = await params;

  // Dynamically validate skill ID exists
  try {
    const benchmarkData = await import(
      "@/public/data/benchmark-leaderboard.json"
    );
    const validSkillIds = Object.keys(benchmarkData.skills);

    if (!validSkillIds.includes(skillId)) {
      notFound();
    }
  } catch {
    notFound();
  }

  return <SkillDetailPage skillId={skillId} />;
}
