import Distribution from "@/public/distribution.png";

import SignInOrConnectButton from "./sign-in-or-connect-button";

export default function Landing() {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-14"
      style={{
        backgroundImage: `radial-gradient(ellipse 700px 500px at center bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,1) 100%), url(${Distribution.src})`,
        backgroundSize: "max(100%, 1100px) auto, max(100%, 1100px) auto",
        backgroundPosition: "center bottom, center bottom",
        backgroundRepeat: "no-repeat, no-repeat",
      }}
    >
      <div className="text-center text-6xl font-bold">
        Stake to Enter the Arena
      </div>
      <div className="flex flex-wrap justify-center gap-14">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-[50px] items-center justify-center rounded-full bg-[#253241]">
            1
          </div>
          <div className="text-center text-xl">
            Stake RECALL to
            <br /> get Boost
          </div>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-[50px] items-center justify-center rounded-full bg-[#253241]">
            2
          </div>
          <div className="text-center text-xl">
            Use Boost to compete
            <br /> or curate AI agents
          </div>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-[50px] items-center justify-center rounded-full bg-[#253241]">
            3
          </div>
          <div className="text-center text-xl">
            Earn RECALL when
            <br /> they win
          </div>
        </div>
      </div>
      <SignInOrConnectButton />
    </div>
  );
}
