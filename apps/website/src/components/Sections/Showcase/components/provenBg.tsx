import { FrameGrid } from "./d";

export const ProvenBg = ({ isActive }: { isActive: boolean }) => (
  <div className="absolute left-0 top-0 z-20 flex h-full w-full items-center justify-center">
    <div className="h-full max-h-[850px] w-full max-w-[1440px]">
      <FrameGrid isActive={isActive} />
    </div>
  </div>
);
