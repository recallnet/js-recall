import Link from "next/link";

import { FooterType } from "@/types/components";

import { Icon } from "../Common/Icons/Icon";
import { Logo } from "../Logo";
import { FooterBackground } from "./FooterBackground";
import { FooterSubscribe } from "./FooterSubscribe";

export const Footer = ({ node }: { node: FooterType }) => {
  const { menu = [], social, subscribe } = node;
  const date = new Date().getFullYear();

  const socialsKeys = ["x", "discord", "youtube", "reddit"] as const;

  const halfLength = Math.ceil(menu.length / 2);
  const firstHalf = menu.slice(0, halfLength);
  const secondHalf = menu.slice(halfLength);

  const renderFooterLink = (item: {
    _key: string;
    href: string;
    title: string;
  }) => {
    const isInternalPath = item.href.startsWith("/");

    // Check if it's a recall.network URL that should be internal
    let isRecallNetworkInternal = false;
    let internalPath = item.href;

    try {
      const url = new URL(item.href);
      if (url.hostname === "recall.network") {
        if (url.pathname === "/privacy") {
          isRecallNetworkInternal = true;
          internalPath = "/privacy";
        } else if (url.pathname === "/terms") {
          isRecallNetworkInternal = true;
          internalPath = "/terms";
        }
      }
    } catch {
      // Invalid URL, treat as relative path if it starts with /
      // Otherwise treat as external
    }

    const isInternal = isInternalPath || isRecallNetworkInternal;
    const href = isInternal ? internalPath : item.href;

    const linkClassName =
      "text-[12px] leading-[13px] font-bold text-gray font-secondary uppercase tracking-[1.32px] flex flex-row gap-2";
    const content = (
      <>
        <span>¬</span>
        <span>{item.title}</span>
      </>
    );

    if (isInternal) {
      return (
        <Link key={item._key} href={href} className={linkClassName}>
          {content}
        </Link>
      );
    }

    return (
      <a
        key={item._key}
        href={item.href}
        target="_blank"
        rel="noreferrer"
        className={linkClassName}
      >
        {content}
      </a>
    );
  };

  return (
    <footer className="relative flex flex-col items-center justify-center overflow-hidden pb-3 lg:py-10">
      <div className="bg-gradient-footer z-20" />

      <div className="relative w-full max-w-[1140px] pb-11 pt-[180px] lg:py-[120px]">
        <FooterSubscribe heading={subscribe?.heading} text={subscribe?.text} />

        <FooterBackground />
      </div>

      <div className="relative z-30 flex w-full max-w-[1140px] flex-col border-t border-[#212C3A]">
        <div className="flex flex-col gap-[26px] px-[35px] py-[30px] lg:flex-row lg:gap-0 lg:px-0">
          <Logo />

          <div className="grid grid-cols-1 gap-x-[96px] gap-y-[30px] lg:ml-[96px] lg:grid-cols-2 lg:gap-y-[4px] [&>*:nth-child(5)]:max-lg:mb-[30px]">
            <div className="flex flex-col gap-y-[4px]">
              {firstHalf.map((item) => renderFooterLink(item))}
            </div>
            <div className="flex flex-col gap-y-[4px]">
              {secondHalf.map((item) => renderFooterLink(item))}
            </div>
          </div>

          <div className="flex flex-row gap-x-[56px] max-lg:justify-between max-lg:pt-3 lg:ml-auto">
            {socialsKeys.map((item) => {
              const network = social?.[item];

              if (!network) {
                return null;
              }

              return (
                <a
                  href={network}
                  key={item}
                  className="text-[#596E89] transition-colors hover:text-white"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon name={item} />
                </a>
              );
            })}
          </div>
        </div>

        <div className="border border-b-0 border-[#212C3A] py-[17px] pb-3">
          <p className="text-center text-[12px] font-bold leading-[1] text-[rgba(164,_192,_224,_0.56)]">
            Copyright {date} / Recall Labs / All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
