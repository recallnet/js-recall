import { BuildStripes } from "./BuildStripes";

export const BuildBg = () => {
  return (
    <div className="pointer-events-none absolute left-0 top-0 hidden h-full w-full overflow-hidden md:block">
      <div className="absolute -top-10 left-1/2 flex w-[3156px] translate-x-[-50%] flex-row items-center justify-between lg:translate-y-[70px]">
        <div className="translate-x-[-200px] lg:translate-x-[-325px]">
          <BuildStripes />
        </div>

        <div className="translate-x-[200px] scale-x-[-1] lg:translate-x-[325px]">
          <BuildStripes />
        </div>
      </div>

      <div className="gradient-overlay absolute left-0 top-0 aspect-[1450/530] w-full" />
    </div>
  );
};
