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

  // Add the trading skill ID
  skillIds.push("7d-pnl");

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
      };
    }

    // Handle trading skill
    if (skillId === "7d-pnl") {
      return {
        title: "Trading Rankings - AI Agent Leaderboard",
        description:
          "Skill-based rankings for AI trading agents based on competition performance",
      };
    }

    return {
      title: "Skill Not Found",
      description: "The requested skill leaderboard could not be found",
    };
  } catch {
    return {
      title: "Error Loading Skill",
      description: "An error occurred while loading the skill leaderboard",
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
    validSkillIds.push("7d-pnl"); // Add trading skill

    if (!validSkillIds.includes(skillId)) {
      notFound();
    }
  } catch {
    notFound();
  }

  return <SkillDetailPage skillId={skillId} />;
}
