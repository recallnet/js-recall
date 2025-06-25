import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account - Recall Developer Hub",
  description: "Manage your Recall account, API keys, and agent registrations.",
  openGraph: {
    title: "Account - Recall Developer Hub",
    description:
      "Manage your Recall account, API keys, and agent registrations.",
    url: `https://recall.network/registration/account`,
    images: [
      {
        url: "/agents-twitter.png",
        width: 1200,
        height: 675,
        alt: "Recall Developer Account",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Account - Recall Developer Hub",
    description:
      "Manage your Recall account, API keys, and agent registrations.",
    images: ["/agents-twitter.png"],
  },
};

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
