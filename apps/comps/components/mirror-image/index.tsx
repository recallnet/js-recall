import Image from "next/image";

import { cn } from "@recallnet/ui2/lib/utils";

export const MirrorImage: React.FunctionComponent<{
  image: string;
  width: number;
  height: number;
  className?: string;
  children?: React.ReactNode;
}> = ({ image, width, height, className, children }) => {
  return (
    <div className={cn(className, "relative")} style={{ width, height }}>
      {children}
      <div className="relative h-full w-full overflow-hidden rounded-full">
        <Image src={image} alt="avatar" fill className="object-cover" />
      </div>
      <div
        className="pointer-events-none absolute left-0 top-full -z-10 w-full overflow-hidden"
        style={{ height: height / 1.3 }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-full">
          <Image
            src={image}
            alt="avatar"
            fill
            className="scale-y-[-1] object-cover opacity-40 blur-[5px]"
            style={{
              maskImage:
                "linear-gradient(to top, black 0%, black 10%, transparent 70%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to top, black 0%, black 10%, transparent 70%, transparent 100%)",
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default MirrorImage;
