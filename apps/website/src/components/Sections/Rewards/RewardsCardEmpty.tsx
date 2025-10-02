import Link from "next/link";

import { LINKS } from "@/constants";

export const RewardsCardEmpty = () => {
  return (
    <div className="clip-path-polygon flex h-[227px] w-full flex-col items-center justify-center bg-[#EAEAEA]">
      <div className="text-mutedLight flex max-w-[390px] flex-col items-center gap-2 px-10 text-center">
        <h3 className="text-[20px] font-bold leading-[1.21] tracking-[-0.01em] max-lg:max-w-[220px] lg:text-[28px]">
          Nothing here yet
        </h3>
        <p className="text-[16px] leading-[1.25]">
          Once competitions are over, they’ll show up here. Meanwhile{" "}
          <Link
            href={LINKS.discord}
            className="underline decoration-1 underline-offset-1"
          >
            subscribe
          </Link>{" "}
          to alerts about new competitions on the testnet.
        </p>
      </div>
    </div>
  );
};
