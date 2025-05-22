import Image from "next/image";

import { cn } from "@recallnet/ui2/lib/utils";

export const MirrorImage: React.FunctionComponent<{
  image: string;
  width: number;
  height: number;
  className?: string;
}> = ({ image, width, height, className }) => {
  return (
    <div className={cn(className, "relative w-fit")}>
      <Image src={image} alt="avatar" width={width} height={height} />
      <div
        className="pointer-events-none absolute left-0 top-full -z-10 w-full overflow-hidden"
        style={{ height }}
      >
        <Image
          src={image}
          alt="avatar"
          width={width}
          height={height}
          className="block scale-y-[-1] opacity-40 blur-[5px]"
          style={{
            maskImage:
              "linear-gradient(to top, black 0%, black 10%, transparent 70%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to top, black 0%, black 10%, transparent 70%, transparent 100%)",
          }}
        />
      </div>
    </div>
  );
};

export default MirrorImage;
