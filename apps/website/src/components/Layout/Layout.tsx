import { HomePageData } from "@/types/components";

import { Hero, Partners } from "../Sections";
import { PortableSections } from "../Sections/PortableSections";
import { Footer } from "./Footer";
import { Header } from "./Header";

export const Layout = ({ data }: { data: HomePageData }) => {
  return (
    <>
      <Header node={data.menu || []} />

      <main>
        <Hero node={data.hero || {}} />

        <Partners />

        <PortableSections blocks={data.sections} />
      </main>

      <Footer node={data.footer || {}} />
    </>
  );
};
