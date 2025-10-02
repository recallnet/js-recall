export interface MenuItem {
  _key: string;
  _type: string;
  title: string;
  href: string;
  submenu?: {
    title: string;
    href: string;
  }[];
}

export interface Competition {
  _id: string;
  _type: string;
  title: string;
  text: string;
  cta: string;
  ctaUrl: string;
}
export interface AcceleratingType {
  heading: string;
  text: string;
  cta: {
    href: string;
    title: string;
  };
}
export interface BuildType {
  heading: string;
  subheading: string;
  icons: {
    _key: string;
    title: string;
    icon: string;
  }[];
}

export interface BackedType {
  _id: string;
  title: string;
  image: {
    url: string;
    width: number;
    height: number;
  };
}

export interface SwarmType {
  heading: string;
  social: SocialType[];
}

export interface SocialType {
  _key: string;
  name: string;
  url: string;
}

export interface BackedSectionType {
  _key: string;
  backed: {
    heading: string;
    logos: BackedType[];
  };
  swarm: {
    heading: string;
    social: SocialType[];
  };
}

export interface SlidesType {
  firstSlide: {
    title: string;
    description: string;
  };
  secondSlide: {
    title: string;
    description: string;
  };
  thirdSlide: {
    title: string;
    description: string;
  };
  fourthSlide: {
    title: string;
    description: string;
  };
}

export interface NewsType {
  _id: string;
  _type: string;
  text: string;
  source: string;
  image: {
    url: string;
    width: number;
    height: number;
  };
  meta: {
    date: string;
    image: {
      url: string;
      width: number;
      height: number;
    };
    title: string;
  };
}

export interface NewsBlockType {
  heading: string;
  news: NewsType[];
}

export interface RewardsType {
  heading: string;
  subheading: string;
  activeCompetitions: Competition[];
  pastCompetitions: Competition[];
}

export interface Section {
  _key: string;
  _type: string;
  heading: string;
  subheading: string;
}

export interface Hero {
  heading: string;
  subheading: string;
  primaryCTA: {
    link: string;
    label: string;
  };
  secondaryCTA: {
    link: string;
    label: string;
  };
}

export type FooterType = {
  menu: {
    _key: string;
    title: string;
    href: string;
  }[];
  social: {
    x: string;
    discord: string;
    youtube: string;
    reddit?: string;
  };
  subscribe: {
    heading: string;
    text: string;
  };
};

export interface HomePageData {
  title?: string;
  subtitle?: string;
  menu: MenuItem[];
  hero: Hero;
  sections: Section[];
  footer: FooterType;
}
