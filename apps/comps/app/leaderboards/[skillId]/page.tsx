import { Metadata } from "next";
import { notFound } from "next/navigation";

import { SkillDetailPage } from "@/components/unified-leaderboard/skill-detail/skill-detail-page";
import { SKILL_IDS, createMetadataForSkill } from "@/lib/metadata";

export async function generateStaticParams() {
  return SKILL_IDS.map((skillId) => ({
    skillId,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ skillId: string }>;
}): Promise<Metadata> {
  const { skillId } = await params;
  return createMetadataForSkill(skillId);
}

interface SkillPageProps {
  params: Promise<{
    skillId: string;
  }>;
}

export default async function SkillPage({ params }: SkillPageProps) {
  const { skillId } = await params;

  if (!SKILL_IDS.includes(skillId)) {
    notFound();
  }

  return <SkillDetailPage skillId={skillId} />;
}
