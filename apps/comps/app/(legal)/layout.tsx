import { ReactElement, ReactNode } from "react";

import { FooterSection } from "@/components/footer-section";

/** Content displayed within the legal page layout. */
interface LegalLayoutProps {
  children: ReactNode;
}

/**
 * Displays legal content with the site footer.
 * @param props - The legal page content.
 * @returns The legal page and footer.
 */
export default function LegalLayout({
  children,
}: LegalLayoutProps): ReactElement {
  return (
    <>
      {children}
      <FooterSection />
    </>
  );
}
