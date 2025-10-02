import { PortableText, PortableTextBlock } from "@portabletext/react";

import {
  AcceleratingType,
  BackedSectionType,
  BuildType,
  NewsBlockType,
  Section,
  SlidesType,
} from "@/types/components";

import { Accelerating } from "./Accelerating";
import { Backed } from "./Backed";
import { Build } from "./Build";
import { News } from "./News";
import { Partners } from "./Partners";
import { Rewards } from "./Rewards";
import { Showcase } from "./Showcase";

const portableTextComponents = {
  types: {
    partners: () => <Partners />,
    rewards: () => <Rewards />,
    accelerating: ({ value }: { value: AcceleratingType }) => (
      <Accelerating node={value} />
    ),
    backed: ({ value }: { value: BackedSectionType }) => (
      <Backed node={value} />
    ),
    build: ({ value }: { value: BuildType }) => <Build node={value} />,
    newsBlock: ({ value }: { value: NewsBlockType }) => <News node={value} />,
    slides: ({ value }: { value: SlidesType }) => <Showcase node={value} />,
  },
};

export interface PortableSectionsProps {
  blocks: PortableTextBlock[]; // Portable Text blocks array
}

export const PortableSections = ({ blocks }: { blocks: Section[] }) => {
  if (!blocks || blocks.length === 0) {
    return null;
  }

  return <PortableText value={blocks} components={portableTextComponents} />;
};
